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
const elevationProfileTitleEl = document.getElementById("elevation-profile-title");
const weatherCardEl = document.getElementById("weather-card");
const weatherIconEl = document.getElementById("weather-icon");
const weatherTemperatureEl = document.getElementById("weather-temperature");
const weatherConditionEl = document.getElementById("weather-condition");
const weatherWindEl = document.getElementById("weather-wind");
const weatherRainEl = document.getElementById("weather-rain");
const weatherPrecipitationEl = document.getElementById("weather-precipitation");
const mountainOverviewCardEl = document.getElementById("mountain-overview-card");
const overviewParkingCountEl = document.getElementById("overview-parking-count");
const overviewRouteCountEl = document.getElementById("overview-route-count");
const overviewBestRouteEl = document.getElementById("overview-best-route");
const overviewDifficultyEl = document.getElementById("overview-difficulty");

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
let currentMountains = [];

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
let weatherRequestId = 0;

const hikingRouteBaseStyle = {
    weight: 5,
    opacity: 0.55
};

const hikingRouteHoverStyle = {
    weight: 8,
    opacity: 0.95
};

const map = L.map("map", {
    scrollWheelZoom: false
}).setView([47.8, 12.6], 9);

map.on("click", enableMapScrollZoom);
map.on("dragstart", enableMapScrollZoom);

map.on("mouseout", function() {
    map.scrollWheelZoom.disable();
});

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
    map.closePopup();
    clearParkingMarkers();
    elevationCardEl.classList.add("d-none");
    clearRoute();
    messageEl.textContent = "Route cleared.";
});

findParkingBtn.addEventListener("click", function() {
    map.closePopup();
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

    resetMountainOverview();

    loadMountainWeather(
        mountain.latitude,
        mountain.longitude
    );
}

function enableMapScrollZoom() {
    map.scrollWheelZoom.enable();
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

function clearElevationHoverMarker() {
    if (elevationHoverMarker) {
        map.removeLayer(elevationHoverMarker);
        elevationHoverMarker = null;
    }
}

function resetMountainOverview() {
    mountainOverviewCardEl.classList.add("d-none");
    overviewParkingCountEl.textContent = "-";
    overviewRouteCountEl.textContent = "-";
    overviewBestRouteEl.textContent = "-";
    overviewDifficultyEl.textContent = "-";
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

function getRouteIntensity(distanceMeters, ascentMeters, descentMeters, durationSeconds) {
    const distanceKm = distanceMeters / 1000;
    const ascent = ascentMeters || 0;
    const descent = descentMeters || 0;
    const durationHours = durationSeconds / 3600;

    let score = 0;

    score += distanceKm * 1.2;
    score += ascent / 120;
    score += descent / 250;
    score += durationHours * 2;

    if (score < 12) {
        return "Easy";
    }

    if (score < 22) {
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
    elevationCardEl.classList.add("d-none");

    if (elevationChart) {
        elevationChart.destroy();
        elevationChart = null;
    }
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
    clearElevationHoverMarker();

    if (currentStartPoint && currentMountains.length > 0) {
        fitMapToResults(
            currentStartPoint.latitude,
            currentStartPoint.longitude,
            currentMountains
        );
    }

    messageEl.textContent = "Route cleared.";
}

function resetSelectedMountainState() {
    selectedMountain = null;
    selectedNameEl.textContent = "None";
    selectedElevationEl.textContent = "-";
    selectedDistanceEl.textContent = "-";
    weatherRequestId += 1;
    weatherCardEl.classList.add("d-none");
    resetMountainOverview();
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
            currentMountains = data.mountains;

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
                            marker.closePopup();
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

function getWeatherDisplay(weatherCode) {
    const weatherCodes = {
        0: ["Clear sky", "bi-sun-fill"],
        1: ["Mostly clear", "bi-sun-fill"],
        2: ["Partly cloudy", "bi-cloud-sun-fill"],
        3: ["Overcast", "bi-clouds-fill"],
        45: ["Fog", "bi-cloud-fog2-fill"],
        48: ["Rime fog", "bi-cloud-fog2-fill"],
        51: ["Light drizzle", "bi-cloud-drizzle-fill"],
        53: ["Drizzle", "bi-cloud-drizzle-fill"],
        55: ["Heavy drizzle", "bi-cloud-drizzle-fill"],
        61: ["Light rain", "bi-cloud-rain-fill"],
        63: ["Rain", "bi-cloud-rain-heavy-fill"],
        65: ["Heavy rain", "bi-cloud-rain-heavy-fill"],
        71: ["Light snow", "bi-cloud-snow-fill"],
        73: ["Snow", "bi-cloud-snow-fill"],
        75: ["Heavy snow", "bi-cloud-snow-fill"],
        80: ["Rain showers", "bi-cloud-rain-fill"],
        81: ["Rain showers", "bi-cloud-rain-heavy-fill"],
        82: ["Heavy showers", "bi-cloud-rain-heavy-fill"],
        85: ["Snow showers", "bi-cloud-snow-fill"],
        86: ["Heavy snow showers", "bi-cloud-snow-fill"],
        95: ["Thunderstorm", "bi-cloud-lightning-rain-fill"],
        96: ["Thunderstorm with hail", "bi-cloud-lightning-rain-fill"],
        99: ["Severe thunderstorm", "bi-cloud-lightning-rain-fill"]
    };

    return weatherCodes[weatherCode] || ["Current conditions", "bi-cloud-fill"];
}

function displayWeatherValue(value, suffix, fallback = "Unavailable") {
    return value === null || value === undefined ? fallback : `${value}${suffix}`;
}

function loadMountainWeather(latitude, longitude) {
    const requestId = ++weatherRequestId;
    const url =
        `/api/mountain-weather/?latitude=${latitude}` +
        `&longitude=${longitude}`;

    weatherCardEl.classList.remove("d-none", "is-error");
    weatherIconEl.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i>';
    weatherTemperatureEl.textContent = "--°";
    weatherConditionEl.textContent = "Loading weather…";
    weatherWindEl.textContent = "-- km/h";
    weatherRainEl.textContent = "--%";
    weatherPrecipitationEl.textContent = "-- mm";

    fetchData(url)
        .then(function(data) {
            if (requestId !== weatherRequestId) return;

            const [condition, iconClass] = getWeatherDisplay(data.weather_code);
            weatherIconEl.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i>`;
            weatherTemperatureEl.textContent = displayWeatherValue(data.temperature, "°C");
            weatherConditionEl.textContent = condition;
            weatherWindEl.textContent = displayWeatherValue(data.wind_speed, " km/h");
            weatherRainEl.textContent = displayWeatherValue(data.precipitation_probability, "%");
            weatherPrecipitationEl.textContent = displayWeatherValue(data.precipitation, " mm");
        })
        .catch(function(error) {
            if (requestId !== weatherRequestId) return;

            console.error(error);
            weatherCardEl.classList.add("is-error");
            weatherIconEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill" aria-hidden="true"></i>';
            weatherTemperatureEl.textContent = "--°";
            weatherConditionEl.textContent = "Weather unavailable";
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
                    marker.closePopup();

                    selectedParking = parking;
                    showRouteToSelectedParking();
                });
            }

            const hikingBtn = popupElement.querySelector(".show-hiking-routes-btn");
            if (hikingBtn) {
                hikingBtn.addEventListener("click", function(){
                    marker.closePopup();

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
            mountainOverviewCardEl.classList.remove("d-none");
            overviewParkingCountEl.textContent = data.parkings.length;
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

function forceRouteToEndAtSelectedMountain(feature) {
    const coordinates = feature.geometry.coordinates;
    const last = coordinates[coordinates.length - 1];

    const mountainLng = selectedMountain.longitude;
    const mountainLat = selectedMountain.latitude;
    const mountainElevation = selectedMountain.elevation;

    const distanceToPeakKm = calculateDistanceBetweenCoordinates(
        last,
        [mountainLng, mountainLat, mountainElevation]
    );

    if (distanceToPeakKm > 0.05) {
        coordinates.push([
            mountainLng,
            mountainLat,
            mountainElevation
        ]);
    }
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

            const durations = data.features.map(function(feature) {
                return feature.properties.summary.duration;
            });

            const sortedDurations = [...durations].sort(function(a, b) {
                return a - b;
            })

            data.features.forEach(function(feature) {
                forceRouteToEndAtSelectedMountain(feature);
            });

            renderRouteSummary(data.features, sortedDurations);
            updateMountainOverviewRoutes(data.features, sortedDurations);

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

                    const estimatedDurationSeconds = estimateHikingDuration(summary.distance, ascent);
                    const duration = formatDuration(estimatedDurationSeconds);
                    const intensity = getRouteIntensity(
                        summary.distance, 
                        ascent, 
                        descent, 
                        estimatedDurationSeconds);

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

    routeSummaryCardEl.classList.remove("d-none");

    features.forEach(function(feature, index) {
        const summary = feature.properties.summary;
        const elevationStats = calculateElevationStats(feature.geometry.coordinates);

        const ascent = elevationStats ? elevationStats.ascent : null;
        const descent = elevationStats ? elevationStats.descent : null;
        const durationSeconds = estimateHikingDuration(summary.distance, ascent);
        const intensity = getRouteIntensity(
            summary.distance, 
            ascent, 
            descent, 
            durationSeconds);
        const color = getHikingRouteColor(feature, sortedDurations);

        const item = document.createElement("div");
        item.classList.add("route-summary-item");
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.setAttribute("aria-controls", "elevation-card");
        item.setAttribute("aria-label", `View elevation profile for route ${index + 1}`);

        item.innerHTML = `
            <div class="route-summary-text">
                <strong>Route ${index + 1} · ${color}</strong>
                <span>Distance: ${formatDistance(summary.distance)}</span>
                <span>Estimated time: ${formatDuration(durationSeconds)}</span>
                <span>Elevation gain: ${ascent !== null ? Math.round(ascent) + " m" : "unknown"}</span>
                <span>Elevation loss: ${descent !== null ? Math.round(descent) + " m" : "unknown"}</span>
                <span>Intensity: ${intensity}</span>
            </div>
            <div class="mini-elevation-panel" aria-label="Mini elevation profile">
                <canvas class="mini-elevation-chart" id="mini-elevation-chart-${index}"></canvas>
            </div>
            `;

        function openElevationProfile() {
            routeSummaryListEl.querySelectorAll(".route-summary-item").forEach(function(summaryItem) {
                summaryItem.classList.remove("is-selected");
                summaryItem.setAttribute("aria-pressed", "false");
            });

            item.classList.add("is-selected");
            item.setAttribute("aria-pressed", "true");
            renderElevationProfile(feature, `Route ${index + 1}`);
            elevationCardEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        item.setAttribute("aria-pressed", "false");
        item.addEventListener("click", openElevationProfile);
        item.addEventListener("keydown", function(event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openElevationProfile();
            }
        });

        routeSummaryListEl.appendChild(item);
        requestAnimationFrame(function() {
            renderMiniElevationChart(feature, `mini-elevation-chart-${index}`);
        });
    });
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

function renderElevationProfile(feature, routeLabel = "Selected hiking route") {
    const profileData = buildElevationProfileData(feature.geometry.coordinates);

    elevationCardEl.classList.remove("d-none");
    elevationProfileTitleEl.textContent = `${routeLabel} elevation`;

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
                tension: 0,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5,
                borderWidth: 3,
                backgroundColor: "rgba(31, 122, 77, 0.16)",
                segment: {
                    borderColor: function(context) {
                        const start = context.p0.parsed.y;
                        const end = context.p1.parsed.y;

                        return end >= start ? "#1f7a4d" : "#c87915";
                    }
                }
            }]
        },
        options: {
            responsive: true,
            interaction: {
                mode: "nearest",
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#17231b",
                        font: {
                            weight: "700"
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return `${context[0].raw.x.toFixed(2)} km`;
                        },
                        label: function(context) {
                            return `Elevation: ${Math.round(context.raw.y)} m`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    grid: {
                        color: "rgba(220, 229, 220, 0.8)"
                    },
                    ticks: {
                        callback: function(value) {
                            return `${Number(value).toFixed(1)} km`;
                        }
                    },
                    title: {
                        display: true,
                        text: "Distance",
                        color: "#687369",
                        font: {
                            weight: "700"
                        }
                    }
                },
                y: {
                    grid: {
                        color: "rgba(220, 229, 220, 0.8)"
                    },
                    ticks: {
                        callback: function(value) {
                            return `${Math.round(value)} m`;
                        }
                    },
                    title: {
                        display: true,
                        text: "Elevation",
                        color: "#687369",
                        font: {
                            weight: "700"
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

function renderMiniElevationChart(feature, canvasId) {
    const canvas = document.getElementById(canvasId);
    const profileData = buildElevationProfileData(feature.geometry.coordinates);
    const elevations = profileData.map(function(point) {
        return point.y;
    });
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const elevationPadding = Math.max(10, (maxElevation - minElevation) * 0.12);

    new Chart(canvas, {
        type: "line",
        data: {
            datasets: [{
                label: "Elevation",
                data: profileData,
                parsing: false,
                tension: 0,
                fill: false,
                pointRadius: 0,
                borderWidth: 2,
                segment: {
                    borderColor: function(context) {
                        const start = context.p0.parsed.y;
                        const end = context.p1.parsed.y;

                        return end >= start ? "#1f7a4d" : "#c87915";
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                line: {
                    borderJoinStyle: "round"
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${Math.round(context.raw.y)} m`;
                        }
                    }
                }
            },
            scales: {

                x: {
                    type: "linear",
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 4,
                        autoSkip: true,
                        callback: function(value) {
                            return `${Number(value).toFixed(1)} km`;
                        }
                    }
                },

                y: {
                    min: Math.floor(minElevation - elevationPadding),
                    max: Math.ceil(maxElevation + elevationPadding),
                    grid: {
                        color: "rgba(220, 229, 220, 0.8)"
                    },
                    ticks: {
                        maxTicksLimit: 4,
                        callback: function(value) {
                            return `${Math.round(value)} m`;
                        }
                    }
                }
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

function updateMountainOverviewRoutes(features, sortedDurations) {
    mountainOverviewCardEl.classList.remove("d-none");

    overviewRouteCountEl.textContent = features.length;

    bestRoute = null;

    features.forEach(function(feature) {
        const summary = feature.properties.summary;
        const elevationStats = calculateElevationStats(feature.geometry.coordinates);

        const ascent = elevationStats ? elevationStats.ascent : null;
        const descent = elevationStats ? elevationStats.descent : null;
        const durationSeconds = estimateHikingDuration(summary.distance, ascent);

        const intensity = getRouteIntensity(
            summary.distance,
            ascent,
            descent,
            durationSeconds
        );

        const color = getHikingRouteColor(feature, sortedDurations);

        if (!bestRoute || durationSeconds < bestRoute.duration) {
            bestRoute = {
                intensity: intensity,
                duration: durationSeconds,
                color: color
            };
        }

    });

    if (bestRoute) {
        overviewBestRouteEl.innerHTML = `
        <span class="route-badge route-${bestRoute.color}">
        ${bestRoute.color} route
        </span>
        <span class="overview-route-duration">${formatDuration(bestRoute.duration)}</span>
        `;

        overviewDifficultyEl.textContent = bestRoute.intensity;
    }
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
