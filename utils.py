# utils.py

import os  # Nécessaire pour lire les variables d'environnement
import json
from mailbox import Message
from flask import current_app
from itsdangerous import URLSafeTimedSerializer
from extensions import mail
import secrets
import string
import random
from supabase import create_client, Client  # On importe le client Supabase
from supabase.lib.client_options import ClientOptions

# ======================================================================
# == GESTION DE LA BASE DE DONNÉES (MAINTENANT AVEC SUPABASE)         ==
# ======================================================================

# --- DÉBUT DE LA CONFIGURATION SUPABASE ---
# On lit les identifiants depuis les variables d'environnement (qui seront configurées dans Vercel)
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

# Options supplémentaires pour le client, en spécifiant le schéma à utiliser
options = ClientOptions(schema="auth_users")
# On crée le client en lui passant les options pour qu'il sache dans quel schéma travailler
supabase: Client = create_client(url, key, options)

# Maintenant que le schéma par défaut est configuré, on a seulement besoin du nom de la table
TABLE_NAME = "users"

# --- FONCTIONS DE BASE DE DONNÉES REFACTORISÉES ---

def find_user_by_email(email):
    """Cherche un utilisateur par son email dans la base de données Supabase."""
    # .select() demande les colonnes, et .eq() signifie "equals" (égal à)
    # .execute() envoie la requête. Les données sont dans l'attribut .data
    response = supabase.table(TABLE_NAME).select("*").eq("email", email).execute()
    
    # Si la liste de données n'est pas vide, on retourne le premier (et unique) utilisateur
    if response.data:
        return response.data[0]  # Retourne le dictionnaire de l'utilisateur
    return None

def update_user(user_data):
    """Met à jour un utilisateur existant ou en crée un nouveau dans Supabase avec upsert."""
    # La fonction 'upsert' de Supabase est parfaite pour ça.
    # Elle insère si la clé primaire (email) n'existe pas, ou met à jour si elle existe.
    # Pas besoin de vérifier d'abord si l'utilisateur existe.
    
    # On s'assure que les booléens sont bien True/False et non 1/0
    if 'is_protected' in user_data:
        user_data['is_protected'] = bool(user_data['is_protected'])
    if 'actif' in user_data:
        user_data['actif'] = bool(user_data['actif'])
    if 'confirmed' in user_data:
        user_data['confirmed'] = bool(user_data['confirmed'])

    supabase.table(TABLE_NAME).upsert(user_data).execute()

def get_whitelist():
    """Récupère la liste de tous les emails de Supabase pour l'utiliser comme whitelist."""
    # On sélectionne uniquement la colonne 'email'
    response = supabase.table(TABLE_NAME).select("email").execute()
    if response.data:
        return [user['email'] for user in response.data]
    return []

def delete_user(email):
    """Supprime un utilisateur de Supabase par son email."""
    supabase.table(TABLE_NAME).delete().eq("email", email).execute()

def get_all_users():
    """Récupère tous les utilisateurs de la base de données Supabase."""
    response = supabase.table(TABLE_NAME).select("*").order("role", desc=True).order("email").execute()
    return response.data

def get_protected_admins():
    """Récupère les e-mails des administrateurs protégés depuis Supabase."""
    response = supabase.table(TABLE_NAME).select("email").eq("is_protected", True).execute()
    if response.data:
        return [admin['email'] for admin in response.data]
    return []

def find_user_by_microsoft_id(microsoft_id: str):
    """Cherche un utilisateur dans Supabase en utilisant sa colonne microsoft_id."""
    if not microsoft_id:
        return None
    
    response = supabase.table(TABLE_NAME).select("*").eq("microsoft_id", microsoft_id).execute()
    
    if response.data:
        return response.data[0]
    return None

def update_user_microsoft_id(user_email: str, microsoft_id: str):
    """Met à jour le champ microsoft_id pour un utilisateur identifié par son e-mail."""
    if not user_email or not microsoft_id:
        return

    # .update() spécifie les données à changer, et .eq() spécifie la clause WHERE
    supabase.table(TABLE_NAME).update({"microsoft_id": microsoft_id}).eq("email", user_email).execute()


# ======================================================================
# == FONCTIONS QUI NE CHANGENT PAS (NE TOUCHE PAS À LA BDD)           ==
# ======================================================================

def generate_recovery_code(length=8):
    """
    Génère un code de récupération permanent, unique et sécurisé.
    Format : RCV-XXXX-XXXX
    """
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    code = ''.join(secrets.choice(alphabet) for _ in range(length))
    part1 = code[:length//2]
    part2 = code[length//2:]
    return f"RCV-{part1}-{part2}"

def get_serializer(app=None):
    """
    Crée et retourne une instance du sérialiseur pour générer des tokens sécurisés.
    """
    if app is None:
        app = current_app
    return URLSafeTimedSerializer(app.config['SECRET_KEY'])

def send_email(subject, recipients, body, html_body=None):
    """Envoie un e-mail."""
    msg = Message(subject, recipients=recipients, body=body, html=html_body)
    try:
        mail.send(msg)
    except Exception as e:
        current_app.logger.error(f"Erreur lors de l'envoi de l'e-mail : {e}")