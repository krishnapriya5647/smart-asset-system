from django.conf import settings
from django.db import models


class Asset(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        ASSIGNED = "ASSIGNED", "Assigned"
        REPAIR = "REPAIR", "Under Repair"
        RETIRED = "RETIRED", "Retired"

    name = models.CharField(max_length=120)
    type = models.CharField(max_length=80)
    serial_number = models.CharField(max_length=120, unique=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)
    purchase_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.serial_number})"


class InventoryItem(models.Model):
    item_type = models.CharField(max_length=120, unique=True)
    quantity = models.PositiveIntegerField(default=0)
    threshold = models.PositiveIntegerField(default=5)

    def __str__(self):
        return self.item_type


class Assignment(models.Model):
    class Status(models.TextChoices):
        ASSIGNED = "ASSIGNED", "Assigned"
        RETURN_REQUESTED = "RETURN_REQUESTED", "Return Requested"
        RETURNED = "RETURNED", "Returned"

    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="assignments")
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="asset_assignments"
    )

    date_assigned = models.DateField()

    # Old field (keep it)
    date_returned = models.DateField(null=True, blank=True)

    # New fields
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ASSIGNED)
    return_requested_at = models.DateTimeField(null=True, blank=True)
    return_note = models.TextField(blank=True, default="")
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="assignments_returned_by",
    )

    class Meta:
        ordering = ["-date_assigned"]

class RepairTicket(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="tickets")
    issue = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)

    assigned_technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="tickets_assigned",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="tickets_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # New fields for "employee completed work" communication
    resolution_note = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="tickets_resolved",
    )

    class Meta:
        ordering = ["-created_at"]