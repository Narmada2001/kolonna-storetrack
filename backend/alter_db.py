import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "storetrack.db")

def migrate():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Check if columns exist
    c.execute("PRAGMA table_info(transactions)")
    columns = [col[1] for col in c.fetchall()]
    
    try:
        if "notes" not in columns:
            print("Adding 'notes' column...")
            c.execute("ALTER TABLE transactions ADD COLUMN notes TEXT")
            
        if "unit_cost" not in columns:
            print("Adding 'unit_cost' column...")
            c.execute("ALTER TABLE transactions ADD COLUMN unit_cost NUMERIC(10, 2) DEFAULT 0.0")
            
        if "total_cost" not in columns:
            print("Adding 'total_cost' column...")
            c.execute("ALTER TABLE transactions ADD COLUMN total_cost NUMERIC(10, 2) DEFAULT 0.0")
            
        if "issued_to_id" not in columns:
            print("Adding 'issued_to_id' column...")
            c.execute("ALTER TABLE transactions ADD COLUMN issued_to_id INTEGER REFERENCES users(id)")
            
        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
