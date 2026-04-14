const messageEl = document.getElementById("message");
const radiusInput = document.getElementById("radius");
const locateBtn = document.getElementById("locate-btn");
const selectedNameEl = document.getElementById("selected-name");
const selectedElevationEl = document.getElementById("selected-elevation");
const selectedDistanceEl = document.getElementById("selected-distance");

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

            data.mountains.forEach(function(mountain) {
                const marker = L.marker([mountain.latitude, mountain.longitude])
                    .addTo(map)
                    .bindPopup(
                        `<strong>${mountain.name}</strong><br>
                        Elevation: ${mountain.elevation} m<br>
                        Distance: ${mountain.distance_km} km`
                    );
                
                marker.on("click", function() {
                    if (selectedMarker) {
                        selectedMarker.setOpacity(1);
                    }
                    marker.setOpacity(0.5);
                    selectedMarker = marker;
                    
                    selectMountain(mountain);
                    map.setView([mountain.latitude, mountain.longitude], 12);
                });
            
                mountainMarkers.push(marker);
            });
        })
        .catch(function() {
            messageEl.textContent = "Could not load mountain data.";
        });
}

locateBtn.addEventListener("click", function() {
    if (!navigator.geolocation) {
        messageEl.textContent = "Geolocation is not suported by your browser.";
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
    selectedDistanceEl.textContent = `Distance ${mountain.distance} km`;
}