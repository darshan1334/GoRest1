from flask import Flask, jsonify, request
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

if __name__ == '__main__':
    # Run the app on port 5000, debug mode on for development
    print("Starting GoRest Trip API on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
