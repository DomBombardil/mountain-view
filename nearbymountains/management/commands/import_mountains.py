import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.gis.geos import Point

from nearbymountains.models import Mountain


class Command(BaseCommand):
    help = "Import mountain peaks from raw OSM/Overpass JSON"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            default="data/mountain_data.json",
            help="Path to the raw OSM JSON file",
        )
        parser.add_argument(
            "--min-elevation",
            type=int,
            default=1500,
            help="Minimum elevation in meters",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file"])
        min_elevation = options["min_elevation"]

        if not file_path.exists():
            self.stdout.write(
                self.style.ERROR(f"File not found: {file_path}")
            )
            return

        with file_path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        elements = data.get("elements", [])

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for element in elements:
            if element.get("type") != "node":
                skipped_count += 1
                continue

            tags = element.get("tags", {})
            if tags.get("natural") != "peak":
                skipped_count += 1
                continue

            osm_id = element.get("id")
            name = tags.get("name")
            ele_raw = tags.get("ele")
            lat = element.get("lat")
            lon = element.get("lon")

            if not osm_id or not name or lat is None or lon is None or not ele_raw:
                skipped_count += 1
                continue

            try:
                elevation = self.parse_elevation(ele_raw)
            except ValueError:
                skipped_count += 1
                continue

            if elevation < min_elevation:
                skipped_count += 1
                continue

            point = Point(lon, lat, srid=4326)

            mountain, created = Mountain.objects.update_or_create(
                osm_id=osm_id,
                defaults={
                    "name": name,
                    "elevation": elevation,
                    "location": point,
                },
            )

            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS("Import finished."))
        self.stdout.write(f"Created: {created_count}")
        self.stdout.write(f"Updated: {updated_count}")
        self.stdout.write(f"Skipped: {skipped_count}")

    def parse_elevation(self, ele_raw):
        """
        Convert elevation values like '1972' or '1972 m' into an int.
        Raises ValueError if no clean number can be extracted.
        """
        ele_str = str(ele_raw).strip().lower().replace("m", "").strip()

        if not ele_str:
            raise ValueError("Empty elevation")

        return int(float(ele_str))