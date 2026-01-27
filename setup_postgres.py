
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os

# Check if running on Render (DATABASE_URL will be set)
database_url = os.getenv('DATABASE_URL')

if database_url:
    # Running on Render - use DATABASE_URL directly
    print("Detected Render environment, using DATABASE_URL")
    
    def execute_schema():
        try:
            conn = psycopg2.connect(database_url)
            cursor = conn.cursor()
            
            print("Executing schema...")
            with open('schema_postgres.sql', 'r') as f:
                cursor.execute(f.read())
                
            conn.commit()
            cursor.close()
            conn.close()
            print("Schema executed successfully!")
            
        except Exception as e:
            print(f"Error executing schema: {e}")
    
    if __name__ == "__main__":
        execute_schema()

else:
    # Running locally - use localhost config
    print("Running in local environment")
    current_user = os.getenv('USER')
    
    db_config = {
        'user': current_user,
        'host': 'localhost',
        'port': '5432'
    }
    target_db = 'lab_inventory_db'
    
    def create_database():
        try:
            conn = psycopg2.connect(**db_config, dbname='postgres')
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
            cursor = conn.cursor()
            
            cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{target_db}'")
            exists = cursor.fetchone()
            
            if not exists:
                print(f"Creating database {target_db}...")
                cursor.execute(f"CREATE DATABASE {target_db}")
            else:
                print(f"Database {target_db} already exists.")
                
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            print(f"Error creating database: {e}")
            return False
    
    def execute_schema():
        try:
            conn = psycopg2.connect(**db_config, dbname=target_db)
            cursor = conn.cursor()
            
            print("Executing schema...")
            with open('schema_postgres.sql', 'r') as f:
                cursor.execute(f.read())
                
            conn.commit()
            cursor.close()
            conn.close()
            print("Schema executed successfully!")
            
        except Exception as e:
            print(f"Error executing schema: {e}")
    
    if __name__ == "__main__":
        if create_database():
            execute_schema()
