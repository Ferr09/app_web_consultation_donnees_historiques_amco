# Application de Consultation de Données Historiques AMCO

> Une application web sécurisée développée avec Flask pour la consultation de données historiques, utilisant Supabase pour le backend. Elle intègre une authentification avancée via OAuth2 (Google & Microsoft) et un panel d'administration complet.

![Aperçu de l'application](lien_vers_votre_screenshot.png)
*(Conseil : Faites une capture d'écran de votre page de connexion ou de votre tableau de bord et remplacez ce texte par le lien de l'image pour un rendu plus professionnel.)*

## À propos du projet

Ce projet est une application web conçue pour offrir une interface sécurisée et intuitive pour la consultation de données historiques de ventes et d'achats. Elle s'appuie sur **Supabase** comme backend de base de données (PostgreSQL), ce qui garantit performance et scalabilité.

Le système d'authentification est robuste et flexible, permettant aux utilisateurs de se connecter via une méthode traditionnelle (e-mail/mot de passe) ou via des fournisseurs tiers comme **Google et Microsoft** grâce au protocole OAuth2. Un panel d'administration protégé offre un contrôle total sur la gestion des utilisateurs, leurs permissions et les paramètres de l'application.

## Fonctionnalités Clés

*   🔐 **Authentification Sécurisée** : Multiples méthodes de connexion (e-mail, Google OAuth, Microsoft OAuth) avec gestion des rôles (utilisateur vs. administrateur).
*   📊 **Filtrage de Données Avancé** : Une interface intuitive pour construire et exécuter des requêtes complexes sur les données historiques.
*   ⚙️ **Panel d'Administration** : Une zone protégée permettant aux administrateurs de gérer les comptes utilisateurs (ajouter, supprimer, activer/désactiver).
*   🛡️ **Contrôle d'Accès Basé sur les Rôles** : Différenciation claire entre les permissions des utilisateurs standards et celles des administrateurs.
*   🚀 **Déploiement Serverless** : Conçue et configurée pour un déploiement simple et scalable sur la plateforme **Vercel**.

## Stack Technique

*   **Backend** : [Flask](https://flask.palletsprojects.com/)
*   **Base de données** : [Supabase](https://supabase.io/) (PostgreSQL)
*   **Authentification** : [Flask-Login](https://flask-login.readthedocs.io/), [Authlib](https://authlib.org/) pour OAuth2
*   **Frontend** : HTML, CSS, JavaScript, [Jinja2](https://jinja.palletsprojects.com/)
*   **Déploiement** : [Vercel](https://vercel.com/)

## Démarrage Local

Pour obtenir une copie locale fonctionnelle, suivez ces étapes simples.

### Prérequis

*   Python 3.8+
*   Les outils `pip` et `venv`

### Installation

1.  **Clonez le dépôt :**
    ```sh
    git clone https://github.com/Ferr09/app_web_consultation_donnees_historiques_amco.git
    cd votre-projet
    ```

2.  **Créez et activez un environnement virtuel :**
    ```sh
    # Pour macOS/Linux
    python3 -m venv venv
    source venv/bin/activate

    # Pour Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Installez les dépendances requises :**
    ```sh
    pip install -r requirements.txt
    ```

4.  **Configurez vos variables d'environnement :**
    Créez un fichier nommé `.env` à la racine du projet et ajoutez-y les variables suivantes.
    
    **IMPORTANT** : Ne committez jamais votre fichier `.env` sur Git ! Assurez-vous qu'il est bien présent dans votre `.gitignore`.

    ```env
    # Configuration de Flask
    FLASK_SECRET_KEY='votre_cle_secrete_longue_et_aleatoire'
    FLASK_SERVER_NAME='localhost:5000'
    FLASK_ENV='development'

    # Identifiants Supabase
    SUPABASE_URL='votre_url_de_projet_supabase'
    SUPABASE_KEY='votre_cle_anon_supabase'

    # Identifiants Google OAuth
    GOOGLE_CLIENT_ID='votre_client_id_google'
    GOOGLE_CLIENT_SECRET='votre_client_secret_google'

    # Identifiants Microsoft (Azure) OAuth
    AZURE_CLIENT_ID='votre_client_id_azure'
    AZURE_CLIENT_SECRET='votre_client_secret_azure'
    AZURE_TENANT_ID='votre_tenant_id_azure'
    ```

5.  **Lancez l'application :**
    ```sh
    flask run
    ```
    L'application sera disponible à l'adresse `http://localhost:5000`.

## Déploiement

Cette application est configurée pour un déploiement serverless sur **Vercel**. Pour la déployer :
1.  Importez le dépôt Git dans un nouveau projet Vercel.
2.  Configurez les mêmes variables d'environnement que celles du fichier `.env` dans les paramètres du projet sur Vercel.
3.  Vercel déploiera automatiquement chaque `push` sur la branche `main`.

## Auteur

**Fernando Rojas Rivera** - [@Ferr09](https://github.com/Ferr09)

## Licence

Distribué sous la licence MIT. Voir le fichier `LICENSE` pour plus d'informations.