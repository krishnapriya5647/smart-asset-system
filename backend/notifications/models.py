from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Type(models.TextChoices):
        INFO = "INFO", "Info"
        ASSET_ASSIGNED = "ASSET_ASSIGNED", "Asset assigned"
        TICKET_CREATED = "TICKET_CREATED", "Ticket created"
        TICKET_UPDATED = "TICKET_UPDATED", "Ticket updated"
        ASSIGNMENT_RETURNED = "ASSIGNMENT_RETURNED", "Assignment returned"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    notif_type = models.CharField(max_length=32, choices=Type.choices, default=Type.INFO)
    title = models.CharField(max_length=140)
    message = models.TextField(blank=True)

    # Deep link helpers for frontend navigation
    entity_type = models.CharField(max_length=40, blank=True)  # "ticket" | "asset" | "assignment"
    entity_id = models.IntegerField(null=True, blank=True)

    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["user", "read_at"]),
        ]

    @property
    def is_read(self) -> bool:
        return self.read_at is not None
