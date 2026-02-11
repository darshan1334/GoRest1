document.addEventListener('DOMContentLoaded', function () {
    // --- 1. Map Initialization (Must be first) ---
    let map;
    let pitstopLayer;
    let servicesLayer;
    let routingControl = null;
    let currentRoute = null;

    // --- Custom Icons ---
    const icons = {
        fuel: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            iconSize: [32, 32]
        }),

        hospital: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            iconSize: [32, 32]
        }),

        pharmacy: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
            iconSize: [32, 32]
        }),

        clinic: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
            iconSize: [32, 32]
        }),

        restaurant: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
            iconSize: [32, 32]
        }),

        cafe: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
            iconSize: [32, 32]
        }),

        fast_food: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
            iconSize: [32, 32]
        }),

        hotel: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            iconSize: [32, 32]
        }),

        car_repair: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/black-dot.png",
            iconSize: [32, 32]
        }),

        tyres: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/black-dot.png",
            iconSize: [32, 32]
        }),

        default: new L.Icon({
            iconUrl: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
            iconSize: [32, 32]
        })
    };

    try {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error("Map container not found!");
            return;
        }

        // Initialize Map
        map = L.map('map').setView([20.5937, 78.9629], 5); // Default to India center

        // Add OpenStreetMap Tiles
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        // Initialize Layers
        pitstopLayer = L.layerGroup().addTo(map);
        servicesLayer = L.layerGroup().addTo(map);

        // Handle Resize
        setTimeout(() => {
            map.invalidateSize();
        }, 100);

    } catch (error) {
        console.error("Error initializing map:", error);
        alert("Map could not be initialized. Please refresh the page.");
        return; // Stop execution if map fails
    }

    // --- 2. UI Event Listeners ---
    const useCurrentLocCheckbox = document.getElementById('use-current-location');
    const startLocationInput = document.getElementById('start-location');
    const vehicleTypeSelect = document.getElementById('vehicle-type');
    const evTypeGroup = document.getElementById('ev-type-group');
    const pitstopModeSelect = document.getElementById('pitstop-mode');
    const manualPitstopGroup = document.getElementById('manual-pitstop-group');
    const pitstopDistanceInput = document.getElementById('pitstop-distance');
    const tripForm = document.querySelector('.trip-form');

    useCurrentLocCheckbox.addEventListener('change', function () {
        if (this.checked) {
            startLocationInput.value = "Current Location";
        } else {
            startLocationInput.value = "";
        }
    });

    vehicleTypeSelect.addEventListener('change', function () {
        if (this.value === 'ev') {
            evTypeGroup.style.display = 'block';
        } else {
            evTypeGroup.style.display = 'none';
        }
        if (currentRoute) calculatePitstops(currentRoute);
    });

    pitstopModeSelect.addEventListener('change', function () {
        if (this.value === 'manual') {
            manualPitstopGroup.style.display = 'block';
        } else {
            manualPitstopGroup.style.display = 'none';
        }
        if (currentRoute) calculatePitstops(currentRoute);
    });

    pitstopDistanceInput.addEventListener('change', function () {
        if (currentRoute && pitstopModeSelect.value === 'manual') {
            calculatePitstops(currentRoute);
        }
    });

    // --- 3. Routing Logic ---
    tripForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const startVal = document.getElementById('start-location').value;
        const destVal = document.getElementById('destination').value;
        const vehicleType = document.getElementById('vehicle-type').value;

        if (!startVal || !destVal) {
            alert("Please enter both start location and destination.");
            return;
        }

        // Fetch backend data for pitstops
        let backendIntervalKm = null;
        try {
            console.log("Sending request to backend...");
            const response = await fetch('http://127.0.0.1:5000/plan-trip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ vehicle_type: vehicleType })
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Backend response:", data);
                if (data.recommended_pitstop_km) {
                    backendIntervalKm = parseFloat(data.recommended_pitstop_km);
                }
            } else {
                console.warn("Backend request failed, falling back to local defaults.");
            }
        } catch (error) {
            console.error("Error connecting to backend:", error);
            // Fallback continues below
        }

        // Clear previous route and control
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }

        // Explicitly remove any existing routing containers to prevent duplicates
        const existingRoutingContainers = document.querySelectorAll('.leaflet-routing-container');
        existingRoutingContainers.forEach(container => container.remove());

        pitstopLayer.clearLayers();
        servicesLayer.clearLayers();
        currentRoute = null;

        try {
            let startCoords, destCoords;

            // Get Start Coordinates
            if (startVal === "Current Location") {
                startCoords = await getCurrentPosition();
            } else {
                startCoords = await geocodeLocation(startVal);
            }

            // Get Destination Coordinates
            destCoords = await geocodeLocation(destVal);

            if (startCoords && destCoords) {
                // Create routing control
                routingControl = L.Routing.control({
                    waypoints: [
                        L.latLng(startCoords[0], startCoords[1]),
                        L.latLng(destCoords[0], destCoords[1])
                    ],
                    routeWhileDragging: false,
                    lineOptions: {
                        styles: [{ color: 'blue', opacity: 0.7, weight: 5 }]
                    },
                    show: true,
                    addWaypoints: false,
                    draggableWaypoints: false,
                    fitSelectedRoutes: true,
                    createMarker: function (i, wp, nWps) {
                        return L.marker(wp.latLng, {
                            draggable: false,
                            title: i === 0 ? "Start" : "Destination"
                        }).bindPopup(i === 0 ? "Start" : "Destination");
                    }
                }).addTo(map);

                // Event: Route Found
                routingControl.on('routesfound', function (e) {
                    const routes = e.routes;
                    const route = routes[0];
                    const summary = route.summary;

                    // Update Trip Summary
                    document.getElementById('trip-summary').style.display = 'block';
                    document.getElementById('distance-val').textContent = (summary.totalDistance / 1000).toFixed(1) + " km";
                    document.getElementById('duration-val').textContent = Math.round(summary.totalTime / 60) + " mins";

                    // Calculate Pitstops
                    currentRoute = route;
                    calculatePitstops(route, backendIntervalKm);

                    // --- Call Optimized Service Fetcher ---
                    // Using setTimeout to allow UI to update first and not block
                    setTimeout(() => {
                        fetchServicesAlongRoute(route);
                    }, 1000);

                    // --- 6. Save Trip to Backend ---
                    // Extract data from summary and DOM
                    const distanceKm = parseFloat((summary.totalDistance / 1000).toFixed(1));
                    const durationHours = parseFloat((summary.totalTime / 3600).toFixed(1));
                    const stopsCount = parseInt(document.getElementById('stops-val').textContent) || 0;

                    const tripData = {
                        start: startVal,
                        destination: destVal,
                        vehicle: vehicleType,
                        distance: distanceKm,
                        duration: durationHours,
                        stops: stopsCount
                    };

                    // Send POST request
                    fetch('http://127.0.0.1:5000/api/trips', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(tripData)
                    })
                        .then(response => response.json())
                        .then(data => {
                            if (data.status === 'success') {
                                console.log("Trip saved successfully:", data);
                            } else {
                                console.error("Failed to save trip:", data);
                            }
                        })
                        .catch(error => {
                            console.error("Error saving trip:", error);
                        });
                });

                routingControl.on('routingerror', function (e) {
                    console.error("Routing error event:", e);
                    alert("Could not calculate route. Please check locations or try again.");
                });
            }

        } catch (error) {
            console.error("Routing error:", error);
            alert("Error plotting route: " + error.message);
        }
    });

    // --- 4. Pitstop Calculation Logic ---
    function calculatePitstops(route, backendIntervalKm = null) {
        pitstopLayer.clearLayers();
        // servicesLayer.clearLayers(); // Removed to allow accumulation if needed, but fetchNearbyServices usually clears.
        // Actually, calculatePitstops implies a new route or calc, so maybe we SHOULD clear services?
        // But fetchServicesAlongRoute will happen after this.
        servicesLayer.clearLayers();

        const totalDistanceKm = route.summary.totalDistance / 1000;

        // Determine Interval
        const mode = document.getElementById('pitstop-mode').value;
        let intervalKm;

        if (mode === 'manual') {
            const inputVal = document.getElementById('pitstop-distance').value;
            intervalKm = parseFloat(inputVal);
            if (!intervalKm || intervalKm <= 0) {
                return;
            }
        } else {
            // Use backend value if available, otherwise fall back to local defaults
            if (backendIntervalKm) {
                intervalKm = backendIntervalKm;
            } else {
                // AI Suggested defaults (Fallback)
                const vehicleType = document.getElementById('vehicle-type').value;
                if (vehicleType === 'bike') {
                    intervalKm = 50;
                } else if (vehicleType === 'car') {
                    intervalKm = 100;
                } else if (vehicleType === 'ev') {
                    const evType = document.getElementById('ev-type').value;
                    if (evType === 'electric_bike') intervalKm = 50;
                    else intervalKm = 80;
                } else if (vehicleType === 'bus') {
                    intervalKm = 150;
                } else {
                    intervalKm = 100; // Default
                }
            }
        }

        if (intervalKm >= totalDistanceKm) {
            document.getElementById('stops-val').textContent = "0";
            return;
        }

        const coordinates = route.coordinates;
        let currentDist = 0;
        let nextStopDist = intervalKm * 1000;
        let stopCount = 0;

        for (let i = 0; i < coordinates.length - 1; i++) {
            const p1 = L.latLng(coordinates[i].lat, coordinates[i].lng);
            const p2 = L.latLng(coordinates[i + 1].lat, coordinates[i + 1].lng);
            const segmentDist = p1.distanceTo(p2);

            if (currentDist + segmentDist >= nextStopDist) {
                const stopLatLng = p2;
                stopCount++;

                const marker = L.marker(stopLatLng, {
                    icon: L.divIcon({
                        className: 'pitstop-icon',
                        html: `<div style="background-color: #e67e22; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${stopCount}</div>`,
                        iconSize: [24, 24]
                    })
                });

                marker.addTo(pitstopLayer).bindPopup(`Pitstop ${stopCount} (after approx. ${(nextStopDist / 1000).toFixed(0)} km)<br><small>Click for services</small>`);

                // Click listener for Services
                marker.on('click', function () {
                    // When clicking a specific pitstop, we usually want to see services just for THAT pitstop.
                    // So we clear previous ones. append = false.
                    fetchNearbyServices(stopLatLng, false);
                });

                nextStopDist += intervalKm * 1000;
            }
            currentDist += segmentDist;
        }
        document.getElementById('stops-val').textContent = stopCount;
    }

    // --- 5. Nearby Services Logic (Frontend Overpass API - Node/Way/Relation - 2500m) ---
    // Added 'append' parameter to support multiple calls without clearing
    async function fetchNearbyServices(latlng, append = false) {
        // Adapt Leaflet LatLng to expected lat/lon
        const lat = latlng.lat;
        const lon = latlng.lng;

        const servicesList = document.getElementById('nearbyServices');

        if (!append) {
            // Clear existing markers and list only if not appending
            servicesLayer.clearLayers();
            if (servicesList) {
                servicesList.innerHTML = '<div style="color: grey;">Fetching nearby services... <i class="fas fa-spinner fa-spin"></i></div>';
            }
        } else {
            // If appending, maybe show a small loading indicator or just do nothing UI-wise
        }

        // Show loading popup on map (optional, maybe distracting if loop runs many times)
        // Only show if not appending (single click) or maybe just for the first one?
        // For the loop, we might not want a popup every time.
        let loadingPopup = null;
        if (!append) {
            loadingPopup = L.popup()
                .setLatLng(latlng)
                .setContent('<div style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Finding services...</div>')
                .openOn(map);
        }

        const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"fuel|hospital|pharmacy|clinic"](around:2500,${lat},${lon});
              way["amenity"~"fuel|hospital|pharmacy|clinic"](around:2500,${lat},${lon});
              relation["amenity"~"fuel|hospital|pharmacy|clinic"](around:2500,${lat},${lon});

              node["tourism"="hotel"](around:2500,${lat},${lon});
              way["tourism"="hotel"](around:2500,${lat},${lon});

              node["shop"~"car_repair|tyres"](around:2500,${lat},${lon});
              way["shop"~"car_repair|tyres"](around:2500,${lat},${lon});

              node["amenity"="restaurant"](around:2500,${lat},${lon});
              way["amenity"="restaurant"](around:2500,${lat},${lon});
            );
            out center;
        `;

        try {
            const res = await fetch(
                "https://overpass-api.de/api/interpreter",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: "data=" + encodeURIComponent(query)
                }
            );

            if (!res.ok) throw new Error("Overpass request failed");

            const data = await res.json();

            // Close loading popup
            if (loadingPopup) map.closePopup(loadingPopup);
            if (!append && servicesList) servicesList.innerHTML = ""; // Clear "Fetching..." text

            displayServices(data.elements, append);
            addServiceMarkers(data.elements, append);

        } catch (error) {
            console.error(error);
            if (loadingPopup) map.closePopup(loadingPopup);
            if (!append && servicesList) servicesList.innerText = "Failed to fetch nearby services.";
            if (!append) L.popup().setLatLng(latlng).setContent("Failed to load services.").openOn(map);
        }
    }

    // --- 3. Display Logic (User Provided + Append Support) ---
    function displayServices(services, append = false) {
        const box = document.getElementById("nearbyServices");
        if (!box) return;

        if (!append) box.innerHTML = "";

        if (!services || services.length === 0) {
            if (!append) box.innerText = "No nearby services found.";
            return;
        }

        services.slice(0, 12).forEach(s => {
            const name = s.tags?.name || "Unnamed";
            const type =
                s.tags?.amenity ||
                s.tags?.tourism ||
                s.tags?.shop ||
                "Service";

            box.innerHTML += `
      <div>
        <strong>${name}</strong><br/>
        <small>${type}</small>
      </div>
      <hr/>
    `;
        });
    }

    function addServiceMarkers(services, append = false) {
        if (!append) servicesLayer.clearLayers();

        services.forEach(service => {

            let lat, lon;

            if (service.lat && service.lon) {
                lat = service.lat;
                lon = service.lon;
            } else if (service.center) {
                lat = service.center.lat;
                lon = service.center.lon;
            } else {
                return;
            }

            const type =
                service.tags?.amenity ||
                service.tags?.tourism ||
                service.tags?.shop;

            let icon = icons.default;

            if (type === "fuel") icon = icons.fuel;
            else if (type === "hospital") icon = icons.hospital;
            else if (type === "pharmacy") icon = icons.pharmacy;
            else if (type === "restaurant") icon = icons.restaurant;
            else if (type === "hotel") icon = icons.hotel;
            else if (type === "car_repair") icon = icons.car_repair;

            // Optional: Map extra types if desired, or let them fall to default
            else if (type === "cafe") icon = icons.cafe;
            else if (type === "fast_food") icon = icons.fast_food;
            else if (type === "clinic") icon = icons.clinic;
            else if (type === "tyres") icon = icons.tyres;


            L.marker([lat, lon], { icon })
                .addTo(servicesLayer)
                .bindPopup(
                    `<strong>${service.tags?.name || "Unnamed"}</strong><br>${type}`
                );
        });
    }

    // --- 7. Fetch Services Along Route Logic ---
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function fetchServicesAlongRoute(route) {
        const coords = route.coordinates;
        if (!coords || coords.length === 0) return;

        // Reset
        servicesLayer.clearLayers();
        const box = document.getElementById("nearbyServices");
        if (box) box.innerHTML = "<div>Fetching services along route...</div>";

        // Loop with step 80 and delay
        for (let i = 0; i < coords.length; i += 80) {
            const point = coords[i];
            const latlng = L.latLng(point.lat, point.lng);

            // Call with append = true
            // Note: The very first call might ideally clear, but we cleared above manually.
            await fetchNearbyServices(latlng, true);

            // Prevent rate limiting
            await sleep(1000);
        }

        if (box && box.innerHTML === "<div>Fetching services along route...</div>") {
            box.innerHTML = "<div>Finished searching along route.</div>";
        }
    }

    // --- 6. Helper Functions ---
    async function geocodeLocation(location) {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
        if (!response.ok) throw new Error("Geocoding service unavailable");
        const data = await response.json();
        if (data && data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } else {
            throw new Error(`Location not found: ${location}`);
        }
    }

    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"));
            } else {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        resolve([position.coords.latitude, position.coords.longitude]);
                    },
                    (error) => {
                        let errorMsg = "Unable to retrieve your location";
                        if (error.code === error.PERMISSION_DENIED) {
                            errorMsg = "Location access denied. Please enable location services.";
                        }
                        reject(new Error(errorMsg));
                    }
                );
            }
        });
    }
});
