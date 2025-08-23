# decorators.py
import os
from functools import wraps
from flask import request, abort, current_app

def ip_whitelist_required(f):
    """
    Décorateur qui vérifie si l'adresse IP du client est dans la liste blanche.
    Si la liste blanche n'est pas configurée ou est vide, l'accès est bloqué par défaut pour des raisons de sécurité.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 1. On récupère la liste des IP autorisées depuis la configuration de l'application.
        allowed_ips_str = current_app.config.get("ALLOWED_IPS", "")
        
        # Sécurité : si la variable n'est pas définie, on bloque tout.
        if not allowed_ips_str:
            current_app.logger.warning("Variable d'environnement ALLOWED_IPS non définie. Accès bloqué par défaut.")
            abort(403) # 403 Forbidden

        allowed_ips = [ip.strip() for ip in allowed_ips_str.split(',')]

        # 2. On récupère l'adresse IP du client. Sur Vercel, elle est dans l'en-tête 'X-Forwarded-For'.
        forwarded_for = request.headers.get('X-Forwarded-For')
        if not forwarded_for:
            current_app.logger.warning("En-tête X-Forwarded-For manquant. Accès refusé.")
            abort(403)

        # La première IP dans la liste est généralement celle du client réel.
        client_ip = forwarded_for.split(',')[0].strip()

        # 3. On vérifie si l'IP du client est dans notre liste d'IP autorisées.
        if client_ip not in allowed_ips:
            current_app.logger.info(f"Accès refusé pour l'IP non autorisée : {client_ip}")
            abort(403)
        
        # 4. Si l'IP est autorisée, on exécute la fonction de la route normalement.
        return f(*args, **kwargs)
    
    return decorated_function