# notifications/views.py

from collections.abc import Mapping
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """
    Endpoints:
    - GET    /api/notifications/
    - PATCH  /api/notifications/<id>/   body: { "read": true }
    - POST   /api/notifications/mark-all-read/
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options", "post"]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()

        data = request.data if isinstance(request.data, Mapping) else {}

        if "read" not in data:
            return Response(
                {"detail": "Only 'read' can be updated."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            instance,
            data={"read": data.get("read")},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        instance.refresh_from_db()
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"status": "ok"}, status=status.HTTP_200_OK)
