from django.urls import path
from .views import mountain_search

urlpatterns = [
    path("", mountain_search, name="mountain_search"),
]