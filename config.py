# config.py
import os
from dotenv import load_dotenv


# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

class BaseConfig:
    """Configurations de base qui s'appliquent à tous les environnements."""
    # Clé secrète pour Flask, essentielle pour la sécurité (sessions, tokens, etc.)
    # Utilise la variable d'environnement ou une valeur par défaut pour la sécurité.
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY') or 'une-cle-secrete-par-defaut-vraiment-longue-et-aleatoire'
    
    
    # ... autres configs comme Google OAuth ...
    GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
    GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')

    AZURE_CLIENT_ID = os.environ.get('AZURE_CLIENT_ID')
    AZURE_CLIENT_SECRET = os.environ.get('AZURE_CLIENT_SECRET')
    AZURE_TENANT_ID = os.environ.get('AZURE_TENANT_ID')
    AZURE_REDIRECT_URI = os.environ.get('AZURE_REDIRECT_URI')


    # =======================================================
    
    # Configuration pour l'envoi d'e-mails (commune à tous les environnements)
    MAIL_SERVER = os.environ.get('MAIL_SERVER')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() in ['true', '1', 't']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')

    

class DevelopmentConfig(BaseConfig):
    """Configuration spécifique pour l'environnement de développement."""
    # Active le mode débogage de Flask, qui fournit des informations d'erreur détaillées.
    DEBUG = True
    # Pour le développement, nous ne nous connectons PAS à la base de données réelle.
    # En mettant ces valeurs à None, l'application passera en mode démo.
    SUPABASE_URL = None
    SUPABASE_KEY = None
    
    # Optionnel : Pour tester les e-mails en développement sans en envoyer de vrais,
    # vous pouvez utiliser un serveur SMTP local comme MailHog.
    MAIL_SERVER = 'localhost'
    MAIL_PORT = 1025

class ProductionConfig(BaseConfig):
    """Configuration spécifique pour l'environnement de production (déploiement réel)."""
    # Le mode débogage doit TOUJOURS être désactivé en production.
    DEBUG = False
    # En production, nous lisons les VRAIES clés d'accès à la base de données depuis les variables d'environnement.
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

