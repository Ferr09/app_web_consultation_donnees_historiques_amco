# auth.py
import json
from flask import Blueprint, render_template, request, flash, redirect, url_for, current_app, session
from werkzeug.security import generate_password_hash, check_password_hash
import json
from functools import wraps
from flask import Blueprint, request, render_template, flash, redirect, url_for, current_app
from flask_login import login_user, logout_user, login_required, current_user
from forms import LoginForm
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadTimeSignature
from utils import (
    find_user_by_email, 
    update_user, 
    get_all_users, 
    delete_user,
    get_protected_admins,
    generate_recovery_code,
    find_user_by_microsoft_id, 
    update_user_microsoft_id,
    load_guides_data
)
from decorators import ip_whitelist_required


# On importe les extensions initialisées dans app.py.
# Cela fonctionnera grâce à la structure de la fabrique d'application.
from extensions import oauth
from app import load_user, Utilisateur
from werkzeug.security import check_password_hash

# On crée un Blueprint. 'auth' est le nom qui sera utilisé dans url_for (ex: 'auth.login')
auth = Blueprint('auth', __name__)

# auth.py — utilitaires OIDC universels (AAD v2, v1 et B2C)

import base64
import json as pyjson
import re
import requests
from authlib.jose import jwt, JsonWebKey
from flask import current_app

auth.before_request(ip_whitelist_required)

# =======================================================
# Routes d'Authentification
# =======================================================

@auth.route('/confirm/<token>')
def confirm_email(token):
    """Gère la confirmation de l'e-mail via le token."""
    try:
        email = current_app.serializer.loads(token, salt='email-confirm-salt', max_age=3600)
    except:
        flash("Le lien de confirmation est invalide ou a expiré.", "danger")
        return redirect(url_for('auth.login'))

    # NOUVELLE LOGIQUE SQLITE
    user_data = find_user_by_email(email)
    if user_data:
        user_data['confirmed'] = True
        update_user(user_data) # Met à jour l'utilisateur dans la base de données
        flash("Votre e-mail a été confirmé ! Un administrateur doit maintenant approuver votre compte.", "success")
    else:
        flash("Utilisateur non trouvé.", "danger")
        
    return redirect(url_for('auth.login'))


@auth.route('/login', methods=['GET','POST'])
def login():
    """Gère la connexion des utilisateurs avec SQLite."""
    if request.method == 'GET':
        return render_template('login.html')

    if request.method == 'POST':
        email = request.form.get('email', '').lower().strip()
        password_fourni = request.form.get('password', '')

        # NOUVELLE LOGIQUE SQLITE
        user_data = find_user_by_email(email)

        if not user_data:
            flash("Adresse e-mail ou mot de passe incorrect.", "danger")
            return redirect(url_for('auth.login'))

        password_hash_stocke = user_data.get('password_hash')
        if not password_hash_stocke:
            flash("Ce compte n'a pas encore de mot de passe défini. Veuillez compléter votre inscription ou réinitialiser votre mot de passe.", "warning")
            return redirect(url_for('auth.login'))

        if not check_password_hash(password_hash_stocke, password_fourni):
            flash("Adresse e-mail ou mot de passe incorrect.", "danger")
            return redirect(url_for('auth.login'))

        if not user_data.get('actif', False):
            flash("Votre compte a été désactivé par un administrateur.", "danger")
            return redirect(url_for('auth.login'))

        if not user_data.get('confirmed', False):
            flash("Votre compte n'est pas encore activé. Veuillez vérifier votre e-mail de confirmation.", "warning")
            return redirect(url_for('auth.login'))

        utilisateur = load_user(email)
        if utilisateur:
            login_user(utilisateur)
            return redirect(url_for('main.filtre_requete'))
        else:
            flash("Une erreur inattendue est survenue lors de la connexion.", "danger")
            return redirect(url_for('auth.login'))

    return render_template('login.html')


@auth.route('/login/email', methods=['GET'])
def login_local():
    """Affiche la page de connexion dédiée à l'e-mail et au mot de passe."""
    return render_template('login_local.html')



@auth.route('/resend-confirmation', methods=['GET', 'POST'])
def resend_confirmation():
    """Permet de renvoyer un e-mail de confirmation."""
    if request.method == 'POST':
        email = request.form.get('email', '').lower().strip()
        if not email:
            flash("Veuillez entrer une adresse e-mail.", "warning")
            return redirect(url_for('auth.resend_confirmation'))

        # NOUVELLE LOGIQUE SQLITE
        user_data = find_user_by_email(email)

        if not user_data or user_data.get('confirmed', False):
            flash("Si un compte correspondant existe et n'est pas activé, un e-mail a été envoyé.", "info")
            return redirect(url_for('auth.login'))
        
        # Le reste est ok car il ne dépend pas de la source de données
        token = current_app.serializer.dumps(email, salt='email-confirm-salt')
        # ... (logique d'envoi d'email) ...
        flash("Un nouvel e-mail de confirmation a été envoyé.", "success")
        return redirect(url_for('auth.login'))

    return render_template('resend_confirmation.html')

def valider_mot_de_passe(password):
    """Valide la complexité du mot de passe."""
    erreurs = []
    if len(password) < 8:
        erreurs.append("Doit contenir au moins 8 caractères.")
    if not re.search(r"[a-z]", password):
        erreurs.append("Doit contenir au moins une lettre minuscule.")
    if not re.search(r"[A-Z]", password):
        erreurs.append("Doit contenir au moins une lettre majuscule.")
    if not re.search(r"[0-9]", password):
        erreurs.append("Doit contenir au moins un chiffre.")
    if not re.search(r"[!@#$%^&*(),.?:{}|<>]", password):
        erreurs.append("Doit contenir au moins un caractère spécial.")
    return erreurs


@auth.route('/register', methods=['GET', 'POST'])
def register():
    """
    ÉTAPE 1 DE L'INSCRIPTION.
    Gère la création sécurisée du premier Super-Admin via un code de configuration.
    """
    if request.method == 'POST':
        email = request.form.get('email', '').lower().strip()
        code = request.form.get('code', '').strip()

        tous_les_utilisateurs = get_all_users()
        est_premier_utilisateur = not tous_les_utilisateurs

        # --- NOUVELLE LOGIQUE SÉCURISÉE POUR LE SUPER-ADMIN ---
        if est_premier_utilisateur:
            # On récupère le code maître depuis la configuration de l'app
            setup_code = current_app.config.get('SETUP_CODE')

            if not setup_code:
                # Sécurité : si le code n'est pas configuré, on bloque la création.
                flash("Erreur de configuration serveur : le code d'initialisation n'est pas défini.", "danger")
                return redirect(url_for('auth.register'))

            # On vérifie si le code fourni correspond au code maître
            if code == setup_code:
                session['register_email'] = email
                session['is_super_admin_setup'] = True
                return redirect(url_for('auth.register_set_password'))
            else:
                # Le code est incorrect, on affiche une erreur générique.
                flash("Le code d'activation est invalide.", "danger")
                return redirect(url_for('auth.register'))

        # --- La logique pour les utilisateurs normaux reste inchangée ---
        else:
            user_data = find_user_by_email(email)
            if user_data and user_data.get('recovery_code') == code and not user_data.get('password_hash'):
                session['register_email'] = email
                return redirect(url_for('auth.register_set_password'))
            
            elif user_data and user_data.get('password_hash'):
                flash("Un compte existe déjà pour cet e-mail. Veuillez vous connecter.", "info")
                return redirect(url_for('auth.login'))
            
            else:
                flash("L'adresse e-mail ou le code d'activation est invalide.", "danger")
                return redirect(url_for('auth.register'))

    # La partie GET reste la même, l'utilisateur ne sait pas qu'il y a une logique spéciale
    return render_template('verify_identity.html',
                           titre_page="Inscription",
                           titre_formulaire="Créer un compte",
                           sous_titre_formulaire="Veuillez entrer votre e-mail et votre code d'activation.",
                           action_formulaire=url_for('auth.register'),
                           label_code="Code d'Activation",
                           placeholder_code="Entrez votre code ici",
                           texte_bouton="Vérifier et continuer")

@auth.route('/reset-password/verify', methods=['GET', 'POST'])
def reset_verify_code():
    """ÉTAPE 1 DE LA RÉINITIALISATION avec SQLite."""
    if request.method == 'POST':
        email = request.form.get('email', '').lower().strip()
        recovery_code = request.form.get('code', '').strip()

        # NOUVELLE LOGIQUE SQLITE
        user_data = find_user_by_email(email)

        if user_data and user_data.get('recovery_code') == recovery_code:
            session['reset_email'] = email
            return redirect(url_for('auth.reset_set_password'))
        else:
            flash("L'adresse e-mail ou le code de récupération est incorrect.", "danger")
            return redirect(url_for('auth.reset_verify_code'))

    # Pour la méthode GET, on affiche la même plantilla avec les textes pour la réinitialisation.
    return render_template('verify_identity.html',
                           titre_page="Mot de passe oublié",
                           titre_formulaire="Mot de passe oublié ?",
                           sous_titre_formulaire="Utilisez votre code de récupération permanent pour continuer.",
                           action_formulaire=url_for('auth.reset_verify_code'),
                           label_code="Votre Code de Récupération",
                           placeholder_code="Ex: RCV-ABCD-1234",
                           texte_bouton="Vérifier et continuer")



@auth.route('/register/set-password', methods=['GET', 'POST'])
def register_set_password():
    """ÉTAPE 2 DE L'INSCRIPTION avec SQLite."""
    email = session.get('register_email')
    if not email:
        return redirect(url_for('auth.register'))

    if request.method == 'POST':
        password = request.form.get('new_password')
        # ... (Tu código de validación de contraseña es correcto, no necesita cambios) ...
        if password != request.form.get('confirm_password'):
            flash("Les mots de passe ne correspondent pas.", "danger")
            return redirect(url_for('auth.register_set_password'))
        erreurs_validation = valider_mot_de_passe(password)
        if erreurs_validation:
            for erreur in erreurs_validation:
                flash(erreur, "danger")
            return redirect(url_for('auth.register_set_password'))

        # NOUVELLE LOGIQUE SQLITE
        if session.get('is_super_admin_setup'):
            nouvel_admin = {
                "email": email, "nom": "Super Administrateur", "actif": True,
                "password_hash": generate_password_hash(password), "confirmed": True,
                "recovery_code": generate_recovery_code(), "role": "admin",
                "is_protected": True
            }
            update_user(nouvel_admin) # Crée le nouvel admin dans la DB
            flash("Compte Super Administrateur créé ! Vous pouvez maintenant vous connecter.", "success")
        else:
            utilisateur_a_modifier = find_user_by_email(email)
            if utilisateur_a_modifier:
                utilisateur_a_modifier['password_hash'] = generate_password_hash(password)
                utilisateur_a_modifier['confirmed'] = True # On le confirme aussi
                update_user(utilisateur_a_modifier) # Met à jour la DB
                flash("Votre compte a été activé avec succès.", "success")
            else:
                flash("Erreur critique : utilisateur non trouvé.", "danger")
                return redirect(url_for('auth.login'))

        session.pop('register_email', None)
        session.pop('is_super_admin_setup', None)
        return redirect(url_for('auth.login'))

    # La partie GET reste la même
    return render_template('set_password.html',
                           titre_page="Finaliser l'inscription",
                           titre_formulaire="Activer votre compte",
                           sous_titre_formulaire="Veuillez maintenant définir un mot de passe sécurisé pour votre compte.",
                           action_formulaire=url_for('auth.register_set_password'),
                           label_mot_de_passe="Votre mot de passe",
                           texte_bouton="Activer et créer mon compte")




@auth.route('/reset-password/set', methods=['GET', 'POST'])
def reset_set_password():
    """
    ÉTAPE 2 DE LA RÉINITIALISATION : Définit le nouveau mot de passe.
    CORRIGÉ : Trouve l'utilisateur dans la structure de données et le modifie directement.
    """
    email_a_reinitialiser = session.get('reset_email')
    if not email_a_reinitialiser:
        flash("Veuillez d'abord vérifier votre code de récupération.", "warning")
        return redirect(url_for('auth.reset_verify_code'))

    if request.method == 'POST':
        new_password = request.form.get('new_password')
        # ... (Tu código de validación de contraseña es correcto) ...
        if new_password != request.form.get('confirm_password'):
            flash("Les mots de passe ne correspondent pas.", "danger")
            return redirect(url_for('auth.reset_set_password'))
        erreurs_validation = valider_mot_de_passe(new_password)
        if erreurs_validation:
            for erreur in erreurs_validation:
                flash(erreur, "danger")
            return redirect(url_for('auth.reset_set_password'))

        user_data = find_user_by_email(email_a_reinitialiser)
        if user_data:
            user_data['password_hash'] = generate_password_hash(new_password)
            update_user(user_data) # Met à jour la DB
            session.pop('reset_email', None)
            flash("Votre mot de passe a été mis à jour avec succès.", "success")
            return redirect(url_for('auth.login'))
        else:
            flash("Erreur : utilisateur non trouvé.", "danger")
            return redirect(url_for('auth.login'))

    return render_template('set_password.html',
                           titre_page="Nouveau mot de passe",
                           titre_formulaire="Définir un nouveau mot de passe",
                           sous_titre_formulaire="Votre identité a été vérifiée. Veuillez définir votre nouveau mot de passe.",
                           action_formulaire=url_for('auth.reset_set_password'),
                           label_mot_de_passe="Nouveau mot de passe",
                           texte_bouton="Mettre à jour le mot de passe")





# --- Routes pour Google OAuth ---
@auth.route('/login-google')
def login_google():
    """Redirige vers Google pour l'authentification."""
    # On déconnecte l'utilisateur AVANT de commencer une nouvelle authentification.
    # Ceci prévient la vulnérabilité de fixation de session.
    logout_user()

    redirect_uri = url_for('auth.callback_google', _external=True)

    try:
        # CETTE LIGNE FAIT UN APPEL RÉSEAU ET PEUT ÉCHOUER
        return oauth.google.authorize_redirect(redirect_uri, prompt='select_account')
    except Exception as e:
        # On capture l'erreur, on informe l'utilisateur et on le redirige
        current_app.logger.exception("Erreur réseau lors de la redirection vers Google: %s", e)
        flash("Le service Google n'est pas joignable pour le moment. Veuillez réessayer plus tard ou utiliser une autre méthode.", "warning")
        return redirect(url_for('auth.login'))

@auth.route('/login-microsoft')
def login_microsoft():
    """Redirige vers Microsoft pour l'authentification, avec gestion robuste des erreurs réseau."""
    # On déconnecte l'utilisateur AVANT de commencer une nouvelle authentification.
    logout_user()

    redirect_uri = url_for('auth.callback_microsoft', _external=True)

    try:
        return oauth.microsoft.authorize_redirect(redirect_uri, prompt='select_account')
    except Exception as e:
        session.clear()
        current_app.logger.exception("Erreur réseau lors de authorize_redirect Microsoft: %s", e)
        flash("Microsoft n'est pas joignable pour le moment. Réessayez plus tard.", "warning")
        return redirect(url_for('auth.login'))

@auth.route('/callback-google')
def callback_google():
    """Gère la réponse de Google après l'authentification."""
    try:
        # CES DEUX LIGNES FONT DES APPELS RÉSEAU ET PEUVENT ÉCHOUER
        token = oauth.google.authorize_access_token()
        user_info = oauth.google.userinfo()
    except Exception as e:
        # On capture l'erreur de communication
        session.clear() # Important pour nettoyer une session potentiellement corrompue
        current_app.logger.exception("Erreur de communication dans le callback Google: %s", e)
        flash("Une erreur de communication est survenue avec Google. Veuillez réessayer.", "danger")
        return redirect(url_for('auth.login'))

    # Si les appels réseau ont réussi, on continue la logique
    email = user_info['email'].lower()
    utilisateur = load_user(email)

    if utilisateur and utilisateur.is_active:
        login_user(utilisateur, remember=True)
        session.permanent = True
        return redirect(url_for('main.filtre_requete'))
    else:
        flash(f"L'utilisateur {email} n'est pas autorisé ou son compte est désactivé.", "error")
        return redirect(url_for('auth.login'))
    
    
@auth.route('/callback-microsoft')
def callback_microsoft():
    """Callback Microsoft sans validation locale de l'ID Token (évite jwks_uri manquant)."""
    try:
        # 1) Récupération manuelle du code d'autorisation
        token = oauth.microsoft.authorize_access_token()

        if not token or 'access_token' not in token:
            session.clear()
            flash("Réponse Microsoft invalide (access_token manquant).", "danger")
            return redirect(url_for('auth.login'))

        # 2) Appel à Microsoft Graph /oidc/userinfo pour vérifier la validité du token
        endpoint_url = 'https://graph.microsoft.com/v1.0/me?$select=id'

        userinfo_resp = oauth.microsoft.get(endpoint_url,
                                            token=token)
        if userinfo_resp.status_code != 200:
            session.clear()
            current_app.logger.error("Echec userinfo Microsoft: %s %s",
                                     userinfo_resp.status_code, userinfo_resp.text)
            flash("Impossible de valider votre session Microsoft.", "danger")
            return redirect(url_for('auth.login'))

        userinfo = userinfo_resp.json()
        microsoft_user_id = userinfo.get('id')
        
        # On extrait spécifiquement le champ 'mail' pour le vérifier
        user_email = userinfo.get('mail')

        if not microsoft_user_id:
            # 1. Informer l'utilisateur de manière simple
            flash("La réponse de Microsoft était invalide ou incomplète (ID utilisateur manquant). Veuillez réessayer.", "danger")
            
            # 2. Enregistrer l'erreur pour le développeur (très important !)
            current_app.logger.error("Erreur critique dans le callback Microsoft : l'ID utilisateur est manquant dans la réponse de l'API. Réponse reçue : %s", userinfo)
            
            # 3. Nettoyer la session pour éviter les états corrompus
            session.clear()
            
            # 4. Renvoyer l'utilisateur vers la page de connexion en toute sécurité
            return redirect(url_for('auth.login'))
        
        # 1. Obtenir les DONNÉES BRUTES (dictionnaire) depuis la base de données
        user_data_dict = find_user_by_microsoft_id(microsoft_user_id)
        
        # On initialise notre variable utilisateur à None
        utilisateur = None 

        # 2. Si on a trouvé des données, on les "enveloppe" dans notre objet Utilisateur
        if user_data_dict:
            utilisateur = Utilisateur(user_data_dict)

        # 3. Si on n'a pas trouvé d'utilisateur par ID, on tente la liaison par e-mail
        if not utilisateur and userinfo.get('mail'):
            user_email = userinfo.get('mail').lower().strip()
            user_data_dict_by_email = find_user_by_email(user_email)
            
            if user_data_dict_by_email:
                # On a trouvé l'utilisateur par e-mail, on le met à jour et on l'enveloppe
                update_user_microsoft_id(user_email, microsoft_user_id)
                utilisateur = Utilisateur(user_data_dict_by_email)

        if not utilisateur:
            # (Rediriger vers la page de liaison ou afficher une erreur)
            # Votre logique de redirection vers link_account va ici
            session['microsoft_id_to_link'] = microsoft_user_id
            flash("C'est la première fois...", "info")
            return redirect(url_for('auth.link_account'))

        if not utilisateur.is_active:
            flash(f"L'utilisateur {utilisateur.email} n'est pas autorisé ou son compte est désactivé.", "error")
            return redirect(url_for('auth.login'))


        login_user(utilisateur, remember=True)
        session.permanent = True
        return redirect(url_for('main.filtre_requete'))

    except Exception as e:
        session.clear()
        current_app.logger.exception("Erreur callback Microsoft: %s", e)
        flash(f"Une erreur est survenue lors de l'authentification avec Microsoft : {e}", "danger")
        return redirect(url_for('auth.login'))
    

@auth.route('/link-account', methods=['GET', 'POST'])
def link_account():
    if 'microsoft_id_to_link' not in session:
        return redirect(url_for('auth.login'))

    form = LoginForm()

    # Si la página se carga por primera vez (GET), reiniciamos el contador de intentos
    if request.method == 'GET':
        session['link_attempts'] = 0

    if form.validate_on_submit():
        email = form.email.data.lower()
        password = form.password.data
        
        # On utilise votre logique de chargement d'utilisateur existante
        utilisateur_data = find_user_by_email(email)
        utilisateur = Utilisateur(utilisateur_data) if utilisateur_data else None

        # =======================================================
        # ==== LA LOGIQUE DE SUCCÈS ET D'ÉCHEC EST ICI ====
        # =======================================================

        # CAS DE SUCCÈS : L'utilisateur existe ET le mot de passe est correct
        if utilisateur and utilisateur.check_password(password):
            microsoft_id = session.pop('microsoft_id_to_link', None)
            
            if microsoft_id:
                update_user_microsoft_id(email, microsoft_id)
            
            # On réinitialise le compteur d'essais en cas de succès
            session.pop('link_attempts', None)
            
            login_user(utilisateur, remember=True)
            flash("Votre compte Microsoft a été lié avec succès !", "success")
            return redirect(url_for('main.filtre_requete'))
        
        # CAS D'ÉCHEC : L'utilisateur n'existe pas OU le mot de passe est incorrect
        else:
            # On incrémente le compteur de tentatives d'échec
            session['link_attempts'] = session.get('link_attempts', 0) + 1

            # On vérifie si le nombre maximal de tentatives a été atteint
            if session['link_attempts'] >= 5:
                # On nettoie la session pour la sécurité
                session.pop('microsoft_id_to_link', None)
                session.pop('link_attempts', None)
                
                flash("Trop de tentatives de connexion échouées. Le processus de liaison a été annulé.", "danger")
                return redirect(url_for('auth.login')) # On le renvoie à la page de connexion principale

            # Si le nombre de tentatives n'est pas dépassé, on affiche un message d'erreur
            flash(f"Email ou mot de passe incorrect. Tentative {session['link_attempts']} sur 5.", "error")
            
            # Très important : On RE-AFFICHE la même page pour qu'il puisse réessayer
            return render_template('link_account.html', form=form)

    # Affiche la page pour la première fois (requête GET)
    return render_template('link_account.html', form=form)

@auth.route('/logout')
def logout():
    """Déconnecte l'utilisateur de manière sécurisée en nettoyant la session et les cookies."""
    logout_user()
    session.clear()
    flash("Vous avez été déconnecté.", "info")

    return redirect(url_for('auth.login'))