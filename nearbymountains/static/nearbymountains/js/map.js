// Html elements
const messageEl = document.getElementById("message");
const radiusInput = document.getElementById("radius");
const locateBtn = document.getElementById("locate-btn");
const selectedNameEl = document.getElementById("selected-name");
const selectedElevationEl = document.getElementById("selected-elevation");
const selectedDistanceEl = document.getElementById("selected-distance");
const mountainlistEl = document.getElementById("mountain-list");
const locationInput = document.getElementById("location-input");
const minElevationInput = document.getElementById("min-elevation");
const maxElevationInput = document.getElementById("max-elevation");
const routeDistanceEl = document.getElementById("route-distance");
const routeDurationEl = document.getElementById("route-duration");
const routeSummaryCardEl = document.getElementById("route-summary-card");
const routeSummaryListEl = document.getElementById("route-summary-list");
const elevationCardEl = document.getElementById("elevation-card");
const elevationChartCanvas = document.getElementById("elevation-chart");

const mountainIcon = L.divIcon({
    className: "",
    html: '<span class="map-marker mountain-marker"><i class="bi bi-triangle-fill"></i></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
});

const parkingIcon = L.divIcon({
    className: "",
    html: '<span class="map-marker parking-marker"><i class="bi bi-car-front-fill"></i></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
});

const userIcon = L.divIcon({
    className: "",
    html: '<span class="map-marker user-marker"><i class="bi bi-person-standing"></i></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
});

const trailAccessIcon = L.divIcon({
    className: "",
    html: '<span class="map-marker trail-marker"><i class="bi bi-signpost-split-fill"></i></span>',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30]
});

let elevationChart = null;
let elevationHoverMarker = null;

// Buttons
const clearRouteBtn = document.getElementById("clear-route-btn");
const showRouteBtn = document.getElementById("show-route-btn");
const searchLocationBtn = document.getElementById("search-location-btn");
const findParkingBtn = document.getElementById("find-parking-btn");

let selectedMarker = null;
let currentStartPoint = null;
let selectedMountain = null;
let routeLine = null;
let parkingMarkers = [];
let selectedParking = null;

const hikingRouteBaseStyle = {
    weight: 5,
    opacity: 0.55
};

const hikingRouteHoverStyle = {
    weight: 8,
    opacity: 0.95
};

const map = L.map("map").setView([47.8, 12.6], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let userMarker = null;
let mountainMarkers = [];
let trailAccessMarkers = [];


// Event listeners.
showRouteBtn.addEventListener("click", function() {
    showRouteToSelectedMountain();
});

searchLocationBtn.addEventListener("click", function() {
    searchTypedLocation();
});

locationInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchTypedLocation();
    }
});

clearRouteBtn.addEventListener("click", function() {
    clearRoute();
});

findParkingBtn.addEventListener("click", function() {
    findNearbyParking();
})

locateBtn.addEventListener("click", function() {
    if (!navigator.geolocation) {
        messageEl.textContent = "Geolocation is not supported by your browser.";
        return;
    }

    messageEl.textContent = "Getting your location...";

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const radius = radiusInput.value || 50;

            currentStartPoint = {
                latitude: latitude,
                longitude: longitude
            };
            
            map.setView([latitude, longitude], 10);

            if (userMarker) {
                map.removeLayer(userMarker);
            }

            userMarker = L.marker([latitude, longitude], {
                icon: userIcon
            })
                .addTo(map)
                .bindPopup("You are here.")
                .openPopup();
            
            loadNearbyMountains(latitude, longitude, radius);
        },
        function() {
            messageEl.textContent = "Unable to retrieve your location";
        }
    );
});

// Formating functions 
function selectMountain(mountain) {
    selectedMountain = mountain;
    selectedNameEl.textContent = mountain.name;
    selectedElevationEl.textContent = `${mountain.elevation} m`;
    selectedDistanceEl.textContent = `${mountain.distance_km} km`;
}


function clearMountainMarkers() {
    mountainMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    mountainMarkers = [];
}

function clearTrailAccessMarkers(){
    trailAccessMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    trailAccessMarkers = [];
}

function renderTrailAccessMarkers(trailPoints){
    clearTrailAccessMarkers();

    trailPoints.forEach(function(point){
        const marker = L.marker([point.latitude, point.longitude], {
            icon: trailAccessIcon
        })
        .addTo(map)
        .bindPopup(
            `<strong>${point.name}</strong><br>
            Type: ${point.type}<br>
            OSM: ${point.osm_type} ${point.osm_id}
            Distance from parking: ${point.distance_from_parking_km} km`
        )

        trailAccessMarkers.push(marker);
    });
}

function fitMapToResults(latitude, longitude, mountains) {
    const bounds = [];

    bounds.push([latitude, longitude]);

    mountains.forEach(function(mountain) {
        bounds.push([mountain.latitude, mountain.longitude]);
    });

    map.fitBounds(bounds, {
        padding: [40, 40]
    });
}

function clearMountainList() {
    mountainlistEl.innerHTML = "";
}

function setActiveListItem(selectedItem) {
    const allitems = mountainlistEl.querySelectorAll("li");

    allitems.forEach(function(item) {
        item.classList.remove("active")
    });

    selectedItem.classList.add("active")
}

function formatDistance(meters) {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
}

function formatDuration(seconds) {
    const totalMinutes = Math.round(seconds / 60);

    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
        return `${hours} h`;
    }

    return `${hours} h ${minutes} min`;
}

function estimateHikingDuration(distanceMeters, ascentMeters) {
    const distanceKm = distanceMeters / 1000;
    const ascent = ascentMeters || 0;

    const distanceHours = distanceKm / 5;
    const ascentHours = ascent / 600;

    const totalSeconds = (distanceHours + ascentHours) * 3600;

    return totalSeconds;
}

function getRouteIntensity(distanceMeters, ascentMeters) {
    const distanceKm = distanceMeters / 1000;

    if (ascentMeters === null || ascentMeters === undefined) {
        if (distanceKm < 6) {
            return "Easy";
        }
    

        if (distanceKm < 12) {
            return "Moderate";
        }

        return "Hard";
    }

    if (distanceKm < 6 && ascentMeters < 300) {
        return "Easy";
    }

    if (distanceKm < 12 && ascentMeters < 800) {
        return "Moderate";
    }

    return "Hard";
}

function getHikingRouteColor(feature, sortedDurations) {
    const duration = feature.properties.summary.duration;

    if (duration === sortedDurations[0]) {
        return "green";
    }

    if (duration === sortedDurations[sortedDurations.length - 1]) {
        return "orange";
    }

    return "blue";
}

function getHikingRouteStyle(feature, sortedDurations) {
    return {
        color: getHikingRouteColor(feature, sortedDurations),
        weight: hikingRouteBaseStyle.weight,
        opacity: hikingRouteBaseStyle.opacity
    };
}

function calculateElevationStats(coordinates) {
    let ascent = 0;
    let descent = 0; 

    for (let i = 1; i < coordinates.length; i++) {
        const previousElevation = coordinates[i - 1][2];
        const currentElevation = coordinates[i][2];

        if (previousElevation === undefined || currentElevation === undefined) {
            return null;
        }

        const difference = currentElevation - previousElevation;

        if (difference > 0) {
            ascent += difference;
        } else {
            descent += Math.abs(difference);
        }
    }

    return {
        ascent: ascent,
        descent: descent
    };
}

function calculateDistanceBetweenCoordinates(coordA, coordB) {
    const lat1 = coordA[1];
    const lng1 = coordA[0];
    const lat2 = coordB[1];
    const lng2 = coordB[0];

    const earthRadiusKm = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusKm * c;
}

function clearRouteInfo() {
    routeDistanceEl.textContent = "";
    routeDurationEl.textContent = "";
}

function clearRouteSummary() {
    routeSummaryCardEl.classList.add("d-none");
    routeSummaryListEl.innerHTML = "";
}

function clearRouteLine() {
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }
}

function clearRoute() {
    clearRouteInfo();
    clearRouteLine();
    clearRouteSummary();
    messageEl.textContent = "Route cleared.";
}

function resetSelectedMountainState() {
    selectedMountain = null;
    selectedNameEl.textContent = "None";
    selectedElevationEl.textContent = "-";
    selectedDistanceEl.textContent = "-";
}

function resetMarker(marker) {
    if (selectedMarker) {
        selectedMarker.setOpacity(1);
    }
    marker.setOpacity(0.6);
    selectedMarker = marker
}

function clearParkingMarkers() {
    parkingMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    parkingMarkers = [];
    selectedParking = null;
}

// Rendering Data 
function loadNearbyMountains(latitude, longitude, radius) {
    let url = `/api/nearby-mountains/?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;

    if (minElevationInput.value) {
        url += `&min_elevation=${minElevationInput.value}`;
    }

    if (maxElevationInput.value) {
        url += `&max_elevation=${maxElevationInput.value}`;
    }

    clearRouteInfo();
    if (selectedMarker) {
        selectedMarker = null;
    }
    resetSelectedMountainState();


    fetchData(url)
        .then(function(data){
            clearMountainMarkers();

            if (data.mountains.length === 0) {
                messageEl.textContent = "No mountains found within this radius."
                return;
            }

            messageEl.textContent = `Found ${data.mountains.length} nearby mountains.`;

            const markerMap = new Map(); 

            data.mountains.forEach(function(mountain) {
                const marker = L.marker([mountain.latitude, mountain.longitude], {
                    icon: mountainIcon
                })
                    .addTo(map)
                    .bindPopup(
                        `<strong>${mountain.name}</strong><br>
                        Elevation: ${mountain.elevation} m<br>
                        Distance: ${mountain.distance_km} km<br>
                        <button type="button" class="find-parking-near-mountain-btn">Find parking nearby</button>`
                    );
                
                marker.on("click", function() {
                    resetMarker(marker);
                    selectMountain(mountain);

                    const listItems = mountainlistEl.querySelectorAll("li");
                    listItems.forEach(function(item) {
                        if (item.textContent.includes(mountain.name)) {
                            setActiveListItem(item);
                        }
                    });
                });

                marker.on("popupopen", function(event) {
                    const popupElement = event.popup.getElement();
                    const parkingBtn = popupElement.querySelector(".find-parking-near-mountain-btn");

                    if (parkingBtn) {
                        parkingBtn.addEventListener("click", function() {
                            resetMarker(marker);
                            selectMountain(mountain);
                            map.setView([mountain.latitude, mountain.longitude], 13);
                            findNearbyParking();
                        });
                    }
                });
            
                mountainMarkers.push(marker);
                markerMap.set(mountain.name, marker);
            });

            renderMountainList(data.mountains, markerMap);
            fitMapToResults(latitude, longitude, data.mountains);
        })
        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not load mountain data.";
        });
}

function renderMountainList(mountains, markerMap) {
    clearMountainList();

    mountains.forEach(function(mountain) {
        const listItem = document.createElement("li");

        listItem.innerHTML = `
            <span class="list-marker"><i class="bi bi-triangle-fill"></i></span>
            <span class="list-content">
                <strong>${mountain.name}</strong>
                <span>Elevation: ${mountain.elevation} m</span>
                <span>Distance: ${mountain.distance_km} km</span>
            </span>
            `;


        listItem.addEventListener("click", function() {
            selectMountain(mountain);
            setActiveListItem(listItem);

            const marker = markerMap.get(mountain.name);
            if (marker) {
                resetMarker(marker);
                map.setView([mountain.latitude, mountain.longitude], 12);
                marker.openPopup();
            }
        });

        mountainlistEl.appendChild(listItem);
    });
}

function searchTypedLocation() {
    const query = locationInput.value.trim();
    const radius = radiusInput.value || 50;

    if (!query) {
        messageEl.textContent = "Please enter a location.";
        return;
    }

    messageEl.textContent = "Searching for location...";

    const url = `/api/geocode-location/?query=${encodeURIComponent(query)}`;

    fetchData(url)
        .then(function(data){
            const latitude = data.latitude;
            const longitude = data.longitude;

            currentStartPoint = {
                latitude: latitude,
                longitude: longitude
            };

            map.setView([latitude, longitude], 10);

            if (userMarker) {
                map.removeLayer(userMarker);
            }

            userMarker = L.marker([latitude, longitude], {
                icon: userIcon
            })
                .addTo(map)
                .bindPopup(`Searched location: ${data.display_name}`)
                .openPopup();

                loadNearbyMountains(latitude, longitude, radius);
        })
        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not search for the typed location.";
        });
}

function showRouteToSelectedMountain() {
    if (!currentStartPoint) {
        messageEl.textContent = "Please use your location or search for a location first.";
        return;
    }

    if (!selectedMountain) {
        messageEl.textContent = "Please select a mountain first.";
        return;
    }

    clearRouteInfo();

    const routeProfile = "foot-hiking";
    const routeProfileLabel = "hiking"; 

    messageEl.textContent = `Loading ${routeProfileLabel} route...`;

    const url = `/api/mountain-route/?start_lat=${currentStartPoint.latitude}&start_lng=${currentStartPoint.longitude}&end_lat=${selectedMountain.latitude}&end_lng=${selectedMountain.longitude}&profile=${encodeURIComponent(routeProfile)}`;

    fetchData(url)
        .then(function(data){

        clearRouteLine();

        routeLine = L.geoJSON(data, {
            style: function() {
                return {
                    weight: 5,
                    opacity: 0.8
                };
            }
        }).addTo(map);
        map.fitBounds(routeLine.getBounds(), {
            padding: [40, 40]
        });

        const summary = data.features[0].properties.summary;
        
        if (!summary) {
            messageEl.textContent = "Route loaded, but no summary information was found.";
            return;
        }

        routeDistanceEl.textContent = `Route distance: ${formatDistance(summary.distance)}`;
        routeDurationEl.textContent = `Route duration: ${formatDuration(summary.duration)}`;

        messageEl.textContent = "Route Loaded.";
        })

        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not load route.";
        });
}

function renderParkingMarkers(parkings) {
    clearParkingMarkers();

    parkings.forEach(function(parking) {
        const marker = L.marker([parking.latitude, parking.longitude], {
            icon : parkingIcon
        })
            .addTo(map)
            .bindPopup(
                `<strong>${parking.name}</strong><br>
                Type: ${parking.type}<br>
                OSM: ${parking.osm_type} ${parking.osm_id}<br>
                Routing Target: ${parking.route_target_type}<br>
                Distance to mountain: ${parking.distance_to_mountain_km} km<br>
                <button type="button" class="route-to-parking-btn">Route here</button><br>
                <button type="button" class="show-hiking-routes-btn">Show Hiking Routes</button>`
            );

        marker.on("popupopen", function(event) {
            const popupElement = event.popup.getElement();
            const routeBtn = popupElement.querySelector(".route-to-parking-btn");
            if (routeBtn) {
                routeBtn.addEventListener("click", function() {
                    selectedParking = parking;
                    showRouteToSelectedParking();
                });
            }

            const hikingBtn = popupElement.querySelector(".show-hiking-routes-btn");
            if (hikingBtn) {
                hikingBtn.addEventListener("click", function(){
                    selectedParking = parking;
                    showHikingRoutesFromParking();
                });
            }
        });

        parkingMarkers.push(marker);

    });
}

function findNearbyParking() {
    if (!selectedMountain) {
        messageEl.textContent = "Please select a mountain first.";
        return;
    }

    messageEl.textContent = "Searching for nearby parking...";

    const url = `/api/nearby-parking/?latitude=${selectedMountain.latitude}&longitude=${selectedMountain.longitude}`;

    fetchData(url) 
        .then(function(data){
            if (data.parkings.length === 0) {
                messageEl.textContent = "No nearby parking found.";
                return;
            }

            renderParkingMarkers(data.parkings);
            messageEl.textContent = `Found ${data.parkings.length} nearby parking options.`;
        })
        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not load nearby parking.";
        });
}

function showRouteToSelectedParking() {
    if (!currentStartPoint) {
        messageEl.textContent = "Please use your location, or search for a location first.";
        return;
    }

    if (!selectedParking) {
        messageEl.textContent = "Please select a parking location fist.";
        return;
    }

    clearRouteInfo()

    const url = `/api/mountain-route/?start_lat=${currentStartPoint.latitude}&start_lng=${currentStartPoint.longitude}&end_lat=${selectedParking.route_latitude}&end_lng=${selectedParking.route_longitude}&profile=driving-car`;

    fetchData(url)
        .then(function(data){
            clearRouteLine();

            routeLine = L.geoJSON(data, {
                style: function() {
                    return {
                        weight: 5,
                        opacity: 0.8
                    };
                }
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), {
                padding: [40, 40] 
            });

            const summary = data.features?.[0]?.properties?.summary;
            if (summary) {
                routeDistanceEl.textContent = `Route distance: ${formatDistance(summary.distance)}`;
                routeDurationEl.textContent = `Route duration: ${formatDuration(summary.duration)}`;
            }

            messageEl.textContent = "Route to parking loaded.";
        })
        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not load the route to parking.";
        });
}

function findTrailAccessPoints(){
    if (!selectedParking) {
        messageEl.textContent = "Please select a parking location first.";
        return
    }

    messageEl.textContent = "Searching for trail access points...";

    const url = `/api/trail-access-points/?latitude=${selectedParking.latitude}&longitude=${selectedParking.longitude}`;

    fetchData(url)
        .then(function(data){
            if (data.trail_points.length === 0){
                messageEl.textContent = "No trail access points found near this parking.";
                return;
            }

            renderTrailAccessMarkers(data.trail_points);
            messageEl.textContent = `Found ${data.trail_points.length} trail access points.`;
        })
        .catch(function(error) {
            console.error(error);
            messageEl.textContent = "Could not load trail access points."
            });
}

function showHikingRoutesFromParking() {
    if (!selectedMountain) {
        messageEl.textContent = "Please select a mountain first.";
        return;
    }

    if (!selectedParking) {
        messageEl.textContent = "Please select a parking first.";
        return;
    }

    messageEl.textContent = "Loading viable route options...";
    clearRouteInfo();
    clearRouteLine();

    const url = 
        `/api/mountain-route/?start_lat=${selectedParking.route_latitude}` +
        `&start_lng=${selectedParking.route_longitude}` +
        `&end_lat=${selectedMountain.latitude}` +
        `&end_lng=${selectedMountain.longitude}` +
        `&profile=foot-hiking&alternatives=true`; 

    fetchData(url)
        .then(function(data) {
            clearRouteLine();
            console.log(data.features[0].properties.summary);
            console.log("First Coordinate:", data.features[0].geometry.coordinates[0]);

            const durations = data.features.map(function(feature) {
                return feature.properties.summary.duration;
            });

            const sortedDurations = [...durations].sort(function(a, b) {
                return a - b;
            })

            renderRouteSummary(data.features, sortedDurations);

            routeLine = L.geoJSON(data, {
                style: function(feature) {
                    return getHikingRouteStyle(feature, sortedDurations);
                },

                onEachFeature: function(feature, layer) {
                    const summary = feature.properties.summary;

                    const distance = formatDistance(summary.distance);

                    const elevationStats = calculateElevationStats(feature.geometry.coordinates);

                    const ascent = elevationStats ? elevationStats.ascent : null;
                    const descent = elevationStats ? elevationStats.descent : null;
                    const intensity = getRouteIntensity(summary.distance, ascent);

                    const estimatedDurationSeconds = estimateHikingDuration(summary.distance, ascent);
                    const duration = formatDuration(estimatedDurationSeconds);

                    layer.bindPopup(
                        `<strong>Hiking route</strong><br>
                        Distance: ${distance}<br>
                        Duration: ${duration}<br>
                        Elevation gain: ${ascent !== undefined ? Math.round(ascent) + " m" : "Unknown"}<br>
                        Elevation loss: ${descent !==undefined ? Math.round(descent) + " m" : "Unknown"}<br>
                        Intensity: ${intensity}`
                    );

                    layer.on({
                        mouseover: function(event) {
                            event.target.setStyle(hikingRouteHoverStyle);
                            event.target.bringToFront();
                        },
                        mouseout: function(event) {
                            event.target.setStyle(getHikingRouteStyle(feature, sortedDurations));
                        }
                    });

                    layer.on("click", function() {
                        renderElevationProfile(feature);
                    });
                }
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), {
                padding: [40, 40]
            });

            const summary = data.features?.[0]?.properties?.summary;

            if (summary) {
                routeDistanceEl.textContent = 
                `Hiking distance: ${formatDistance(summary.distance)}`;
                
                routeDurationEl.textContent = 
                `Route duration: ${formatDuration(summary.duration)}`;
            }

            messageEl.textContent = "Hiking route options loaded.";
        })
        .catch(function(error){
            console.error(error);
            messageEl.textContent = "Could not load hike routes.";
        });
}

function renderRouteSummary(features, sortedDurations) {
    clearRouteSummary();

    features.forEach(function(feature, index) {
        const summary = feature.properties.summary;
        const elevationStats = calculateElevationStats(feature.geometry.coordinates);

        const ascent = elevationStats ? elevationStats.ascent : null;
        const durationSeconds = estimateHikingDuration(summary.distance, ascent);
        const intensity = getRouteIntensity(summary.distance, ascent);
        const color = getHikingRouteColor(feature, sortedDurations);

        const item = document.createElement("div");
        item.classList.add("route-summary-item");

        item.innerHTML = `
            <strong>Route ${index + 1} · ${color}</strong>
            <span>Distance: ${formatDistance(summary.distance)}</span>
            <span>Estimated time: ${formatDuration(durationSeconds)}</span>
            <span>Elevation gain: ${ascent !== null ? Math.round(ascent) + " m" : "unknown"}</span>
            <span>Intensity: ${intensity}</span>
            `;

            routeSummaryListEl.appendChild(item)
    });

    routeSummaryCardEl.classList.remove("d-none");
}

function buildElevationProfileData(coordinates) {
    const profile = [];
    let cumulativeDistanceKm = 0;

    for (let i = 0; i < coordinates.length; i++) {
        if (i > 0) {
            cumulativeDistanceKm += calculateDistanceBetweenCoordinates(
                coordinates[i-1],
                coordinates[i]
            );
        }

        profile.push({
            x: Number(cumulativeDistanceKm.toFixed(2)),
            y: coordinates[i][2],
            coordinate: coordinates[i]
        });
    }

    return profile
}

function renderElevationProfile(feature) {
    const profileData = buildElevationProfileData(feature.geometry.coordinates);
    console.log("Profile first:", profileData[0]);
    console.log("Profile last:", profileData[profileData.length - 1]);

    elevationCardEl.classList.remove("d-none");

    if (elevationChart) {
        elevationChart.destroy();
    }

    elevationChart = new Chart(elevationChartCanvas, {
        type: "line",
        data: {
            datasets: [{
                label: "Elevation",
                data: profileData,
                parsing: false,
                tension: 0.25,
                fill: true
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: "nearest",
                intersect: false
            },
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: "Distance (km)"
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: "Elevation (m)"
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Elevation: ${Math.round(context.raw.y)} ,`;
                        }
                    }
                }
            },
            onHover: function(event, elements) {
                if (elements.length === 0) {
                    return;
                }

                const index = elements[0].index;
                const coord = profileData[index].coordinate;

                moveElevationHoverMarker(coord);
            }
        }
    });
}

function moveElevationHoverMarker(coord) {
    const lat = coord[1];
    const lng = coord[0];
    const elevation = coord[2];

    if (!elevationHoverMarker) {
        elevationHoverMarker = L.circleMarker([lat, lng], {
            radius: 7,
            weight: 3,
            fillOpacity: 0.9
        }).addTo(map);
    } else {
        elevationHoverMarker.setLatLng([lat, lng]);
    }

    elevationHoverMarker.bindTooltip(`${Math.round(elevation)} m`).openTooltip();
}

function fetchData(url) {
    return fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if(data.error) {
                throw new Error(data.error);
            }

            return data;
        });
}
