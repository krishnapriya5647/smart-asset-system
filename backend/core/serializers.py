# backend/core/serializers.py

from rest_framework import serializers
from .models import Asset, InventoryItem, Assignment, RepairTicket
from accounts.serializers import UserPublicSerializer


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = "__all__"


class InventoryItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryItem
        fields = "__all__"


class AssignmentSerializer(serializers.ModelSerializer):
    asset_detail = AssetSerializer(source="asset", read_only=True)

    # convenience fields
    employee_username = serializers.ReadOnlyField(source="employee.username")

    # new detail fields (safe even if null)
    employee_detail = UserPublicSerializer(source="employee", read_only=True)
    returned_by_detail = UserPublicSerializer(source="returned_by", read_only=True)

    class Meta:
        model = Assignment
        fields = "__all__"
        # These should be server-controlled
        read_only_fields = (
            "return_requested_at",
            "returned_at",
            "returned_by",
        )

    def validate(self, attrs):
        """
        Optional: validate return_note type if present.
        """
        note = attrs.get("return_note")
        if note is not None and not isinstance(note, str):
            raise serializers.ValidationError({"return_note": "Must be a string."})
        return attrs


class RepairTicketSerializer(serializers.ModelSerializer):
    # IDs for frontend convenience
    created_by = serializers.ReadOnlyField(source="created_by_id")
    resolved_by = serializers.ReadOnlyField(source="resolved_by_id")

    # detail objects
    asset_detail = AssetSerializer(source="asset", read_only=True)
    created_by_detail = UserPublicSerializer(source="created_by", read_only=True)
    assigned_technician_detail = UserPublicSerializer(source="assigned_technician", read_only=True)
    resolved_by_detail = UserPublicSerializer(source="resolved_by", read_only=True)

    class Meta:
        model = RepairTicket
        fields = "__all__"

        # Server controlled fields
        read_only_fields = (
            "created_by",
            "created_at",
            "resolved_at",
            "resolved_by",
        )

    def validate(self, attrs):
        """
        Keep it simple and safe:
        - resolution_note can be updated by allowed roles (we'll enforce role rules in views)
        - resolved_at / resolved_by are always server controlled (already read-only)
        """
        note = attrs.get("resolution_note")
        if note is not None and not isinstance(note, str):
            raise serializers.ValidationError({"resolution_note": "Must be a string."})
        return attrs


class RecentTicketSerializer(serializers.ModelSerializer):
    asset_detail = AssetSerializer(source="asset", read_only=True)
    created_by = serializers.ReadOnlyField(source="created_by_id")

    created_by_detail = UserPublicSerializer(source="created_by", read_only=True)
    assigned_technician_detail = UserPublicSerializer(source="assigned_technician", read_only=True)

    resolved_by = serializers.ReadOnlyField(source="resolved_by_id")
    resolved_by_detail = UserPublicSerializer(source="resolved_by", read_only=True)

    class Meta:
        model = RepairTicket
        fields = [
            "id",
            "asset",
            "asset_detail",
            "status",
            "assigned_technician",
            "assigned_technician_detail",
            "created_by",
            "created_by_detail",
            "created_at",
            "issue",
            "resolution_note",
            "resolved_at",
            "resolved_by",
            "resolved_by_detail",
        ]


class RecentAssignmentSerializer(serializers.ModelSerializer):
    asset_detail = AssetSerializer(source="asset", read_only=True)
    employee_detail = UserPublicSerializer(source="employee", read_only=True)
    returned_by_detail = UserPublicSerializer(source="returned_by", read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "asset",
            "asset_detail",
            "employee",
            "employee_detail",
            "date_assigned",
            "date_returned",
            "status",
            "return_requested_at",
            "return_note",
            "returned_at",
            "returned_by",
            "returned_by_detail",
        ]