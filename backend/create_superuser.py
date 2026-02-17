import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

username = os.environ.get("ADMIN_USERNAME")
email = os.environ.get("ADMIN_EMAIL", "")
password = os.environ.get("ADMIN_PASSWORD")

if not username or not password:
    print("ADMIN_USERNAME/ADMIN_PASSWORD not set, skipping superuser creation.")
else:
    if User.objects.filter(username=username).exists():
        print("Superuser already exists, skipping.")
    else:
        User.objects.create_superuser(username=username, email=email, password=password)
        print("Superuser created successfully.")
