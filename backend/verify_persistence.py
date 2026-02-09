import requests
import json
import os
import time

base_url = "http://127.0.0.1:5000/api/trips"
TRIPS_FILE = 'trips.json'

def test_persistence():
    print("Testing Persistence...")
    
    # 1. Save a trip
    data = {
        "start": "Persistence City",
        "destination": "Forever Town",
        "vehicle": "Truck",
        "distance": 100.0,
        "duration": 2.0,
        "stops": 1
    }
    try:
        response = requests.post(base_url, json=data)
        print(f"POST Status: {response.status_code}")
        if response.status_code != 201:
            print("Failed to save trip.")
            return
    except Exception as e:
        print(f"Error posting trip: {e}")
        return

    # 2. Check if file exists and has content
    time.sleep(1) # Give a moment for file write (though it should be sync)
    if os.path.exists(TRIPS_FILE):
        print(f"{TRIPS_FILE} exists.")
        with open(TRIPS_FILE, 'r') as f:
            content = json.load(f)
            print(f"File content: {json.dumps(content, indent=2)}")
            # Verify the trip is in the file
            found = any(t['start'] == "Persistence City" for t in content)
            if found:
                print("SUCCESS: Trip found in JSON file.")
            else:
                print("FAILURE: Trip NOT found in JSON file.")
    else:
        print(f"FAILURE: {TRIPS_FILE} does not exist.")

    # 3. GET request to verify server returns it (from memory)
    try:
        response = requests.get(base_url)
        trips = response.json().get('trips', [])
        found = any(t['start'] == "Persistence City" for t in trips)
        if found:
            print("SUCCESS: Trip returned by GET endpoint.")
        else:
            print("FAILURE: Trip NOT returned by GET endpoint.")
    except Exception as e:
        print(f"Error getting trips: {e}")

if __name__ == "__main__":
    test_persistence()
