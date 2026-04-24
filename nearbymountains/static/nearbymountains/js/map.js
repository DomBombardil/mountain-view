// Html elements
const messageEl = document.getElementById("message");
const radiusInput = document.getElementById("radius");
const locateBtn = document.getElementById("locate-btn");
const selectedNameEl = document.getElementById("selected-name");
const selectedElevationEl = document.getElementById("selected-elevation");
const selectedDistanceEl = document.getElementById("selected-distance");
const mountainlistEl = document.getElementById("mountain-list");
const locationInput = document.getElementById("location-input");
const routeDistanceEl = document.getElementById("route-distance");
const routeDurationEl = document.getElementById("route-duration");
const routeProfileEl = document.getElementById("route-profile");

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

const map = L.map("map").setView([47.8, 12.6], 9);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let userMarker = null;
let mountainMarkers = [];

function clearMountainMarkers() {
    mountainMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    mountainMarkers = [];
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

function renderMountainList(mountains, markerMap) {
    clearMountainList();

    mountains.forEach(function(mountain) {
        const listItem = document.createElement("li");

        listItem.innerHTML = ` 
            <strong>${mountain.name}</strong><br>
            Elevation: ${mountain.elevation} m<br>
            Distance: ${mountain.distance_km} km
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

    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.error) {
                messageEl.textContent = data.error;
                return;
            }

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

            userMarker = L.marker([latitude, longitude])
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

function loadNearbyMountains(latitude, longitude, radius) {
    const url = `/api/nearby-mountains/?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;
    clearRouteInfo();
    if (selectedMarker) {
        selectedMarker = null;
    }
    resetSelectedMountainState();


    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data){
            if (data.error) {
                messageEl.textContent = data.error;
                return;
            }

            clearMountainMarkers();

            if (data.mountains.length === 0) {
                messageEl.textContent = "No mountains found within this radius."
                return;
            }

            messageEl.textContent = `Found ${data.mountains.length} nearby mountains.`;

            const markerMap = new Map(); 

            data.mountains.forEach(function(mountain) {
                const marker = L.marker([mountain.latitude, mountain.longitude])
                    .addTo(map)
                    .bindPopup(
                        `<strong>${mountain.name}</strong><br>
                        Elevation: ${mountain.elevation} m<br>
                        Distance: ${mountain.distance_km} km`
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

            userMarker = L.marker([latitude, longitude])
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
// End of event listeners.

function selectMountain(mountain) {
    selectedMountain = mountain;
    selectedNameEl.textContent = mountain.name;
    selectedElevationEl.textContent = `Elevation: ${mountain.elevation} m`;
    selectedDistanceEl.textContent = `Distance ${mountain.distance_km} km`;
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

function clearRouteInfo() {
    routeDistanceEl.textContent = "";
    routeDurationEl.textContent = "";
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
    messageEl.textContent = "Route cleared.";
}

function resetSelectedMountainState() {
    selectedMountain = null;
    selectedNameEl.textContent = "None";
    selectedElevationEl.textContent = "";
    selectedDistanceEl.textContent = "";
}

function resetMarker(marker) {
    if (selectedMarker) {
        selectedMarker.setOpacity(1);
    }
    marker.setOpacity(0.6);
    selectedMarker = marker
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

    const routeProfile = routeProfileEl.value;
    const routeProfileLabel = routeProfile === "driving-car" ? "driving" : "hiking";

    messageEl.textContent = `Loading ${routeProfileLabel} route...`;

    const url = `/api/mountain-route/?start_lat=${currentStartPoint.latitude}&start_lng=${currentStartPoint.longitude}&end_lat=${selectedMountain.latitude}&end_lng=${selectedMountain.longitude}&profile=${encodeURIComponent(routeProfile)}`;

    fetch(url)
        .then(function(response) {
            return response.json();
        })

        .then(function(data) {
            if (data.error) {
                messageEl.textContent = data.error;
                return;
            }


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

function clearParkingMarkers() {
    parkingMarkers.forEach(function(marker) {
        map.removeLayer(marker);
    });

    parkingMarkers = [];
    selectedParking = null;
}

function renderParkingMarkers(parkings) {
    clearParkingMarkers();

    parkings.forEach(function(parking) {
        const marker = L.marker([parking.latitude, parking.longitude])
            .addTo(map)
            .bindPopup(
                `<strong>${parking.name}</strong><br>
                Distance to mountain: ${parking.distance_to_mountain_km} km <br>
                <button type="button" class="route-to-parking-btn>Route here</button>`
            );

        marker.on("popupopen", function() {
            const btn = document.querySelector(".route-to-parking-btn");
            if (btn) {
                btn.addEventListener("click", function() {
                    selectedParking = parking;
                    showRuteToSelectedParking();
                });
            }
        });

        parkingMarkers.push(marker);

    });
}

function findNearbyParking() {
    if (!selectMountain) {
        messageEl.textContent = "Please select a mountain first.";
        return;
    }

    messageEl.textContent = "Searching for nearby parking...";

    const url = `/api/nearby-parking/?latitude=${selectedMountain.latitude}&longitude${selectedMountain.longitude}`;

    fetch(url)
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.error) {
                messageEl.textContent = data.error;
                return;
            }

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