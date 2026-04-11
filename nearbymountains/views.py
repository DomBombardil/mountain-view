from django.shortcuts import render
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance
from django.http import JsonResponse

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError, GeocoderTimedOut

from .models import Mountain

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