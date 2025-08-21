# extensions.py
"""
Ce fichier centralise l'initialisation des extensions Flask.
Cela évite les importations circulaires et garantit que tous les blueprints
utilisent les mêmes instances d'extensions.
"""
from flask_login import LoginManager
from flask_mail import Mail
from authlib.integrations.flask_client import OAuth
from itsdangerous import URLSafeTimedSerializer

# On crée les instances ici, SANS les lier à une application.
# Elles seront liées à l'application dans la fabrique (create_app).
login_manager = LoginManager()
mail = Mail()
oauth = OAuth()
# On ne peut pas initialiser le serializer ici car il a besoin de la SECRET_KEY.
# On le laissera dans la fabrique d'application.