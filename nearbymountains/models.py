from django.contrib.gis.db import models

# Create your models here.
class Mountain(models.Model):
    name = models.CharField(max_length=200)
    elevation = models.IntegerField()
    location = models.PointField(geography=True)

    def __str__(self):
        return self.name