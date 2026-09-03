import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "storetrack.db")

def migrate():
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Check if columns exist in transactions
    c.execute("PRAGMA table_info(transactions)")
    columns_info = c.fetchall()
    columns = [col[1] for col in columns_info]
    
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

        # ---------------------------------------------------------------
        # Make recorded_by_id nullable (SQLite requires a table rebuild).
        # Detect whether the column is already nullable by checking
        # PRAGMA table_info: col[3] == 1 means NOT NULL.
        # ---------------------------------------------------------------
        recorded_by_col = next((col for col in columns_info if col[1] == "recorded_by_id"), None)
        if recorded_by_col and recorded_by_col[3] == 1:  # 1 = NOT NULL constraint present
            print("Making 'recorded_by_id' nullable (rebuilding transactions table)...")
            c.executescript("""
                PRAGMA foreign_keys = OFF;

                ALTER TABLE transactions RENAME TO _transactions_old;

                CREATE TABLE transactions (
                    id               INTEGER PRIMARY KEY,
                    item_id          INTEGER NOT NULL REFERENCES items(id),
                    supplier_id      INTEGER REFERENCES suppliers(id),
                    type             VARCHAR NOT NULL,
                    quantity         INTEGER NOT NULL,
                    reference_no     VARCHAR(100),
                    transaction_date DATETIME,
                    recorded_by_id   INTEGER REFERENCES users(id),
                    notes            TEXT,
                    unit_cost        NUMERIC(10, 2) DEFAULT 0,
                    total_cost       NUMERIC(10, 2) DEFAULT 0,
                    issued_to_id     INTEGER REFERENCES users(id)
                );

                INSERT INTO transactions
                    SELECT id, item_id, supplier_id, type, quantity,
                           reference_no, transaction_date, recorded_by_id,
                           notes, unit_cost, total_cost, issued_to_id
                    FROM _transactions_old;

                DROP TABLE _transactions_old;

                PRAGMA foreign_keys = ON;
            """)
            print("  Done — recorded_by_id is now nullable.")
        else:
            print("'recorded_by_id' is already nullable, skipping rebuild.")

        conn.commit()
        print("Migration successful.")
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
