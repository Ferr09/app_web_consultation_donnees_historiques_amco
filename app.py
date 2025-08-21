# app.py
from datetime import timedelta
import os
from flask import Flask, current_app
from flask_login import UserMixin
from itsdangerous import URLSafeTimedSerializer
from supabase import create_client, Client
from werkzeug.security import generate_password_hash, check_password_hash

from config import DevelopmentConfig, ProductionConfig
# On importe nos instances d'extensions depuis le nouveau fichier
from extensions import login_manager, oauth
# Dans auth.py
from utils import (
    find_user_by_email, 
    update_user, 
    get_all_users, 
    delete_user,
    get_protected_admins,
    generate_recovery_code
)


# --- 1. EXTENSIONS GLOBALES (non initialisées) ---
# Seules les extensions qui utilisent le pattern .init_app(app) restent ici.
# Elles sont créées "vides" et seront liées à une instance de l'application
# plus tard dans la fonction create_app. C'est la bonne pratique.

# --- 2. MODÈLE UTILISATEUR ET USER LOADER ---

class Utilisateur(UserMixin):
    """
    Classe utilisateur pour Flask-Login, conçue pour fonctionner avec les données de la base de données SQLite.
    Elle prend un dictionnaire de données utilisateur et le transforme en un objet Python fonctionnel.
    """
    def __init__(self, user_data_dict):
        # On stocke le dictionnaire complet pour un accès facile à toutes les données
        self.data = user_data_dict
        
        # On définit les attributs principaux pour un accès direct et la clarté
        self.id = self.data.get('email')
        self.email = self.data.get('email')
        self.nom = self.data.get('nom')
        self.password_hash = self.data.get('password_hash')
        
        # Le rôle est lu directement depuis les données de la base de données.
        # Plus besoin de le passer en paramètre séparé.
        self.role = self.data.get('role', 'user') # 'user' comme valeur par défaut sécurisée

    # -----------------------------------------------------------------
    # Méthodes requises ou recommandées par Flask-Login
    # -----------------------------------------------------------------

    def get_id(self):
        """Requis par Flask-Login. Retourne l'e-mail de l'utilisateur."""
        return self.id

    @property
    def is_active(self):
        """Requis par Flask-Login. Vérifie si le compte est marqué comme 'actif'."""
        # La valeur de la DB est 1 (vrai) ou 0 (faux)
        return self.data.get('actif') == 1

    # -----------------------------------------------------------------
    # Méthodes personnalisées pour notre logique applicative
    # -----------------------------------------------------------------

    def is_admin(self):
        """Vérifie si le rôle de l'utilisateur est 'admin'."""
        return self.role == 'admin'
    
    def is_protected(self):
        """Vérifie si l'utilisateur est un admin protégé."""
        return self.data.get('is_protected') == 1
         
    def is_confirmed(self):
        """Vérifie si le compte de l'utilisateur a été confirmé."""
        return self.data.get('confirmed') == 1

    def check_password(self, password_a_verifier):
        """Vérifie si un mot de passe fourni correspond au hash stocké."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password_a_verifier)


@login_manager.user_loader
def load_user(user_id):
    """
    Charge les données de l'utilisateur depuis la base de données SQLite,
    puis crée et retourne un objet Utilisateur complet.
    """
    # Étape 1: Trouver les données de l'utilisateur dans la base de données.
    user_data = find_user_by_email(user_id)

    if not user_data:
        return None

    # Étape 2: Créer l'objet Utilisateur en lui passant le dictionnaire de données.
    return Utilisateur(user_data)

# =======================================================
# ==== LA FABRIQUE D'APPLICATIONS (APPLICATION FACTORY) ====
# =======================================================
def create_app():
    app = Flask(__name__)
    
    app.config['SERVER_NAME'] = os.getenv('FLASK_SERVER_NAME', 'localhost:5000')
    app.config['SETUP_CODE'] = os.getenv('SETUP_CODE')
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30)  # Durée de vie des sessions

    env_config = os.environ.get('FLASK_ENV', 'development')
    config_object = ProductionConfig if env_config == 'production' else DevelopmentConfig
    app.config.from_object(config_object)
    
    print(f"🔧 Démarrage en mode : {env_config}")

    global serializer, db_disponible, supabase
    
    # --- Initialisation des extensions importées ---
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    oauth.init_app(app) # Initialise l'objet oauth importé
    
    # On enregistre le client Google sur l'objet oauth importé
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

    tenant_id = app.config.get('AZURE_TENANT_ID')

    
    if not tenant_id:
        raise ValueError("La variable d'environnement AZURE_TENANT_ID n'est pas configurée.")


    oauth.register(
        name='microsoft',
        client_id=app.config['AZURE_CLIENT_ID'],
        client_secret=app.config['AZURE_CLIENT_SECRET'],
        server_metadata_url=f"https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration",
        client_kwargs={
            'scope': 'openid profile email User.Read'
        }
    )
    
    # Le serializer est toujours créé ici car il dépend de la config de l'app
    from itsdangerous import URLSafeTimedSerializer
    app.serializer = URLSafeTimedSerializer(app.config['SECRET_KEY'])   
    
    url, key = app.config.get('SUPABASE_URL'), app.config.get('SUPABASE_KEY')
    if url and key:
        app.supabase = create_client(url, key)
        app.db_disponible = True
        print("✅ Connexion à Supabase initialisée.")
    else:
        app.supabase = None
        app.db_disponible = False
        print("ℹ️ Connexion à Supabase ignorée.")
        
    app.config['USERS_FILE'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'users.json')
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'pdfs')

    with app.app_context():
        from auth import auth as auth_blueprint
        app.register_blueprint(auth_blueprint, url_prefix='/auth')
        
        from main_routes import main as main_blueprint
        app.register_blueprint(main_blueprint)
        
        from admin import admin as admin_blueprint
        app.register_blueprint(admin_blueprint, url_prefix='/admin')

    return app

# On appelle la factory pour créer l'instance de l'application.
# Cette variable 'app' est maintenant globale et Vercel pourra la trouver.
app = create_app()
# --- Point d'entrée pour l'exécution directe ---
if __name__ == '__main__':
    app.run(debug=app.config['DEBUG'])