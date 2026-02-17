from django.apps import apps
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import Notification


User = get_user_model()


def get_admin_users():
    # If your User has role field: role="ADMIN"
    if hasattr(User, "role"):
        return User.objects.filter(role="ADMIN")
    # fallback
    return User.objects.filter(is_staff=True) | User.objects.filter(is_superuser=True)


def safe_get_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except Exception:
        return None


Assignment = safe_get_model("assignments", "Assignment")
Ticket = safe_get_model("tickets", "Ticket")


@receiver(post_save)
def assignment_notifications(sender, instance, created, **kwargs):
    if Assignment is None or sender is not Assignment:
        return

    # On create: notify the employee
    if created:
        employee_id = getattr(instance, "employee_id", None) or getattr(instance, "employee", None)
        asset_id = getattr(instance, "asset_id", None) or getattr(instance, "asset", None)

        if employee_id:
            Notification.objects.create(
                user_id=employee_id,
                notif_type=Notification.Type.ASSET_ASSIGNED,
                title="Asset assigned",
                message="A new asset was assigned to you.",
                entity_type="assignment",
                entity_id=instance.id,
            )

        # Notify admins as well
        for admin in get_admin_users():
            Notification.objects.create(
                user=admin,
                notif_type=Notification.Type.ASSET_ASSIGNED,
                title="Asset assigned",
                message=f"Assignment #{instance.id} was created.",
                entity_type="assignment",
                entity_id=instance.id,
            )
        return

    # On update: if returned now, notify
    # We detect return by checking date_returned exists and is recent update.
    date_returned = getattr(instance, "date_returned", None)
    if date_returned:
        employee_id = getattr(instance, "employee_id", None) or getattr(instance, "employee", None)

        if employee_id:
            Notification.objects.create(
                user_id=employee_id,
                notif_type=Notification.Type.ASSIGNMENT_RETURNED,
                title="Asset returned",
                message="Your assigned asset was marked as returned.",
                entity_type="assignment",
                entity_id=instance.id,
            )

        for admin in get_admin_users():
            Notification.objects.create(
                user=admin,
                notif_type=Notification.Type.ASSIGNMENT_RETURNED,
                title="Asset returned",
                message=f"Assignment #{instance.id} was marked as returned.",
                entity_type="assignment",
                entity_id=instance.id,
            )


@receiver(pre_save)
def ticket_capture_previous_status(sender, instance, **kwargs):
    if Ticket is None or sender is not Ticket:
        return
    if not instance.pk:
        instance._prev_status = None
        return
    try:
        old = Ticket.objects.filter(pk=instance.pk).only("status").first()
        instance._prev_status = old.status if old else None
    except Exception:
        instance._prev_status = None


@receiver(post_save)
def ticket_notifications(sender, instance, created, **kwargs):
    if Ticket is None or sender is not Ticket:
        return

    created_by_id = getattr(instance, "created_by_id", None) or getattr(instance, "created_by", None)
    assigned_tech_id = getattr(instance, "assigned_technician_id", None) or getattr(instance, "assigned_technician", None)
    status = getattr(instance, "status", "")

    if created:
        # notify admins
        for admin in get_admin_users():
            Notification.objects.create(
                user=admin,
                notif_type=Notification.Type.TICKET_CREATED,
                title="New ticket created",
                message=f"Ticket #{instance.id} was created.",
                entity_type="ticket",
                entity_id=instance.id,
            )

        # notify assigned technician if present
        if assigned_tech_id:
            Notification.objects.create(
                user_id=assigned_tech_id,
                notif_type=Notification.Type.TICKET_CREATED,
                title="New ticket assigned",
                message=f"You were assigned Ticket #{instance.id}.",
                entity_type="ticket",
                entity_id=instance.id,
            )
        return

    prev = getattr(instance, "_prev_status", None)
    if prev and prev != status:
        # notify creator and technician
        if created_by_id:
            Notification.objects.create(
                user_id=created_by_id,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket status updated",
                message=f"Ticket #{instance.id} status changed to {status}.",
                entity_type="ticket",
                entity_id=instance.id,
            )
        if assigned_tech_id:
            Notification.objects.create(
                user_id=assigned_tech_id,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket status updated",
                message=f"Ticket #{instance.id} status changed to {status}.",
                entity_type="ticket",
                entity_id=instance.id,
            )
