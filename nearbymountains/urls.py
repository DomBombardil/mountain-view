from django.urls import path
from .views import mountain_search, mountain_map, nearby_mountains_api

urlpatterns = [
    path("", mountain_map, name="mountain_map"),
    path("api/nearby_mountains/", nearby_mountains_api, name="nearby_mountains_api"),
    path("mountain_search", mountain_search, name="mountain_search"),
]