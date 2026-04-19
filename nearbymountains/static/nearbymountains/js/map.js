const messageEl = document.getElementById("message");
const radiusInput = document.getElementById("radius");
const locateBtn = document.getElementById("locate-btn");
const selectedNameEl = document.getElementById("selected-name");
const selectedElevationEl = document.getElementById("selected-elevation");
const selectedDistanceEl = document.getElementById("selected-distance");
const mountainlistEl = document.getElementById("mountain-list");
const locationInput = document.getElementById("location-input");
const searchLocationBtn = document.getElementById("search-location-btn");

let selectedMarker = null;

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
            console.error(error)
            messageEl.textContent = "Could not load mountain data.";
        });
}

// Event listeners.
searchLocationBtn.addEventListener("click", function() {
    searchTypedLocation();
});

locationInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        searchTypedLocation();
    }
});

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

function selectMountain(mountain) {
    selectedNameEl.textContent = mountain.name;
    selectedElevationEl.textContent = `Elevation: ${mountain.elevation} m`;
    selectedDistanceEl.textContent = `Distance ${mountain.distance_km} km`;
}
