from django.shortcuts import render
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.contrib.gis.db.models.functions import Distance

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderServiceError, GeocoderTimedOut

from .models import Mountain


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