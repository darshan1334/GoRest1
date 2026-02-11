from flask import Flask, jsonify, request
import requests
import math
from flask_cors import CORS
import json
import os

app = Flask(__name__)
CORS(app)

TRIPS_FILE = 'trips.json'

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

@app.route('/')
def home():
    return jsonify({
        "message": "GoRest Trip API is running!",
        "status": "online"
    })

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

# -------------------- SERVICES API (FINAL) --------------------

@app.route('/api/services', methods=['GET'])
def get_services():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    radius = request.args.get('radius', 5000)

    if not lat or not lon:
        return jsonify({"error": "lat and lon required"}), 400

    lat = float(lat)
    lon = float(lon)

    overpass_query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="fuel"](around:{radius},{lat},{lon});
      node["amenity"="hospital"](around:{radius},{lat},{lon});
      node["tourism"="hotel"](around:{radius},{lat},{lon});
      node["amenity"="restaurant"](around:{radius},{lat},{lon});
      node["amenity"="pharmacy"](around:{radius},{lat},{lon});
      node["amenity"="bank"](around:{radius},{lat},{lon});
      node["amenity"="atm"](around:{radius},{lat},{lon});
      node["shop"="car_repair"](around:{radius},{lat},{lon});
    );
    out body;
    """

    res = requests.post(
        "https://overpass-api.de/api/interpreter",
        data=overpass_query
    )

    data = res.json()

    services = []

    for el in data.get("elements", []):
        tags = el.get("tags", {})
        name = tags.get("name", "Unnamed")

        service_type = (
            tags.get("amenity")
            or tags.get("tourism")
            or tags.get("shop")
        )

        distance = round(haversine(lat, lon, el["lat"], el["lon"]), 2)

        services.append({
            "name": name,
            "type": service_type,
            "lat": el["lat"],
            "lon": el["lon"],
            "distance": distance
        })

    # Sort all services by distance
    services.sort(key=lambda x: x["distance"])

    return jsonify({
        "status": "success",
        "count": len(services),
        "services": services
    })

# -------------------- PLANNING API --------------------

@app.route('/plan-trip', methods=['POST'])
def plan_trip():
    """
    Determines pitstop intervals based on vehicle type.
    This logic mirrors the frontend requirements but moves it to the backend.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid data"}), 400
            
        vehicle_type = data.get('vehicle_type', 'car')
        
        # Pitstop calculate logic
        if vehicle_type == 'bike':
            interval = 50
        elif vehicle_type == 'car':
            interval = 100
        elif vehicle_type == 'ev':
            # Could be refined if we passed specific EV type, 
            # but taking a safe average or default for now
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
    print("Starting GoRest API at http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
