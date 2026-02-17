from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        EMPLOYEE = "EMPLOYEE", "Employee"

    # Make email required
    email = models.EmailField(blank=False, null=False, unique=True)


    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)

    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN
