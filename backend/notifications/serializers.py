from django.utils import timezone
from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    # frontend sends { "read": true }
    read = serializers.BooleanField(write_only=True, required=False)

    # frontend uses url/link for navigation
    url = serializers.SerializerMethodField()
    link = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notif_type",
            "entity_type",
            "entity_id",
            "created_at",
            "read_at",
            "is_read",
            "read",
            "url",
            "link",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "read_at",
            "is_read",
            "url",
            "link",
        ]

    def get_is_read(self, obj):
        return obj.read_at is not None

    def _build_link(self, obj):
        if obj.entity_type and obj.entity_id:
            if obj.entity_type == "assignment":
                return f"/assignments?focus={obj.entity_id}"
            if obj.entity_type == "ticket":
                return f"/tickets?focus={obj.entity_id}"
            if obj.entity_type == "asset":
                return f"/assets?focus={obj.entity_id}"
        return ""

    def get_url(self, obj):
        return self._build_link(obj)

    def get_link(self, obj):
        return self._build_link(obj)

    def update(self, instance, validated_data):
        # map incoming boolean to read_at
        if "read" in validated_data:
            make_read = validated_data.pop("read")

            # extra safety if value comes as "true"/"false"
            if isinstance(make_read, str):
                make_read = make_read.strip().lower() in ("1", "true", "yes", "y", "on")

            instance.read_at = timezone.now() if make_read else None

        instance.save(update_fields=["read_at"])
        return instance
