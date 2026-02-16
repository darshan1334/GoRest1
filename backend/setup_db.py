import sqlite3

conn = sqlite3.connect("services.db")
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    lat REAL,
    lon REAL
)
""")

# Index for faster searching
cursor.execute("""
CREATE INDEX IF NOT EXISTS idx_location 
ON services(lat, lon)
""")

conn.commit()
conn.close()

print("Database created successfully.")
