import requests
import json

base_url = "http://127.0.0.1:5000/api/trips"

def test_save_trip():
    print("Testing Save Trip (POST)...")
    data = {
        "start": "New York",
        "destination": "Boston",
        "vehicle": "SUV",
        "distance": 350.5,
        "duration": 4.5,
        "stops": 2
    }
    try:
        response = requests.post(base_url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

def test_missing_fields():
    print("Testing Missing Fields (POST)...")
    data = {
        "start": "Chicago",
        # Missing destination and other fields
        "vehicle": "Sedan"
    }
    try:
        response = requests.post(base_url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

def test_get_trips():
    print("Testing Get Trips (GET)...")
    try:
        response = requests.get(base_url)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

if __name__ == "__main__":
    test_save_trip()
    test_missing_fields()
    test_get_trips()
