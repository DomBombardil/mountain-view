from django.shortcuts import render
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django.http import JsonResponse

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError, GeocoderTimedOut

import math
import os
import requests
from django.views.decorators.http import require_GET

from .models import Mountain

# Formula to calculate the distance between 2 points on a spehere.
def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return r * c


def mountain_map(request):
    return render(request, "nearbymountains/map.html")

def nearby_mountains_api(request):
    latitude = request.GET.get("latitude")
    longitude = request.GET.get("longitude")
    radius = request.GET.get("radius", 50)

    if not latitude or not longitude:
        return JsonResponse(
            {"error": "Latitude and longitude are required."},
            status=400
        )

    try:
        latitude = float(latitude)
        longitude = float(longitude)
        radius = float(radius)

    except ValueError:
        return JsonResponse(
            {"error": "Latitude, longitude and radius must be numbers."},
            status = 400
        )
    
    if not (-90 <= latitude <= 90):
        return JsonResponse(
            {"error": "Latitude must be between -90 and 90."},
            status = 400
        )
    if not (-180 <= longitude <= 180):
        return JsonResponse(
            {"error": "Longitude must be between -180 and 180."},
            status = 400
        )
    if radius <= 0:
        return JsonResponse(
            {"error": "Radius must be greater than 0."},
            status = 400
        )

    user_location = Point(longitude, latitude, srid=4326)

    mountains = (
        Mountain.objects.annotate(
            distance=Distance("location", user_location)
        )
        .filter(location__distance_lte=(user_location, D(km=radius)))
        .order_by("distance")[:20]
    )

    results = []
    for mountain in mountains:
        results.append(
            {
                "name": mountain.name,
                "elevation": mountain.elevation,
                "distance_km": round(mountain.distance.km, 2),
                "latitude": mountain.location.y,
                "longitude": mountain.location.x
            }
        )

    return JsonResponse({"mountains": results})

def mountain_search(request):
    """
    LEGACY (server-rendered) view.
    Kept for reference/testing.
    Main app uses API endpoints + JS (map.html).
    """
    mountains = []
    error_message = None
    searched_location = ""
    latitude = ""
    longitude = ""
    radius = 50

    if request.method == "GET":
        searched_location = request.GET.get("location_query", "").strip()
        latitude = request.GET.get("latitude", "").strip()
        longitude = request.GET.get("longitude", "").strip()
        radius_raw = request.GET.get("radius", "").strip()

        if radius_raw:
            try:
                radius = float(radius_raw)
                if radius <= 0:
                    raise ValueError
            except ValueError:
                error_message = "Radius must be a positive number."
                radius = 50

        user_location = None

        # Option 1: browser location
        if latitude and longitude and not error_message:
            try:
                latitude = float(latitude)
                longitude = float(longitude)

                if not (-90 <= latitude <= 90):
                    raise ValueError("Latitude must be between -90 and 90.")
                if not (-180 <= longitude <= 180):
                    raise ValueError("Longitude must be between -180 and 180.")

                user_location = Point(longitude, latitude, srid=4326)

            except ValueError as e:
                error_message = str(e)

        # Option 2: typed location
        elif searched_location and not error_message:
            geolocator = Nominatim(user_agent="nearby-mountain-finder-1.0")

            try:
                location = geolocator.geocode(searched_location, exactly_one=True, timeout=10)

                if location is None:
                    error_message = "Location not found. Try a more specific search."
                else:
                    latitude = location.latitude
                    longitude = location.longitude
                    user_location = Point(longitude, latitude, srid=4326)

            except (GeocoderTimedOut, GeocoderServiceError):
                error_message = "Geocoding service is temporarily unavailable. Please try again."

        if user_location and not error_message:
            mountains = (
                Mountain.objects.annotate(
                    distance=Distance("location", user_location)
                )
                .filter(location__distance_lte=(user_location, D(km=radius)))
                .order_by("distance")[:10]
            )

    context = {
        "mountains": mountains,
        "error_message": error_message,
        "searched_location": searched_location,
        "latitude": latitude,
        "longitude": longitude,
        "radius": radius,
    }

    return render(request, "nearbymountains/index.html", context)

def geocode_location_api(request):
    query = request.GET.get("query", "").strip()

    if not query:
        return JsonResponse({"error": "Location query is required."}, status=400)
    
    geolocator = Nominatim(user_agent="nearby-mountain-finder-1.0")

    try:
        location = geolocator.geocode(query, exactly_one=True, timeout=10)

        if location is None:
            return JsonResponse(
                {"error": "Location not found. Try a more specific search."},
                status=404
            )
        
        return JsonResponse({
            "latitude": location.latitude,
            "longitude": location.longitude,
            "display_name": location.address,
        })

    except (GeocoderTimedOut, GeocoderServiceError):
        return JsonResponse(
            {"error": "Geocoding service is temporarily unavailable. Please try again."},
            status=503
        )

@require_GET
def mountain_route_api(request):
    start_lat = request.GET.get("start_lat")
    start_lng = request.GET.get("start_lng")
    end_lat = request.GET.get("end_lat")
    end_lng = request.GET.get("end_lng")
    profile = request.GET.get("profile", "foot-hiking")

    allowed_profiles = {"foot-hiking", "driving-car"}
    if profile not in allowed_profiles:
        return JsonResponse({"error": "Invalid route profile."}, status=400)
    

    if not all([start_lat, start_lng, end_lat, end_lng]):
        return JsonResponse({"error": "Start and end coordinates are required"}, status=400)
    
    try:
        start_lat = float(start_lat)
        start_lng = float(start_lng)
        end_lat = float(end_lat)
        end_lng = float(end_lng)

    except ValueError:
        return JsonResponse({"error": "All coordinates must be valid numbers"}, status=400)
    
    api_key = os.environ.get("ORS_API_KEY")
    if not api_key:
        return JsonResponse({"error":"Routing API key is not configured."}, status=500)
    
    url = f"https://api.openrouteservice.org/v2/directions/{profile}/geojson"
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "coordinates": [
            [start_lng, start_lat], 
            [end_lng, end_lat],
        ]
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        response.raise_for_status()
        route_data = response.json()
    except requests.RequestException as e:
        print("===ORS Request failed===")
        print("Error:", e)
        detail = None

        if e.response is not None:
            print("Status code:", e.response.status_code)
            print("Response body:", e.response.text)
            try:
                detail = e.response.json()
            except ValueError:
                detail = e.response.text

        return JsonResponse({
            "error": "Could not retrieve route data.",
            "details": detail,},
              status=502)
    
    return JsonResponse(route_data)

@require_GET
def nearby_parking_api(request):
    latitude = request.GET.get("latitude")
    longitude = request.GET.get("longitude")

    if not latitude or not longitude:
        return JsonResponse({"error": "Latitude and longitude are required"}, status=400)

    try:
        latitude = float(latitude)
        longitude = float(longitude)

    except ValueError:
        return JsonResponse({"error": "Latitude and longitude must be valid numbers."}, status=400)
    
    overpass_query = f"""
    [out:json][timeout:25];
    (
     node(around:5000, {latitude}, {longitude})["amenity"="parking"];
     way(around:5000, {latitude}, {longitude})["amenity"="parking"];
    );
    out center tags;
    """ 

    try: 
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": overpass_query},
            headers={"User-Agent":"Nearby-mountain-finder/1.0"},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
    
    except requests.RequestException as e:
        print("=== OVERPASS REQUEST FAILED ===")
        print("Error:", e)

        if e.response is not None:
            print("Status code:", e.response.status_code)
            print("Response body:", e.response.text)

        return JsonResponse(
            {
                "error": "Could not retrieve parking data.", 
                "details": e.response.text if e.response else str(e),
                }, 
                status=502
                )

    parkings = []

    for element in data.get("elements", []):
        if element.get("type") == "node":
            lat = element.get("lat")
            lng = element.get("lon")

        else:
            center = element.get("center", {})
            lat = center.get("lat")
            lng = center.get("lon")

        if lat is None or lng is None:
            continue

        distance_km = haversine_km(latitude, longitude, lat, lng)

        parkings.append({
            "name": element.get("tags", {}).get("name", "Unnamed parking"),
            "latitude": lat,
            "longitude": lng,
            "distance_to_mountain_km": round(distance_km, 2),
        })

    parkings.sort(key=lambda p: p["distance_to_mountain_km"])

    return JsonResponse({"parkings": parkings[:10]})