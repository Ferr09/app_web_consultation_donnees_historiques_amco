# admin.py
import json
from functools import wraps
import os
from flask import Blueprint, jsonify, render_template, request, flash, redirect, url_for, current_app, abort
from flask_login import login_required, current_user
# Dans auth.py
from main_routes import secure_filename
from utils import (
    find_user_by_email, 
    update_user, 
    get_all_users, 
    delete_user,
    get_protected_admins,
    generate_recovery_code,
    load_guides_data
)

# On crée le Blueprint pour les routes d'administration
admin = Blueprint('admin', __name__)

basedir = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(basedir, 'static', 'pdfs')

# =======================================================
# Décorateur pour vérifier si l'utilisateur est un admin
# =======================================================
def admin_required(f):
    """
    Un décorateur qui vérifie si l'utilisateur est connecté ET s'il a le rôle d'administrateur.
    Si ce n'est pas le cas, il renvoie une erreur 403 (Accès Interdit).
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            abort(403)
        return f(*args, **kwargs)
    return decorated_function




# =======================================================
# Routes du Panel d'Administration
# =======================================================

@admin.route('/')
@admin_required
def panel_admin():
    return render_template('panel-admin.html')

@admin.route('/gestion-comptes')
@admin_required
def gestion_comptes():
    protected_admins_list = get_protected_admins()
    return render_template('gestion-comptes.html', protected_admins=protected_admins_list)

@admin.route('/maj-doc')
@admin_required
def mettre_a_jour_doc():
    return render_template('mettre-a-jour-doc.html', guides_data=load_guides_data())

@admin.route('/maj-doc/update', methods=['POST'])
@admin_required
def update_documentation_pdf():
    # URL de redirection en cas de succès ou d'échec, pour éviter la répétition.
    redirect_url = url_for('admin.mettre_a_jour_doc')

    try:
        # --- Étape 1 : Valider les données reçues du formulaire ---
        category_slug = request.form.get('category')
        sub_item_slug = request.form.get('sub_item')
        file = request.files.get('pdf_file')

        # Vérifier que tous les champs nécessaires et le fichier sont présents.
        if not all([category_slug, sub_item_slug, file, file.filename]):
            flash("Données manquantes. Veuillez tout sélectionner et choisir un fichier.", "error")
            return redirect(redirect_url)

        # --- Étape 2 : Valider le type de fichier ---
        # S'assurer que le nom du fichier se termine bien par '.pdf' (insensible à la casse).
        if not file.filename.lower().endswith('.pdf'):
            flash("Fichier invalide. Seuls les PDF sont autorisés.", "error")
            return redirect(redirect_url)

        # --- Étape 3 : Valider les données par rapport au fichier de configuration des guides ---
        # Cette fonction pourrait lever une exception si le fichier n'est pas trouvé.
        guides_data = load_guides_data() 
        if category_slug not in guides_data or sub_item_slug not in guides_data[category_slug]['sub_items']:
            flash("Catégorie ou sous-item de guide invalide.", "error")
            return redirect(redirect_url)

        # --- Étape 4 : Logique de sauvegarde du fichier (le cœur de la solution) ---

        # (a) S'assurer que le dossier de destination existe. S'il n'existe pas, le créer.
        # 'exist_ok=True' évite une erreur si le dossier existe déjà.
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # (b) Obtenir le nom de fichier sécurisé depuis guides.json et construire le chemin complet.
        filename = guides_data[category_slug]['sub_items'][sub_item_slug]['pdf']
        secure_name = secure_filename(filename)
        upload_path = os.path.join(UPLOAD_FOLDER, secure_name)

        # (c) Sauvegarder le fichier téléversé à l'emplacement spécifié.
        file.save(upload_path)

        # --- Étape 5 : Afficher un message de succès à l'utilisateur ---
        title = guides_data[category_slug]['sub_items'][sub_item_slug]['title']
        flash(f'Le document pour "{title}" a été mis à jour avec succès.', "success")

    except FileNotFoundError:
        # Gérer spécifiquement le cas où 'data/guides.json' est introuvable.
        flash("Erreur critique : le fichier de configuration des guides (guides.json) est introuvable.", "error")
        current_app.logger.error("Le fichier 'data/guides.json' n'a pas été trouvé.")
        
    except Exception as e:
        # Capturer toute autre erreur inattendue (permissions d'écriture, disque plein, etc.).
        flash(f"Une erreur inattendue est survenue lors de la sauvegarde : {e}", "error")
        # Enregistrer l'erreur complète dans les logs du serveur pour le débogage.
        current_app.logger.error(f"Erreur imprévue dans update_documentation_pdf : {e}", exc_info=True)

    # Dans tous les cas (succès ou erreur gérée), rediriger l'utilisateur.
    return redirect(redirect_url)


@admin.route('/toggle-user-status/<string:user_email>', methods=['POST'])
@login_required
@admin_required
def toggle_user_status(user_email):
    """Active ou désactive un compte utilisateur en utilisant SQLite."""
    user_found = find_user_by_email(user_email)
    
    if user_found:
        # On inverse la valeur booléenne actuelle du champ 'actif'
        user_found['actif'] = not user_found.get('actif', False)
        update_user(user_found) # Met à jour l'utilisateur dans la base de données
        flash(f"Le statut de l'utilisateur {user_email} a été mis à jour avec succès.", "success")
    else:
        flash("Utilisateur non trouvé.", "danger")
        
    return redirect(url_for('admin.gestion_comptes'))

# La notion de "whitelist" devient la liste des utilisateurs dans la base de données.
# Gérer une "whitelist" séparée devient redondant.
# La nouvelle logique est : "Ajouter un nouvel utilisateur (inactif)"
@admin.route('/add-user', methods=['POST'])
@login_required
@admin_required
def add_user():
    """
    Ajoute un nouvel utilisateur à la base de données (en tant qu'invitation).
    Ceci remplace la logique "add-to-whitelist".
    """
    email_to_add = request.form.get('email', '').lower().strip()

    if not email_to_add or "@" not in email_to_add:
        flash("Veuillez fournir une adresse e-mail valide.", "warning")
        return redirect(url_for('admin.gestion_comptes'))

    if find_user_by_email(email_to_add):
        flash(f"Un compte pour {email_to_add} existe déjà.", "info")
        return redirect(url_for('admin.gestion_comptes'))

    # Créer un nouvel utilisateur avec des valeurs par défaut
    new_user = {
        'email': email_to_add,
        'nom': email_to_add.split('@')[0],
        'password_hash': '', # Pas de mot de passe au début
        'recovery_code': generate_recovery_code(), # On lui donne un code d'activation
        'role': 'user', # Rôle par défaut
        'actif': True, # L'admin peut le désactiver plus tard
        'confirmed': False, # Doit être confirmé
        'is_protected': False
    }
    
    update_user(new_user) # La fonction 'update_user' créera l'utilisateur car il n'existe pas
    
    flash(f"L'utilisateur {email_to_add} a été invité. Il peut maintenant finaliser son inscription.", "success")
    return redirect(url_for('admin.gestion_comptes'))


@admin.route('/delete-user/<string:email>', methods=['POST'])
@login_required
@admin_required
def delete_user_route(email):
    """Supprime un utilisateur de la base de données."""
    protected_admins = get_protected_admins()
    if email in protected_admins:
        flash(f"Suppression refusée. L'utilisateur {email} est protégé.", "danger")
        return redirect(url_for('admin.gestion_comptes'))
        
    if find_user_by_email(email):
        delete_user(email) # Nouvelle fonction à ajouter dans utils.py
        flash(f"L'utilisateur {email} a été supprimé avec succès.", "success")
    else:
        flash("L'utilisateur n'a pas été trouvé.", "warning")
        
    return redirect(url_for('admin.gestion_comptes'))

# =======================================================
# ROUTES API POUR LA GESTION DES COMPTES
# =======================================================

@admin.route('/api/comptes', methods=['GET'])
@admin_required
def get_comptes():
    """
    Retourne la liste complète de tous les utilisateurs depuis la base de données.
    """
    try:
        tous_les_utilisateurs = get_all_users()
        admin_actuel_email = current_user.get_id()

        # On cache les codes de récupération des autres admins protégés
        for user in tous_les_utilisateurs:
            if user['is_protected'] and user['email'] != admin_actuel_email:
                user.pop('recovery_code', None)
        
        return jsonify(tous_les_utilisateurs)
        
    except Exception as e:
        current_app.logger.error(f"Erreur lors de la lecture des comptes : {e}")
        return jsonify({"erreur": "Impossible de charger les données des utilisateurs."}), 500


@admin.route('/api/comptes', methods=['POST'])
@admin_required
def save_comptes():
    """
    Sauvegarde une liste d'utilisateurs dans la base de données.
    Gère l'ajout, la modification et la suppression.
    """
    try:
        comptes_recus = request.get_json()
        if not isinstance(comptes_recus, list):
            abort(400, "Données invalides : une liste est attendue.")

        utilisateurs_actuels_db = get_all_users()
        emails_actuels_db = {u['email'] for u in utilisateurs_actuels_db}
        emails_recus = {c['email'] for c in comptes_recus}
        protected_admins = get_protected_admins()

        nouvel_utilisateur_info = None

        # --- Gérer les suppressions ---
        emails_a_supprimer = emails_actuels_db - emails_recus
        for email in emails_a_supprimer:
            if email in protected_admins:
                return jsonify({"succes": False, "erreur": f"Suppression refusée. L'utilisateur {email} est protégé."}), 403
            delete_user(email)

        # --- Gérer les ajouts et modifications ---
        for compte in comptes_recus:
            email = compte.get('email')
            if not email:
                continue

            # Logique pour la génération de code pour un nouvel utilisateur
            if email not in emails_actuels_db:
                compte['recovery_code'] = generate_recovery_code()
                compte['password_hash'] = '' # Un nouvel utilisateur n'a pas de mot de passe
                compte['confirmed'] = False # Doit confirmer son compte
                nouvel_utilisateur_info = compte
            
            # Valider les admins protégés
            if email in protected_admins and (not compte.get('actif') or compte.get('role') != 'admin'):
                return jsonify({"succes": False, "erreur": f"Modification refusée. L'utilisateur {email} est protégé."}), 403
            
            # Valider qu'il reste au moins un admin actif
            admins_actifs = sum(1 for c in comptes_recus if c.get('role') == 'admin' and c.get('actif'))
            if admins_actifs < 1:
                return jsonify({"succes": False, "erreur": "Opération refusée. Il doit rester au moins un administrateur actif."}), 400

            update_user(compte) # Met à jour ou insère l'utilisateur dans la DB

        # --- Réponse au frontend ---
        response_data = {
            "succes": True,
            "message": "Comptes mis à jour avec succès."
        }
        if nouvel_utilisateur_info:
            response_data["message"] = "Compte ajouté avec succès."
            # On retourne l'info complète avec le code généré
            response_data["nouvel_utilisateur"] = nouvel_utilisateur_info
        
        return jsonify(response_data)

    except Exception as e:
        current_app.logger.error(f"Erreur lors de la sauvegarde des comptes : {e}", exc_info=True)
        return jsonify({"succes": False, "erreur": "Une erreur interne est survenue lors de la sauvegarde."}), 500


@admin.route('/api/comptes/<string:user_email>/regenerate-code', methods=['POST'])
@admin_required
def regenerate_recovery_code(user_email):
    """Régénère le code de récupération pour un utilisateur spécifique."""
    try:
        user_found = find_user_by_email(user_email)
        
        if not user_found:
            return jsonify({"succes": False, "erreur": "Utilisateur non trouvé."}), 404

        nouveau_code = generate_recovery_code()
        user_found['recovery_code'] = nouveau_code
        update_user(user_found) # Sauvegarde le changement dans la DB
        
        return jsonify({
            "succes": True, 
            "message": f"Le code pour {user_email} a été régénéré.",
            "nouveau_code": nouveau_code
        })
    except Exception as e:
        current_app.logger.error(f"Erreur lors de la régénération du code pour {user_email}: {e}")
        return jsonify({"succes": False, "erreur": "Une erreur interne est survenue."}), 500