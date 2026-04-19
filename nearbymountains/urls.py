from django.urls import path
from .views import mountain_search, mountain_map, nearby_mountains_api, geocode_location_api, mountain_route_api

urlpatterns = [
    path("", mountain_map, name="mountain_map"),
    path("api/nearby-mountains/", nearby_mountains_api, name="nearby_mountains_api"),
    path("api/geocode-location/", geocode_location_api, name="geocode_location_api"),
    path("api/mountain_route_api/", mountain_route_api, name="mountain_route_api"),
    path("mountain_search/", mountain_search, name="mountain_search"),
]