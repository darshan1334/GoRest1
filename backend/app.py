from flask import Flask, jsonify, request
import requests
import math
from flask_cors import CORS
import json
import os

app = Flask(__name__)
# Enable CORS so the frontend can successfully call this backend
CORS(app)

TRIPS_FILE = 'trips.json'

def load_trips():
    """Load trips from the JSON file."""
    if not os.path.exists(TRIPS_FILE):
        return []
    try:
        with open(TRIPS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

def save_trips(trips_data):
    """Save trips to the JSON file."""
    try:
        with open(TRIPS_FILE, 'w') as f:
            json.dump(trips_data, f, indent=2)
    except IOError as e:
        print(f"Error saving trips: {e}")

# Load trips into memory on startup
trips = load_trips()

@app.route('/')
def home():
    """
    Home route to verify the backend is running.
    """
    return jsonify({
        "message": "GoRest Trip API is running!",
        "status": "online"
    })

@app.route('/api/trips', methods=['POST'])
def save_trip():
    """
    Endpoint to save a trip summary.
    Expected JSON payload:
    {
        "start": "string",
        "destination": "string",
        "vehicle": "string",
        "distance": number,
        "duration": number,
        "stops": number
    }
    """
    data = request.json
    
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    
    # Required fields
    required_fields = ['start', 'destination', 'vehicle', 'distance', 'duration', 'stops']
    
    # Check for missing fields
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return jsonify({
            "error": "Missing required fields", 
            "missing": missing_fields
        }), 400
    
    # Create trip object
    new_trip = {
        "id": len(trips) + 1,
        "start": data['start'],
        "destination": data['destination'],
        "vehicle": data['vehicle'],
        "distance": data['distance'],
        "duration": data['duration'],
        "stops": data['stops']
    }
    
    # Check if trips list in memory is synced with file (optional, but good practice is to reload or just append)
    # For simplicity, we append to memory and save memory to file
    trips.append(new_trip)
    save_trips(trips)
    
    return jsonify({
        "status": "success",
        "message": "Trip saved successfully",
        "trip": new_trip
    }), 201

@app.route('/api/trips', methods=['GET'])
def get_trips():
    """
    Endpoint to retrieve all saved trips.
    Returns the list from memory (which is initialized from file).
    """
    # Optional: Reload from file to ensure we have latest if modified externally
    # global trips
    # trips = load_trips() 
    
    return jsonify({
        "status": "success",
        "count": len(trips),
        "trips": trips
    }), 200

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    Returns distance in kilometers.
    """
    # Convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r

@app.route('/api/services', methods=['GET'])
def get_nearby_services():
    """
    Fetch nearby services (fuel, restaurants, hospitals, hotels, mechanics) using Overpass API.
    Query Params: lat, lon, radius (default 2000m)
    Returns list with distance calculated from the query point.
    """
    try:
        lat_param = request.args.get('lat')
        lon_param = request.args.get('lon')
        radius = request.args.get('radius', 2000)

        if not lat_param or not lon_param:
            return jsonify({"error": "Missing lat or lon parameters"}), 400
            
        center_lat = float(lat_param)
        center_lon = float(lon_param)

        # Overpass API Query
        overpass_url = "http://overpass-api.de/api/interpreter"
        query = f"""
        [out:json];
        (
          node["amenity"="fuel"](around:{radius},{center_lat},{center_lon});
          node["amenity"="restaurant"](around:{radius},{center_lat},{center_lon});
          node["amenity"="hospital"](around:{radius},{center_lat},{center_lon});
          node["tourism"="hotel"](around:{radius},{center_lat},{center_lon});
          node["shop"="car_repair"](around:{radius},{center_lat},{center_lon});
        );
        out body;
        """
        
        response = requests.get(overpass_url, params={'data': query})
        
        if response.status_code != 200:
            return jsonify({"error": "Failed to fetch from Overpass API"}), 502

        data = response.json()
        
        # Process and normalize data
        services = {
            "fuel": [],
            "restaurants": [],
            "hospitals": [],
            "hotels": [],
            "mechanics": []
        }

        for element in data.get('elements', []):
            tags = element.get('tags', {})
            name = tags.get('name', 'Unknown')
            lat = element.get('lat')
            lon = element.get('lon')
            
            # Calculate distance
            dist = calculate_distance(center_lat, center_lon, lat, lon)
            dist_formatted = round(dist, 2)
            
            item = {
                "name": name, 
                "lat": lat, 
                "lon": lon,
                "distance": dist_formatted
            }

            if tags.get('amenity') == 'fuel':
                services['fuel'].append(item)
            elif tags.get('amenity') == 'restaurant':
                services['restaurants'].append(item)
            elif tags.get('amenity') == 'hospital':
                services['hospitals'].append(item)
            elif tags.get('tourism') == 'hotel':
                services['hotels'].append(item)
            elif tags.get('shop') == 'car_repair':
                services['mechanics'].append(item)

        # Sort items by distance within each category (optional but good for UX)
        for cat in services:
            services[cat].sort(key=lambda x: x['distance'])

        return jsonify(services), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Run the app on port 5000, debug mode on for development
    print("Starting GoRest Trip API on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
