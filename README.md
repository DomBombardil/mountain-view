# Mountain View

Mountain View is a Django + GeoDjango project for finding nearby mountain peaks from geographic coordinates.

The app stores mountain data in PostgreSQL/PostGIS, imports peaks from raw OpenStreetMap/Overpass JSON, and exposes an interactive browser map with location search, mountain results, routing, and nearby parking lookup.

## Current Features

- GeoDjango `Mountain` model with `name`, `elevation`, `location`, and unique `osm_id`
- PostgreSQL/PostGIS database backend
- Interactive Leaflet map with browser geolocation and typed location search
- JSON API for nearby mountain lookup by latitude, longitude, and radius
- Geocoding API for converting typed locations into coordinates with `geopy` / Nominatim
- Sidebar list of nearby mountains synchronized with map markers
- Selected mountain panel with elevation, straight-line distance, and route controls
- Hiking and driving routes from the selected start location to a selected mountain through OpenRouteService
- Nearby parking lookup around a selected mountain through the Overpass API
- Driving route option from the selected start location to a parking result
- Custom green marker icon for parking locations
- Legacy server-rendered search page kept for reference/testing
- Django admin support for managing mountain records
- Management command for importing mountain peaks from raw OSM/Overpass JSON

## Tech Stack

- Python
- Django 6
- GeoDjango
- PostgreSQL + PostGIS
- Leaflet
- OpenStreetMap tiles
- `geopy`
- Nominatim geocoding
- OpenRouteService directions API
- Overpass API
- `requests`
- `python-dotenv`

## Project Structure

- `nearbymountains/views.py`
  Contains the map view, nearby-mountains API, geocoding API, routing API, parking API, and legacy search page logic.
- `nearbymountains/models.py`
  Defines the `Mountain` GIS model.
- `nearbymountains/management/commands/import_mountains.py`
  Imports mountain data from a JSON file.
- `nearbymountains/templates/nearbymountains/map.html`
  Main interactive map page.
- `nearbymountains/templates/nearbymountains/index.html`
  Legacy search form and server-rendered results page.
- `nearbymountains/static/nearbymountains/js/map.js`
  Frontend map behavior, API requests, marker handling, route rendering, and parking interactions.
- `nearbymountains/static/nearbymountains/css/map.css`
  Map layout, sidebar, controls, and selected mountain panel styling.
- `nearbymountains/static/nearbymountains/icons/`
  Static marker assets used for parking results.

## Local Setup

1. Create and activate a virtual environment.
2. Install project dependencies, including GIS-related system libraries.
3. Install and run PostgreSQL with the PostGIS extension enabled.
4. Update `mountain_finder/settings.py` for your local database credentials and GIS library paths.
5. Create a `.env.local` file for local environment variables:

```bash
ORS_API_KEY=your_openrouteservice_api_key
```

6. Run migrations:

```bash
python manage.py migrate
```

7. Start the development server:

```bash
python manage.py runserver
```

## Data Import

The project includes a management command for importing mountain peaks from raw OSM/Overpass JSON.

Default usage:

```bash
python manage.py import_mountains
```

Import from a custom file:

```bash
python manage.py import_mountains --file data/mountain_data.json
```

Import only peaks above a minimum elevation:

```bash
python manage.py import_mountains --min-elevation 2000
```

The importer:

- reads OSM node elements tagged as natural peaks
- extracts name, elevation, coordinates, and OSM ID
- skips invalid or incomplete entries
- creates or updates existing mountains by `osm_id`

## Available Routes

- `/`
  Main interactive map view with Leaflet, typed search, browser geolocation, mountain list, routes, and parking lookup
- `/api/nearby-mountains/`
  JSON endpoint for nearby mountain lookups
- `/api/geocode-location/`
  JSON endpoint for converting a typed location query into coordinates
- `/api/mountain-route/`
  JSON endpoint that proxies OpenRouteService directions for hiking or driving routes
- `/api/nearby-parking/`
  JSON endpoint that queries Overpass for parking near a selected mountain
- `/mountain_search/`
  Legacy server-rendered search page for typed locations or browser coordinates

## API Examples

Nearby mountains:

```text
/api/nearby-mountains/?latitude=47.856&longitude=12.123&radius=50
```

Successful responses return nearby mountains ordered by distance, including:

- `name`
- `elevation`
- `distance_km`
- `latitude`
- `longitude`

Typed location geocoding:

```text
/api/geocode-location/?query=83301%20Traunreut
```

Successful responses include:

- `latitude`
- `longitude`
- `display_name`

Mountain route:

```text
/api/mountain-route/?start_lat=47.856&start_lng=12.123&end_lat=47.742&end_lng=12.470&profile=foot-hiking
```

Supported route profiles:

- `foot-hiking`
- `driving-car`

Successful responses return OpenRouteService GeoJSON. The frontend reads the route geometry and summary distance/duration from the response.

Nearby parking:

```text
/api/nearby-parking/?latitude=47.742&longitude=12.470
```

Successful responses return up to 10 parking results ordered by distance to the selected mountain, including:

- `name`
- `latitude`
- `longitude`
- `distance_to_mountain_km`

## Notes

- The map frontend currently uses OpenStreetMap tiles and Leaflet from a CDN.
- Browser geolocation requires user permission.
- Typed location search depends on the availability of the Nominatim geocoding service.
- Route lookup requires an `ORS_API_KEY` environment variable.
- Parking lookup depends on the availability of the public Overpass API.
- The current settings file contains machine-specific GIS library paths and local database configuration, so it should be adjusted before running on another system.
