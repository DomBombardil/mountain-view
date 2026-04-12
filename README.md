# Mountain View

'Mountain View' is a Django + GeoDjango project for finding nearby mountain peaks from geographic coordinates.

The app stores mountain data in PostgreSQL/PostGIS, imports peaks from raw OpenStreetMap/Overpass JSON, and exposes both a browser map view and a server-rendered search page.

## Current Features

- GeoDjango 'Mountain' model with 'name', 'elevation', 'location', and unique 'osm_id'
- PostgreSQL/PostGIS database backend
- Interactive Leaflet map with browser geolocation
- JSON API for nearby mountain lookup by latitude, longitude, and radius
- Server-rendered search page with:
  - typed location search via 'geopy' / Nominatim
  - browser location search
  - distance-based mountain results
- Django admin support for managing mountain records
- Management command for importing mountain peaks from raw OSM/Overpass JSON

## Tech Stack

- Python
- Django 6
- GeoDjango
- PostgreSQL + PostGIS
- Leaflet
- OpenStreetMap tiles
- 'geopy'

## Project Structure

- 'nearbymountains/views.py'
  Contains the map view, nearby-mountains API, and search page logic.
- 'nearbymountains/models.py'
  Defines the 'Mountain' GIS model.
- 'nearbymountains/management/commands/import_mountains.py'
  Imports mountain data from a JSON file.
- 'nearbymountains/templates/nearbymountains/map.html'
  Interactive map page.
- 'nearbymountains/templates/nearbymountains/index.html'
  Search form and server-rendered results page.
- 'nearbymountains/static/nearbymountains/js/map.js'
  Frontend map behavior and API requests.

## Local Setup

1. Create and activate a virtual environment.
2. Install project dependencies, including GIS-related system libraries.
3. Install and run PostgreSQL with the PostGIS extension enabled.
4. Update 'mountain_finder/settings.py' for your local database credentials and GIS library paths.
5. Run migrations:

'''bash
python manage.py migrate
'''

6. Start the development server:

'''bash
python manage.py runserver
'''

## Data Import

The project includes a management command for importing mountain peaks from raw OSM/Overpass JSON.

Default usage:

'''bash
python manage.py import_mountains
'''

Import from a custom file:

'''bash
python manage.py import_mountains --file data/mountain_data.json
'''

Import only peaks above a minimum elevation:

'''bash
python manage.py import_mountains --min-elevation 2000
'''

The importer:

- reads OSM node elements tagged as natural peaks
- extracts name, elevation, coordinates, and OSM ID
- skips invalid or incomplete entries
- creates or updates existing mountains by 'osm_id'

## Available Routes

- '/'
  Interactive map view with Leaflet and browser geolocation
- '/api/nearby-mountains/'
  JSON endpoint for nearby mountain lookups
- '/mountain_search/'
  Server-rendered search page for typed locations or browser coordinates

## API Example

'''text
/api/nearby-mountains/?latitude=47.856&longitude=12.123&radius=50
'''

Successful responses return nearby mountains ordered by distance, including:

- 'name'
- 'elevation'
- 'distance_km'
- 'latitude'
- 'longitude'

## Notes

- The map frontend currently uses OpenStreetMap tiles and Leaflet from a CDN.
- Browser geolocation requires user permission.
- Typed location search depends on the availability of the Nominatim geocoding service.
- The current settings file contains machine-specific GIS library paths and local database configuration, so it should be adjusted before running on another system.
