import sqlite3
import json

def init_db():
    
    # Se connecte à la base de données (la crée si elle n'existe pas)
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()

    # Supprimer la table 'users' si elle existe déjà
    cursor.execute('DROP TABLE IF EXISTS users')

    # Crée la table 'users' avec les colonnes nécessaires
    cursor.execute('''
    CREATE TABLE users (
        email TEXT PRIMARY KEY,
        nom TEXT NOT NULL,
        password_hash TEXT,
        recovery_code TEXT,
        role TEXT NOT NULL,
        actif BOOLEAN NOT NULL,
        confirmed BOOLEAN NOT NULL,
        is_protected BOOLEAN NOT NULL DEFAULT 0,
        microsoft_id TEXT UNIQUE
    )
    ''')

    print("Table 'users' créée avec succès.")

    
    # (Optional) Si vous souhaitez migrer vos utilisateurs existants depuis le JSON
    try:
        with open('data/users.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
            
            all_users = data.get('admins', []) + data.get('users', [])
            protected_admins = data.get('protected_admins', [])

            for user in all_users:
                cursor.execute('''
                INSERT INTO users (email, nom, password_hash, recovery_code, role, actif, confirmed, is_protected)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user.get('email'),
                    user.get('nom'),
                    user.get('password_hash', ''), 
                    user.get('recovery_code'),
                    user.get('role'),
                    user.get('actif', True),
                    user.get('confirmed', False),
                    1 if user.get('email') in protected_admins else 0
                ))
            print(f"{len(all_users)} utilisateurs migrés depuis data.json.")
    except FileNotFoundError:
        print("data.json pas trouvé, on va créer une base de donneés vide.")

    # Sauvegarde les modifications et ferme la connexion
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()