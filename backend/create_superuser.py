import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402

User = get_user_model()

username = os.getenv("ADMIN_USERNAME", "admin")
email = os.getenv("ADMIN_EMAIL", "").strip()
password = os.getenv("ADMIN_PASSWORD", "")

if not email or not password:
    print("ADMIN_EMAIL / ADMIN_PASSWORD not set. Skipping superuser creation.")
    raise SystemExit(0)

user, created = User.objects.get_or_create(
    email=email,
    defaults={"username": username, "is_staff": True, "is_superuser": True},
)

if created:
    user.set_password(password)
    user.save()
    print(f"Superuser created: {email}")
else:
    # Ensure it has required flags (and optionally reset password)
    changed = False
    if user.username != username:
        user.username = username
        changed = True
    if not user.is_staff:
        user.is_staff = True
        changed = True
    if not user.is_superuser:
        user.is_superuser = True
        changed = True

    # Optional: uncomment if you want password to be enforced from env every deploy
    # user.set_password(password)
    # changed = True

    if changed:
        user.save()
    print(f"Superuser already exists: {email} (no duplicate created)")
