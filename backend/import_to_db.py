import sqlite3
import json
import os

DB_NAME = "services.db"

files = [
    # Karnataka
    ("karnataka_hospital.geojson", "hospital"),
    ("karnataka_hotels.geojson", "hotel"),
    ("karnataka_restaurants.geojson", "restaurant"),
    ("karnataka_pharmacy.geojson", "pharmacy"),
    ("karnataka_fuel.geojson", "fuel"),
    ("KN_ATM.geojson", "atm"),
    ("KN_CarMech.geojson", "car_workshop"),
    ("KN_bike mech.geojson", "bike_mechanical"),

    # Telangana
    ("TS_Hospital.geojson", "hospital"),
    ("TS_hotels.geojson", "hotel"),
    ("TS_restaurants.geojson", "restaurant"),
    ("TS_PHARM.geojson", "pharmacy"),
    ("TS_ATM.geojson", "atm"),
    ("TS_Fuels.geojson", "fuel"),
    ("TS_carMech.geojson", "car_workshop"),
    ("TS_Bike.geojson", "bike_mechanical"),

    # Andhra
    ("AP_hosp.geojson", "hospital"),
    ("AP_Hotel.geojson", "hotel"),
    ("AP_Rest.geojson", "restaurant"),
    ("AP_Pharm.geojson", "pharmacy"),
    ("AP_ATM.geojson", "atm"),
    ("AP_car.geojson", "car_workshop"),
    ("AP_Bike.geojson", "bike_mechanical"),

    # Tamil Nadu
    ("TN_Hosp.geojson", "hospital"),
    ("TN_hotels.geojson", "hotel"),
    ("NTN_rest.geojson", "restaurant"),
    ("STN_rest.geojson", "restaurant"),
    ("TN_pharm.geojson", "pharmacy"),
    ("TN_ATM.geojson", "atm"),
    ("TN_ATM2.geojson", "atm"),
    ("TN_fuel.geojson", "fuel"),
    ("TN_car.geojson", "car_workshop"),
    ("TN_bike.geojson", "bike_mechanical"),

    # Kerala
    ("KL_hosp.geojson", "hospital"),
    ("KL_Hotels.geojson", "hotel"),
    ("KL_rest.geojson", "restaurant"),
    ("KL_pharm.geojson", "pharmacy"),
    ("KL_ATM.geojson", "atm"),
    ("KL_fuels.geojson", "fuel"),
    ("KL_car.geojson", "car_workshop"),
    ("KL_bike.geojson", "bike_mechanical"),
]

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

# ✅ Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    type TEXT,
    lat REAL,
    lon REAL
)
""")

# ✅ Create index for faster location search
cursor.execute("""
CREATE INDEX IF NOT EXISTS idx_lat_lon 
ON services(lat, lon)
""")

# ✅ Clear old data (avoid duplicates)
cursor.execute("DELETE FROM services")
print("Old data cleared.")

total_inserted = 0

for file_name, service_type in files:

    if not os.path.exists(file_name):
        print(f"{file_name} not found, skipping.")
        continue

    print(f"Importing {file_name}...")

    try:
        with open(file_name, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {file_name}: {e}")
        continue

    for feature in data.get("features", []):
        geometry = feature.get("geometry", {})

        # Only accept Point data
        if geometry.get("type") != "Point":
            continue

        coords = geometry.get("coordinates")
        if not coords or len(coords) < 2:
            continue

        lon = coords[0]
        lat = coords[1]

        name = feature.get("properties", {}).get("name", service_type)

        cursor.execute(
            "INSERT INTO services (name, type, lat, lon) VALUES (?, ?, ?, ?)",
            (name, service_type, lat, lon)
        )

        total_inserted += 1

conn.commit()

# ✅ Verify count
cursor.execute("SELECT COUNT(*) FROM services")
count = cursor.fetchone()[0]

conn.close()

print("===================================")
print(f"Total records inserted: {total_inserted}")
print(f"Total records in database: {count}")
print("All data imported successfully.")
print("===================================")
