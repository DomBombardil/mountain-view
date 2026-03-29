# Mountain View

`Mountain View` is an early-stage Django project for storing and exploring nearby mountains with geospatial data.

At the moment, the project includes:

- Django 6 with GeoDjango enabled
- A `Mountain` model with name, elevation, and geographic location
- PostgreSQL/PostGIS as the database backend
- Django admin for managing data

## Project Status

This project is still in development. The current codebase focuses on the data model and base project setup.

## Local Setup

1. Create and activate a virtual environment.
2. Install Django and the GIS/PostgreSQL dependencies you need.
3. Configure a local PostgreSQL database with the PostGIS extension enabled.
4. Update database settings if your local credentials differ.
5. Run:

```bash
python manage.py migrate
python manage.py runserver
```

## App Goal

The long-term goal is to build a location-based web app that can help find mountains near a given place.
