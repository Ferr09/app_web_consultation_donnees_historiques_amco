# main_routes.py
import os
import json
import io
from datetime import datetime
from functools import wraps
import pandas as pd
from flask import (Blueprint, Response, abort, current_app, flash, jsonify, redirect, render_template, request,
                   send_file, session, url_for, send_from_directory)
from flask_login import current_user, login_required
from werkzeug.utils import secure_filename
from utils import (
    find_user_by_email, 
    update_user, 
    get_all_users, 
    delete_user,
    get_protected_admins,
    generate_recovery_code,
    load_guides_data,
    supabase
)
from decorators import check_ip_whitelist

BUCKET_NAME = 'documentation'

# On crée le Blueprint pour toutes les routes principales de l'application
main = Blueprint('main', __name__)

main.before_request(check_ip_whitelist)
# =======================================================
# Décorateur pour les routes admin (spécifique à ce blueprint)
# =======================================================
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin():
            abort(403) # Accès Interdit
        return f(*args, **kwargs)
    return decorated_function


# =======================================================
# Fonctions Auxiliaires (utilisées par les routes de ce fichier)
# =======================================================


# DICTIONNAIRES DE MAPPAGE SÉPARÉS 

# Mappage pour les VENTES
MAPPAGE_VENTES = {
    # 'valeur' depuis JS  ->  Nom du paramètre en SQL
    "codeArticle":       "p_code_article",
    "designation":       "p_designation",
    "codeClient":        "p_code_client",
    "raisonSociale":     "p_raison_sociale",
    "qte":               "p_qte_fact",
    "erp":              "p_erp",
}

# Mappage pour les ACHATS
MAPPAGE_ACHATS = {
    # 'valeur' depuis JS  ->  Nom du paramètre en SQL
    "codeFournisseur":   "p_code_fournisseur",
    "raisonSociale":     "p_raison_sociale",
    "referenceAchat":    "p_reference_achat",
    "bonDeCommande":     "p_bon_de_commande",
    "qte":               "p_qte_fact",
    "referenceArticle":  "p_code_article", # On connecte 'referenceArticle' à 'p_code_article'
    "erp":              "p_erp",
}

def recuperer_donnees_rpc(type_transaction: str, filtres: dict) -> pd.DataFrame:
    """
    Prépare et exécute un appel RPC vers Supabase pour filtrer les données.
    Utilise un dictionnaire de mappage spécifique au type de transaction.
    """
    if not current_app.supabase:
        raise ConnectionError("La connexion à Supabase n'est pas configurée.")
        
    # --- ÉTAPE 1 : Sélectionner le nom de la RPC et le bon dictionnaire de mappage ---
    if type_transaction == 'achats':
        nom_rpc = 'rechercher_achats'
        mappage_correct = MAPPAGE_ACHATS
    else: # Par défaut, on considère 'ventes'
        nom_rpc = 'rechercher_ventes'
        mappage_correct = MAPPAGE_VENTES
    
    # --- ÉTAPE 2 : Préparation des paramètres de date (logique inchangée) ---
    params = {}
    # ... (Le code pour les dates reste exactement le même qu'avant) ...
    annee_debut_str = filtres.get('start_year')
    mois_debut_str = filtres.get('start_month')
    annee_fin_str = filtres.get('end_year')
    mois_fin_str = filtres.get('end_month')
    
    annee_debut = int(annee_debut_str) if annee_debut_str else 1900
    mois_debut = int(mois_debut_str) if mois_debut_str else 1
    params['p_date_debut'] = datetime(annee_debut, mois_debut, 1).strftime('%Y-%m-%d')
    
    aujourdhui = datetime.now()
    annee_fin = int(annee_fin_str) if annee_fin_str else aujourdhui.year
    mois_fin = int(mois_fin_str) if mois_fin_str else aujourdhui.month
    
    if mois_fin == 12:
        date_fin_obj = datetime(annee_fin + 1, 1, 1)
    else:
        date_fin_obj = datetime(annee_fin, mois_fin + 1, 1)
    params['p_date_fin'] = date_fin_obj.strftime('%Y-%m-%d')
    
    # --- ÉTAPE 3 : Traitement des filtres en utilisant le mappage correct ---
    champs_filtres = filtres.get('fields', [])
    if champs_filtres:
        for f in champs_filtres:
            champ_frontend = f.get('field')
            valeur = f.get('value')

            # On récupère l'opérateur, avec 'contains' comme valeur par défaut
            operateur = f.get('operator', 'contains') 
            
            # On utilise le dictionnaire spécifique ('MAPPAGE_VENTES' ou 'MAPPAGE_ACHATS')
            nom_parametre = mappage_correct.get(champ_frontend)

            if nom_parametre and valeur:
                if nom_parametre == 'p_qte_fact':
                    try:
                        params[nom_parametre] = float(valeur)
                    except (ValueError, TypeError):
                        continue
                else:
                    # C'est ici qu'on ajoute le préfixe si l'opérateur est 'equals'
                    if operateur == 'equals':
                        params[nom_parametre] = 'egal:' + valeur
                    else:
                        params[nom_parametre] = valeur
    
    # --- ÉTAPE 4 : Appel à la RPC et retour des résultats (logique inchangée) ---
    try:
        print(f"Appel RPC : {nom_rpc} avec les paramètres : {params}")
        response = current_app.supabase.rpc(nom_rpc, params).limit(42000).execute()
        print(f"Supabase a retourné {len(response.data)} ligne(s).")
        return pd.DataFrame(response.data) if isinstance(response.data, list) else pd.DataFrame()
    except Exception as e:
        print(f"🔥 ERREUR CRITIQUE lors de l'appel de la RPC '{nom_rpc}' : {e}")
        return pd.DataFrame()    

def generer_et_envoyer_fichier(df_filtre: pd.DataFrame, format_demande: str) -> Response:
    horodatage = datetime.now().strftime("%Y%m%d_%H%M%S")
    if format_demande == 'xlsx':
        tampon = io.BytesIO()
        df_filtre.to_excel(tampon, index=False, sheet_name='Résultats', engine='openpyxl')
        tampon.seek(0)
        return send_file(tampon, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name=f"export_{horodatage}.xlsx")
    else:
        tampon_texte = io.StringIO()
        df_filtre.to_csv(tampon_texte, index=False, sep=';', encoding='utf-8-sig')
        tampon = io.BytesIO(tampon_texte.getvalue().encode('utf-8-sig'))
        return send_file(tampon, mimetype='text/csv; charset=utf-8', as_attachment=True, download_name=f"export_{horodatage}.csv")


# =======================================================
# Routes Principales de l'Application
# =======================================================

@main.before_app_request
def rendre_session_permanente():
    session.permanent = True

@main.route('/favicon.ico')
def favicon():
    """
    Sert l'icône de l'application (favicon) depuis le dossier static.
    Ceci empêche les erreurs 404 inutiles dans les logs.
    """
    return send_from_directory(
        os.path.join(current_app.root_path, 'static'),
        'favicon.ico',
        mimetype='image/vnd.microsoft.icon'
    )


@main.route('/')
def index():
    return redirect(url_for('auth.login')) # Redirige vers la page de connexion du blueprint 'auth'

@main.route("/google8e445c41a5256094.html")  
def google_verification_html():
    return render_template("google8e445c41a5256094.html")

@main.route('/politique-confidentialite')
def politique_confidentialite():
    return render_template('politique_confidentialite.html')

@main.route('/conditions-utilisation')
def conditions_utilisation():
    return render_template('conditions_utilisation.html')

@main.route('/contact')
def contact():
    return render_template('contact.html')

@main.route('/filtre-requete')
@login_required
def filtre_requete():
    return render_template('filtre-requete.html')

@main.route('/filtre-requete/resultat-requete')
@login_required
def resultat_requete():
    return render_template('resultat-requete.html')

@main.route('/cartes-requete-avancee')
@login_required
def filtre_requete_avancee():
    return render_template('cartes-requete-avancee.html')

@main.route("/cartes-requete-avancee/filtres-requete-avancee", methods=["GET", "POST"])
@login_required
def resultat_requete_avancee():
    if request.method == "GET":
        type_transaction = request.args.get("type")
        id_requete = request.args.get("id")
        if not type_transaction or not id_requete:
            flash("Erreur : les paramètres de la requête sont manquants.", "error")
            return redirect(url_for('main.filtre_requete_avancee'))
        try:
            chemin_fichier = f"static/data_demo/{type_transaction}_requetes_avancees.json"
            with open(chemin_fichier, "r", encoding="utf-8") as f:
                toutes_les_requetes = json.load(f)
        except FileNotFoundError:
            flash(f"Erreur : le fichier de configuration pour '{type_transaction}' est introuvable.", "error")
            return redirect(url_for('main.filtre_requete_avancee'))
        requete = next((r for r in toutes_les_requetes if r["id"] == id_requete), None)
        if not requete:
            flash(f"Erreur : la requête avec l'ID '{id_requete}' n'a pas été trouvée.", "error")
            return redirect(url_for('main.filtre_requete_avancee'))
        return render_template("filtre-requete-avancee.html", requete=requete, type_transaction=type_transaction)

    if request.method == "POST":
        nom_fonction = request.form.get("nom_fonction")
        filtres_rpc = {}
        annee_debut = int(request.form.get('start_year') or 1900)
        mois_debut = int(request.form.get('start_month') or 1)
        filtres_rpc['p_date_debut'] = datetime(annee_debut, mois_debut, 1).strftime('%Y-%m-%d')
        aujourdhui = datetime.now()
        annee_fin = int(request.form.get('end_year') or aujourdhui.year)
        mois_fin = int(request.form.get('end_month') or aujourdhui.month)
        date_fin_obj = datetime(annee_fin, mois_fin + 1, 1) if mois_fin < 12 else datetime(annee_fin + 1, 1, 1)
        filtres_rpc['p_date_fin'] = date_fin_obj.strftime('%Y-%m-%d')
        noms_champs = request.form.getlist('field[]')
        valeurs_champs = request.form.getlist('value[]')
        for i in range(len(noms_champs)):
            nom_parametre_rpc = noms_champs[i]
            valeur = valeurs_champs[i]
            if nom_parametre_rpc and valeur:
                filtres_rpc[nom_parametre_rpc] = valeur
        try:
            resultat = current_app.supabase.rpc(nom_fonction, filtres_rpc).execute()
            if isinstance(resultat.data, list):
                return render_template("resultat-requete-avancee.html", donnees=resultat.data, colonnes=list(resultat.data[0].keys()) if resultat.data else [], nom_fonction=nom_fonction, filtres=filtres_rpc)
            else:
                flash(f"Erreur : Le résultat de la requête '{nom_fonction}' n'est pas valide.", "error")
                return redirect(url_for('main.filtre_requete_avancee'))
        except Exception as e:
            flash(f"Erreur lors de l'exécution de la requête : {e}", "error")
            return redirect(url_for('main.filtre_requete_avancee'))

@main.route('/documentation')
@login_required
def documentation(): 
    return render_template('documentation.html', guides_data=load_guides_data())

@main.route('/documentation/<category_slug>', defaults={'sub_item_slug': None})
@main.route('/documentation/<category_slug>/<sub_item_slug>')
@login_required
def guide_detail(category_slug, sub_item_slug):
    guides_data = load_guides_data()
    category_data = guides_data.get(category_slug)
    if not category_data or (category_slug == 'administration' and not current_user.is_admin()):
        abort(403)
    if sub_item_slug is None:
        sub_item_slug = category_data['default_sub_item']
    current_sub_item = category_data['sub_items'].get(sub_item_slug)
    if not current_sub_item:
        abort(404)
    # (a) Obtenir le nom du fichier PDF à partir de guides.json.
    pdf_filename = current_sub_item['pdf']
    
    # (b) Reconstruire le chemin exact du fichier dans le bucket Supabase.
    path_in_bucket = f"{category_slug}/{pdf_filename}"
    
    # (c) Obtenir l'URL publique et permanente du fichier depuis Supabase.
    pdf_public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(path_in_bucket)
    
    # (d) Passer cette URL à la template pour qu'elle puisse l'utiliser (par ex. dans un <iframe>).
    return render_template(
        'guide_detail.html', 
        category_data=category_data, 
        current_sub_item=current_sub_item, 
        category_slug=category_slug, 
        current_sub_item_slug=sub_item_slug,
        pdf_url=pdf_public_url  # La variable contenant le lien vers le PDF
    )

@main.route('/profil')
@login_required
def profil():
    """Affiche la page de profil de l'utilisateur connecté."""
    # On passe l'utilisateur actuel à la template pour qu'elle puisse afficher ses informations.
    return render_template('profil.html', user=current_user)


@main.route('/api/profil/regenerate-code', methods=['POST'])
@login_required
def user_regenerate_own_code():
    """
    Permet à l'utilisateur connecté de régénérer son propre code de récupération.
    Adapté pour SQLite.
    """
    user_email = current_user.get_id()
    
    # Étape 1 : Trouver l'utilisateur dans la base de données
    user_found = find_user_by_email(user_email)

    if not user_found:
        return jsonify({"succes": False, "erreur": "Utilisateur non trouvé."}), 404

    # Étape 2 : Générer un nouveau code et mettre à jour le dictionnaire de l'utilisateur
    nouveau_code = generate_recovery_code()
    user_found['recovery_code'] = nouveau_code
    
    # Étape 3 : Sauvegarder les modifications dans la base de données
    update_user(user_found)
    
    # Étape 4 : Retourner la réponse de succès
    return jsonify({
        "succes": True, 
        "message": "Votre code de récupération a été régénéré avec succès.",
        "nouveau_code": nouveau_code
    })


# =======================================================
# Fonctions Auxiliaires pour les routes API ci-dessous
# =======================================================

def read_users_data():
    """Lit le fichier users.json et retourne son contenu."""
    try:
        with open(current_app.config['USERS_FILE'], 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"admins": [], "users": []}

def write_users_data(data):
    """Écrit les données fournies dans le fichier users.json."""
    with open(current_app.config['USERS_FILE'], 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# =======================================================
# Routes API
# =======================================================

@main.route('/api/query', methods=['POST'])
@login_required
def api_query():
    """Point d'accès principal pour les requêtes RPC filtrées."""
    try:
        charge_utile = request.get_json()

        # ======================= LÍNEAS DE DEPURACIÓN =======================
        # Imprimimos TODO el JSON que llega para no tener dudas.
        print(f"DEBUG: Données JSON reçues par /api/query: {charge_utile}")
        # ====================================================================

        type_transaction = charge_utile.get('type_transaction', 'ventes')

        # ======================= LÍNEAS DE DEPURACIÓN =======================
        # Imprimimos el valor que se ha asignado a la variable.
        print(f"DEBUG: La variable 'type_transaction' a été définie à : '{type_transaction}'")
        # ====================================================================

        filtres = charge_utile.get('filtres', {})
        df_resultats = recuperer_donnees_rpc(type_transaction, filtres)
        return Response(df_resultats.to_json(orient="records", date_format="iso"), mimetype='application/json')
    except Exception as e:
        print(f"🔥 Erreur API /api/query: {e}")
        return jsonify({"erreur": str(e)}), 503


@main.route('/api/<type_transaction>/download', methods=['POST'])
@login_required
def api_telecharger_donnees(type_transaction):
    """Génère un fichier (CSV/XLSX) des données réelles filtrées."""
    if type_transaction not in ['ventes', 'achats']:
        abort(404)
    try:
        charge_utile = request.get_json()
        filtres = charge_utile.get('filtres', {})
        format_demande = charge_utile.get('format', 'csv').lower()
        df_filtre = recuperer_donnees_rpc(type_transaction, filtres)
        return generer_et_envoyer_fichier(df_filtre, format_demande)
    except Exception as e:
        return jsonify({"erreur": f"Erreur lors de la génération du fichier réel : {str(e)}"}), 500

@main.route('/api/requete-avancee/download', methods=['POST'])
@login_required
def telecharger_requete_avancee():
    """Gère le téléchargement des résultats d'une requête avancée."""
    try:
        charge = request.get_json()
        nom_fonction = charge.get("nom_fonction")
        filtres = charge.get("filtres", {})
        format_demande = charge.get("format", "csv")

        if not nom_fonction:
            return jsonify({"erreur": "Le nom de la fonction est manquant."}), 400

        resultat = current_app.supabase.rpc(nom_fonction, filtres).execute()

        if not isinstance(resultat.data, list):
            return jsonify({"erreur": "Le résultat de la requête n'est pas valide."}), 500

        df_resultats = pd.DataFrame(resultat.data)
        return generer_et_envoyer_fichier(df_resultats, format_demande)

    except Exception as e:
        return jsonify({"erreur": str(e)}), 500

# =======================================================
# Gestionnaires d'Erreurs pour ce Blueprint
# =======================================================



@main.app_errorhandler(403)
def forbidden_access(e):
    # On vérifie si l'utilisateur est authentifié
    if current_user.is_authenticated:
        # Si l'utilisateur est authentifié, on affiche une page d'erreur 403 personnalisée
        return render_template('errors/403.html'), 403
    else:
        # Sinon, on affiche une page d'erreur 403 publique
        return render_template('errors/403_public.html'), 403


@main.app_errorhandler(404)
def page_not_found(e):
    """
    Gère les erreurs de page non trouvée de manière contextuelle.
    Affiche une page d'erreur différente si l'utilisateur est connecté ou non.
    """
    # On vérifie si l'utilisateur est authentifié
    if current_user.is_authenticated:
        # Si l'utilisateur est authentifié, on affiche une page d'erreur 403 personnalisée
        return render_template('errors/404.html'), 404
    else:
        # Sinon, on affiche une page d'erreur 403 publique
        return render_template('errors/404_public.html'), 404

# Tu manejador de error 500 ya está perfecto, no necesita cambios.
@main.app_errorhandler(500)
def internal_server_error(e):
    """
    Gère les erreurs internes du serveur de manière contextuelle.
    Affiche une page d'erreur différente si l'utilisateur est connecté ou non.
    """
    current_app.logger.error(f"Erreur interne du serveur (500): {e}", exc_info=True)

    if current_user.is_authenticated:
        return render_template('errors/500_authed.html'), 500
    else:
        return render_template('errors/500_public.html'), 500