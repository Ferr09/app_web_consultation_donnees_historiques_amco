from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email

class LoginForm(FlaskForm):
    """
    Formulaire de connexion pour l'utilisateur.
    Ce formulaire sera utilisé à la fois pour la connexion normale et pour la page de liaison de compte.
    """
    # Champ pour l'e-mail de l'utilisateur.
    # DataRequired: Ce champ ne peut pas être vide.
    # Email: Le contenu doit ressembler à une adresse e-mail valide.
    email = StringField('Adresse e-mail', validators=[DataRequired(), Email()])
    
    # Champ pour le mot de passe.
    # DataRequired: Ce champ ne peut pas être vide.
    password = PasswordField('Mot de passe', validators=[DataRequired()])
    
    # Bouton pour soumettre le formulaire.
    submit = SubmitField('Se connecter')
