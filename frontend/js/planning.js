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

                    // --- 7. Fetch Nearby Services Along Route ---
                    // fetchServicesAlongRoute(route); // Disabled to enforce backend-only services requirement
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
    // --- 5. Nearby Services Logic (Backend API) ---
    async function fetchNearbyServices(latlng) {
        servicesLayer.clearLayers();
        const servicesList = document.getElementById('servicesList');
        if (servicesList) {
            servicesList.innerHTML = '<li style="color: #777; font-size: 0.9rem;">Fetching nearby services... <i class="fas fa-spinner fa-spin"></i></li>';
        }

        // Show basic loading popup
        const loadingPopup = L.popup()
            .setLatLng(latlng)
            .setContent('<div style="text-align:center"><i class="fas fa-spinner fa-spin"></i> Finding services...</div>')
            .openOn(map);

        const lat = latlng.lat;
        const lon = latlng.lng;
        const radius = 2000; // 2km radius

        const url = `http://127.0.0.1:5000/api/services?lat=${lat}&lon=${lon}&radius=${radius}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Service fetch failed");
            const data = await response.json();

            // Close loading popup
            map.closePopup(loadingPopup);

            // Clear list
            if (servicesList) servicesList.innerHTML = '';

            let hasServices = false;
            let totalCount = 0;

            const categories = [
                { key: 'fuel', label: 'Fuel Station', icon: 'fa-gas-pump', color: '#f39c12' },
                { key: 'restaurants', label: 'Restaurant', icon: 'fa-utensils', color: '#e74c3c' },
                { key: 'hospitals', label: 'Hospital', icon: 'fa-hospital', color: '#c0392b' }
            ];

            categories.forEach(cat => {
                const items = data[cat.key] || [];
                items.forEach(item => {
                    hasServices = true;
                    totalCount++;
                    const name = item.name || "Unnamed";

                    // Add Marker
                    const serviceMarker = L.marker([item.lat, item.lon], {
                        icon: L.divIcon({
                            className: 'service-icon',
                            html: `<div style="background-color: ${cat.color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 1px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"><i class="fas ${cat.icon}"></i></div>`,
                            iconSize: [24, 24]
                        })
                    }).addTo(servicesLayer);

                    serviceMarker.bindPopup(`<b>${cat.label}</b><br>${name}`);

                    // Add to Sidebar
                    if (servicesList && totalCount <= 50) {
                        const listItem = document.createElement('li');
                        listItem.style.marginBottom = '8px';
                        listItem.style.borderBottom = '1px solid #f0f0f0';
                        listItem.style.paddingBottom = '5px';
                        listItem.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <i class="fas ${cat.icon}" style="color: ${cat.color}; font-size: 1.1rem;"></i>
                                <div>
                                    <div style="font-weight: 600; font-size: 0.9rem;">${name}</div>
                                    <div style="font-size: 0.8rem; color: #777;">${cat.label}</div>
                                </div>
                            </div>
                        `;
                        listItem.addEventListener('click', () => {
                            map.flyTo([item.lat, item.lon], 16);
                            serviceMarker.openPopup();
                        });
                        servicesList.appendChild(listItem);
                    }
                });
            });

            if (!hasServices) {
                L.popup().setLatLng(latlng).setContent("No major services found nearby.").openOn(map);
                if (servicesList) servicesList.innerHTML = '<li style="color: #777;">No services found nearby.</li>';
            } else {
                // Optionally show a summary popup or keep silent
            }

        } catch (error) {
            console.error("Backend API Error:", error);
            map.closePopup(loadingPopup);
            alert("Failed to fetch nearby services.");
            if (servicesList) servicesList.innerHTML = '<li style="color: #e74c3c;">Failed to load services. Check connection.</li>';
        }
    }

    // --- 7. Fetch Services Along Route Logic ---
    async function fetchServicesAlongRoute(route) {
        // Clear previous services from map and sidebar
        servicesLayer.clearLayers();
        const servicesList = document.getElementById('servicesList');
        servicesList.innerHTML = '<li style="color: #777; font-size: 0.9rem;">Fetching nearby services... <i class="fas fa-spinner fa-spin"></i></li>';

        const coordinates = route.coordinates;
        const totalDistance = route.summary.totalDistance; // in meters
        const samplingInterval = 15000; // 15 km in meters
        const searchRadius = 1200; // 1200 meters radius

        // Sample points along the route
        const samplePoints = [];
        let accumulatedDist = 0;
        let nextSampleDist = 0; // Start with the first point? Or offset? Let's start at 0.

        for (let i = 0; i < coordinates.length - 1; i++) {
            const p1 = L.latLng(coordinates[i].lat, coordinates[i].lng);
            const p2 = L.latLng(coordinates[i + 1].lat, coordinates[i + 1].lng);
            const segmentDist = p1.distanceTo(p2);

            if (accumulatedDist >= nextSampleDist) {
                samplePoints.push(p1);
                nextSampleDist += samplingInterval;
            }
            accumulatedDist += segmentDist;
        }
        // Ensure the last point is considered if the route is long enough
        if (samplePoints.length === 0 && coordinates.length > 0) {
            samplePoints.push(L.latLng(coordinates[0].lat, coordinates[0].lng));
        }

        console.log(`Sampling ${samplePoints.length} points for service search.`);

        if (samplePoints.length === 0) {
            servicesList.innerHTML = '<li style="color: #777;">No route points found.</li>';
            return;
        }

        // Build Overpass Query
        // We will combine queries for all sample points to minimize requests
        // Note: URL length limit might be an issue for very long routes.
        // If > 20 points, we might need to batch. For now, assuming student project scale (short/med trips).

        let queryElements = '';
        samplePoints.forEach(pt => {
            const lat = pt.lat;
            const lon = pt.lng;
            // Query for fuel, restaurants, hotels, hospitals, cafes, toilets
            queryElements += `
                node["amenity"="fuel"](around:${searchRadius},${lat},${lon});
                node["amenity"="restaurant"](around:${searchRadius},${lat},${lon});
                node["tourism"="hotel"](around:${searchRadius},${lat},${lon});
                node["amenity"="hospital"](around:${searchRadius},${lat},${lon});
                node["amenity"="cafe"](around:${searchRadius},${lat},${lon});
                node["amenity"="toilets"](around:${searchRadius},${lat},${lon});
            `;
        });

        const query = `
            [out:json][timeout:25];
            (
                ${queryElements}
            );
            out body;
        `;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Overpass API request failed");
            const data = await response.json();

            // Clear loading message
            servicesList.innerHTML = '';

            if (data.elements && data.elements.length > 0) {
                // Process and display unique services (remove duplicates if any)
                const uniqueServices = filterUniqueServices(data.elements);

                // Limit display to prevent clutter? Or show all found?
                // Let's show up to 50 items to keep performance sane
                const displayLimit = 50;
                const limitedServices = uniqueServices.slice(0, displayLimit);

                if (uniqueServices.length === 0) {
                    servicesList.innerHTML = '<li style="color: #777;">No specific services found nearby.</li>';
                    return;
                }

                limitedServices.forEach(element => {
                    const lat = element.lat;
                    const lon = element.lon;
                    const tags = element.tags;
                    const name = tags.name || "Unnamed Service";
                    let type = "Service";
                    let iconClass = "fa-map-marker-alt";
                    let color = "#7f8c8d";

                    if (tags.amenity === 'fuel') { type = "Fuel Station"; iconClass = "fa-gas-pump"; color = "#e67e22"; }
                    else if (tags.amenity === 'restaurant') { type = "Restaurant"; iconClass = "fa-utensils"; color = "#e74c3c"; }
                    else if (tags.tourism === 'hotel') { type = "Hotel"; iconClass = "fa-bed"; color = "#9b59b6"; }
                    else if (tags.amenity === 'hospital') { type = "Hospital"; iconClass = "fa-hospital"; color = "#c0392b"; }
                    else if (tags.amenity === 'cafe') { type = "Cafe"; iconClass = "fa-coffee"; color = "#d35400"; }
                    else if (tags.amenity === 'toilets') { type = "Restroom"; iconClass = "fa-restroom"; color = "#3498db"; }

                    // Add Marker to Map
                    const marker = L.marker([lat, lon], {
                        icon: L.divIcon({
                            className: 'service-icon',
                            html: `<div style="background-color: ${color}; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; border: 1px solid white;"><i class="fas ${iconClass}"></i></div>`,
                            iconSize: [20, 20]
                        })
                    }).addTo(servicesLayer);

                    marker.bindPopup(`<b>${type}</b><br>${name}`);

                    // Add item to sidebar list
                    const listItem = document.createElement('li');
                    listItem.style.marginBottom = '8px';
                    listItem.style.borderBottom = '1px solid #f0f0f0';
                    listItem.style.paddingBottom = '5px';
                    listItem.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <i class="fas ${iconClass}" style="color: ${color}; font-size: 1.1rem;"></i>
                            <div>
                                <div style="font-weight: 600; font-size: 0.9rem;">${name}</div>
                                <div style="font-size: 0.8rem; color: #777;">${type}</div>
                            </div>
                        </div>
                    `;
                    // Click list item to zoom to marker
                    listItem.addEventListener('click', () => {
                        map.flyTo([lat, lon], 16);
                        marker.openPopup();
                    });
                    servicesList.appendChild(listItem);
                });

                if (uniqueServices.length > displayLimit) {
                    const moreItem = document.createElement('li');
                    moreItem.style.color = '#777';
                    moreItem.style.fontStyle = 'italic';
                    moreItem.style.fontSize = '0.9rem';
                    moreItem.innerHTML = `And ${uniqueServices.length - displayLimit} more services...`;
                    servicesList.appendChild(moreItem);
                }

            } else {
                servicesList.innerHTML = '<li style="color: #777;">No services found along this route.</li>';
            }

        } catch (error) {
            console.error("Error fetching services:", error);
            servicesList.innerHTML = '<li style="color: #e74c3c;">Failed to load services. Check connection.</li>';
        }
    }

    function filterUniqueServices(elements) {
        const unique = [];
        const seen = new Set();
        elements.forEach(el => {
            if (!seen.has(el.id)) {
                unique.push(el);
                seen.add(el.id);
            }
        });
        return unique;
    }

    // --- End of New Logic ---

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
