import requests
import json

base_url = "http://127.0.0.1:5000/api/route"

def test_valid_request():
    print("Testing Valid Request...")
    data = {
        "start": "New York",
        "destination": "Los Angeles",
        "vehicle": "Car",
        "routePreference": "fastest",
        "pitstopMode": "automatic"
    }
    try:
        response = requests.post(base_url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

def test_missing_fields_request():
    print("Testing Missing Fields Request...")
    data = {
        "vehicle": "Car"
    }
    try:
        response = requests.post(base_url, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")
    print("-" * 20)

if __name__ == "__main__":
    test_valid_request()
    test_missing_fields_request()
