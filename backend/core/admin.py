from django.contrib import admin
from .models import Asset, InventoryItem, Assignment, RepairTicket

@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "serial_number", "status", "purchase_date")
    list_filter = ("status", "type")
    search_fields = ("name", "serial_number")
    ordering = ("-id",)

@admin.register(InventoryItem)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("id", "item_type", "quantity", "threshold")
    search_fields = ("item_type",)

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "asset", "employee", "date_assigned", "date_returned")
    list_filter = ("date_assigned", "date_returned")
    search_fields = ("asset__serial_number", "employee__username")

@admin.register(RepairTicket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("id", "asset", "status", "assigned_technician", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("asset__serial_number",)

