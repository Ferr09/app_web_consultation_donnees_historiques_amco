# decorators.py
import os
from functools import wraps
from flask import request, abort, current_app

def check_ip_whitelist():
    """
    Fonction simple pour 'before_request' qui vérifie si l'IP du client est autorisée.
    Cette fonction n'est PAS un décorateur.
    """
    # 1. On récupère la liste des IP autorisées depuis la configuration.
    # On ajoute "" comme valeur par défaut pour éviter un crash si la variable n'existe pas.
    allowed_ips_str = current_app.config.get("ALLOWED_IPS", "")
    
    if not allowed_ips_str:
        current_app.logger.warning("Variable d'environnement ALLOWED_IPS non définie ou vide. Accès bloqué par défaut.")
        abort(403)

    allowed_ips = [ip.strip() for ip in allowed_ips_str.split(',')]

    # 2. On récupère l'adresse IP du client.
    forwarded_for = request.headers.get('X-Forwarded-For')
    if not forwarded_for:
        current_app.logger.warning("En-tête X-Forwarded-For manquant. Accès refusé.")
        abort(403)

    client_ip = forwarded_for.split(',')[0].strip()

    # 3. On vérifie si l'IP est dans la liste.
    if client_ip not in allowed_ips:
        current_app.logger.info(f"Accès refusé pour l'IP non autorisée : {client_ip}")
        abort(403)
    
    # 4. Si l'IP est autorisée, la fonction se termine et la requête continue normalement.
    return