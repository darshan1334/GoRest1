from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import math
import json
import os

# -------------------- APP INIT --------------------

app = Flask(__name__)
CORS(app)

# -------------------- CONFIG --------------------

TRIPS_FILE = 'trips.json'
DB_FILE = 'services.db'

# -------------------- Trip Storage --------------------

def load_trips():
    if not os.path.exists(TRIPS_FILE):
        return []
    try:
        with open(TRIPS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_trips(trips):
    with open(TRIPS_FILE, 'w') as f:
        json.dump(trips, f, indent=2)

trips = load_trips()

# -------------------- HOME --------------------

@app.route('/')
def home():
    return jsonify({
        "message": "GoRest Trip API is running!",
        "status": "online"
    })

# -------------------- TRIPS API --------------------

@app.route('/api/trips', methods=['POST'])
def save_trip():
    data = request.json
    required = ['start', 'destination', 'vehicle', 'distance', 'duration', 'stops']

    if not data or any(k not in data for k in required):
        return jsonify({"error": "Invalid trip data"}), 400

    trip = {
        "id": len(trips) + 1,
        **data
    }

    trips.append(trip)
    save_trips(trips)

    return jsonify({"status": "success", "trip": trip}), 201


@app.route('/api/trips', methods=['GET'])
def get_trips():
    return jsonify({
        "status": "success",
        "count": len(trips),
        "trips": trips
    })

# -------------------- Utility --------------------

def haversine(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    return 6371 * (2 * math.asin(math.sqrt(a)))

# -------------------- SERVICES API --------------------

@app.route('/api/services', methods=['GET'])
def get_services():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    radius = request.args.get('radius', 5)

    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400

    lat = float(lat)
    lon = float(lon)
    radius = float(radius)

    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, name, type, lat, lon
        FROM services
        WHERE lat IS NOT NULL
        AND lon IS NOT NULL
    """)

    rows = cursor.fetchall()
    conn.close()

    services = []

    for row in rows:
        distance = haversine(
            lat,
            lon,
            row["lat"],
            row["lon"]
        )

        if distance <= radius:
            services.append({
                "id": row["id"],
                "name": row["name"],
                "type": row["type"],
                "lat": row["lat"],
                "lon": row["lon"],
                "distance": round(distance, 2)
            })

    services.sort(key=lambda x: x["distance"])

    return jsonify({
        "status": "success",
        "count": len(services),
        "services": services
    })

# -------------------- PLANNING API --------------------

@app.route('/plan-trip', methods=['POST'])
def plan_trip():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid data"}), 400

        vehicle_type = data.get('vehicle_type', 'car')

        if vehicle_type == 'bike':
            interval = 50
        elif vehicle_type == 'car':
            interval = 100
        elif vehicle_type == 'ev':
            interval = 80
        elif vehicle_type == 'bus':
            interval = 150
        else:
            interval = 100

        return jsonify({
            "vehicle_type": vehicle_type,
            "recommended_pitstop_km": interval,
            "status": "success"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------- RUN --------------------

if __name__ == "__main__":
    print("Starting GoRest API on 0.0.0.0:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
