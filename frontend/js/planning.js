document.addEventListener('DOMContentLoaded', function () {
    // --- 1. Map Initialization (Must be first) ---
    let map;
    let pitstopLayer;
    let servicesLayer;
    let routingControl = null;
    let currentRoute = null;

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
        servicesLayer.clearLayers(); // Clear services when recalculating

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
                    fetchNearbyServices(stopLatLng);
                });

                nextStopDist += intervalKm * 1000;
            }
            currentDist += segmentDist;
        }
        document.getElementById('stops-val').textContent = stopCount;
    }

    // --- 5. Nearby Services Logic (Overpass API) ---
    async function fetchNearbyServices(latlng) {
        servicesLayer.clearLayers();

        // Show basic loading popup
        const loadingPopup = L.popup()
            .setLatLng(latlng)
            .setContent('<div style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Finding services...</div>')
            .openOn(map);

        const radius = 2000; // 2km radius
        const lat = latlng.lat;
        const lon = latlng.lng;

        const query = `
            [out:json][timeout:25];
            (
              node["amenity"="hospital"](around:${radius},${lat},${lon});
              node["amenity"="fuel"](around:${radius},${lat},${lon});
              node["tourism"="hotel"](around:${radius},${lat},${lon});
              node["amenity"="toilets"](around:${radius},${lat},${lon});
              node["shop"="car_repair"](around:${radius},${lat},${lon});
              node["amenity"="pharmacy"](around:${radius},${lat},${lon});
            );
            out body;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Service fetch failed");
            const data = await response.json();

            // Close loading popup
            map.closePopup(loadingPopup);

            if (data.elements && data.elements.length > 0) {
                let count = 0;
                data.elements.forEach(element => {
                    let iconColor = 'gray';
                    let iconClass = 'fa-map-marker';
                    let type = 'Unknown';

                    if (element.tags.amenity === 'hospital') {
                        iconColor = '#e74c3c'; iconClass = 'fa-hospital'; type = 'Hospital';
                    } else if (element.tags.amenity === 'fuel') {
                        iconColor = '#f39c12'; iconClass = 'fa-gas-pump'; type = 'Petrol Pump';
                    } else if (element.tags.tourism === 'hotel') {
                        iconColor = '#9b59b6'; iconClass = 'fa-bed'; type = 'Hotel';
                    } else if (element.tags.amenity === 'toilets') {
                        iconColor = '#3498db'; iconClass = 'fa-restroom'; type = 'Restroom';
                    } else if (element.tags.shop === 'car_repair') {
                        iconColor = '#34495e'; iconClass = 'fa-wrench'; type = 'Mechanic';
                    } else if (element.tags.amenity === 'pharmacy') {
                        iconColor = '#27ae60'; iconClass = 'fa-pills'; type = 'Pharmacy';
                    }

                    const serviceMarker = L.marker([element.lat, element.lon], {
                        icon: L.divIcon({
                            className: 'service-icon',
                            html: `<div style="background-color: ${iconColor}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas ${iconClass}"></i></div>`,
                            iconSize: [24, 24]
                        })
                    }).addTo(servicesLayer);

                    const name = element.tags.name || "Unnamed";
                    serviceMarker.bindPopup(`<b>${type}</b><br>${name}`);
                    count++;
                });

                // Optional: Show summary popup
                // L.popup().setLatLng(latlng).setContent(`Found ${count} services.`).openOn(map);

            } else {
                L.popup().setLatLng(latlng).setContent("No major services found nearby.").openOn(map);
            }

        } catch (error) {
            console.error("Overpass API Error:", error);
            map.closePopup(loadingPopup);
            alert("Failed to fetch nearby services.");
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
