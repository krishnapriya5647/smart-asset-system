# backend/core/views.py

from django.db.models import Count, Q
from django.contrib.auth import get_user_model
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .models import Asset, InventoryItem, Assignment, RepairTicket
from .serializers import (
    AssetSerializer,
    InventoryItemSerializer,
    AssignmentSerializer,
    RepairTicketSerializer,
    RecentTicketSerializer,
    RecentAssignmentSerializer,
)
from .permissions import AdminWriteElseReadOnly, TicketPermission, is_admin
from notifications.models import Notification

User = get_user_model()


class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all().order_by("-id")
    serializer_class = AssetSerializer
    permission_classes = [AdminWriteElseReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        employee = self.request.query_params.get("employee")

        if is_admin(user) and employee:
            assigned_asset_ids = Assignment.objects.filter(employee_id=employee).values_list(
                "asset_id", flat=True
            )
            qs = qs.filter(id__in=assigned_asset_ids).distinct()
        elif not is_admin(user):
            assigned_asset_ids = Assignment.objects.filter(employee=user).values_list(
                "asset_id", flat=True
            )
            qs = qs.filter(id__in=assigned_asset_ids).distinct()

        q = self.request.query_params.get("q")
        status_ = self.request.query_params.get("status")

        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(serial_number__icontains=q))
        if status_:
            qs = qs.filter(status=status_)

        return qs


class InventoryViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().order_by("item_type")
    serializer_class = InventoryItemSerializer
    permission_classes = [AdminWriteElseReadOnly]


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("asset", "employee").all()
    serializer_class = AssignmentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        employee = self.request.query_params.get("employee")

        if is_admin(user):
            if employee:
                return qs.filter(employee_id=employee)
            return qs

        return qs.filter(employee=user)

    def get_permissions(self):
        if self.request.method in ["GET", "HEAD", "OPTIONS"]:
            return [IsAuthenticated()]
        return [AdminWriteElseReadOnly()]

    def perform_create(self, serializer):
        assignment = serializer.save()

        # Optional: mark asset as assigned
        if assignment.asset_id:
            Asset.objects.filter(id=assignment.asset_id).update(status=Asset.Status.ASSIGNED)

        if assignment.employee and assignment.asset:
            Notification.objects.create(
                user=assignment.employee,
                notif_type=Notification.Type.ASSET_ASSIGNED,
                title="Asset assigned",
                message=f"{assignment.asset.name} ({assignment.asset.serial_number}) was assigned to you.",
                entity_type="assignment",
                entity_id=assignment.id,
            )

    def perform_update(self, serializer):
        """
        Admin updates assignment. If admin marks return via date_returned/status,
        sync asset status + notify employee.
        """
        old = self.get_object()
        assignment = serializer.save()

        old_emp_id = getattr(old, "employee_id", None)
        new_emp_id = getattr(assignment, "employee_id", None)

        old_return = getattr(old, "date_returned", None)
        new_return = getattr(assignment, "date_returned", None)

        old_status = getattr(old, "status", None)
        new_status = getattr(assignment, "status", None)

        asset = assignment.asset

        # Employee changed
        if new_emp_id and new_emp_id != old_emp_id:
            Notification.objects.create(
                user=assignment.employee,
                notif_type=Notification.Type.ASSET_ASSIGNED,
                title="Asset assigned",
                message=f"{asset.name} ({asset.serial_number}) was assigned to you.",
                entity_type="assignment",
                entity_id=assignment.id,
            )

        # If admin marked returned (either by setting date_returned or status)
        marked_returned = False

        # Case 1: date_returned set now
        if old_return is None and new_return is not None:
            marked_returned = True

        # Case 2: status changed to RETURNED
        if (
            hasattr(Assignment, "Status")
            and new_status == Assignment.Status.RETURNED
            and old_status != new_status
        ):
            marked_returned = True
            if assignment.date_returned is None:
                assignment.date_returned = timezone.now().date()
                assignment.save(update_fields=["date_returned"])

        if marked_returned and assignment.employee_id:
            # Mark asset available again
            if assignment.asset_id:
                Asset.objects.filter(id=assignment.asset_id).update(status=Asset.Status.AVAILABLE)

            Notification.objects.create(
                user=assignment.employee,
                notif_type=Notification.Type.ASSIGNMENT_RETURNED,
                title="Asset returned",
                message=f"{asset.name} ({asset.serial_number}) was marked as returned.",
                entity_type="assignment",
                entity_id=assignment.id,
            )

    @action(detail=True, methods=["post"], url_path="request-return", permission_classes=[IsAuthenticated])
    def request_return(self, request, pk=None):
        """
        Employee requests return. Admin will later confirm.
        """
        assignment = self.get_object()
        user = request.user

        if is_admin(user):
            raise PermissionDenied("Admin cannot request return as employee")

        if assignment.employee_id != user.id:
            raise PermissionDenied("You can only request return for your own assignment")

        # If already returned, block
        if assignment.date_returned is not None:
            return Response({"detail": "Already returned"}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(Assignment, "Status") and getattr(assignment, "status", None) == Assignment.Status.RETURNED:
            return Response({"detail": "Already returned"}, status=status.HTTP_400_BAD_REQUEST)

        note = (request.data.get("note") or "").strip()

        # Update fields only if they exist in model
        update_fields = []
        if hasattr(Assignment, "Status") and hasattr(assignment, "status"):
            assignment.status = Assignment.Status.RETURN_REQUESTED
            update_fields.append("status")

        if hasattr(assignment, "return_requested_at"):
            assignment.return_requested_at = timezone.now()
            update_fields.append("return_requested_at")

        if hasattr(assignment, "return_note"):
            assignment.return_note = note
            update_fields.append("return_note")

        if update_fields:
            assignment.save(update_fields=update_fields)

        # Notify admins
        asset = assignment.asset
        admins = User.objects.filter(role="ADMIN")

        msg = f"{user.username} requested return for {asset.name} ({asset.serial_number})."
        if note:
            msg += f" Note: {note}"

        Notification.objects.bulk_create(
            [
                Notification(
                    user=admin,
                    notif_type=Notification.Type.TICKET_UPDATED,
                    title="Return requested",
                    message=msg,
                    entity_type="assignment",
                    entity_id=assignment.id,
                )
                for admin in admins
            ]
        )

        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="confirm-return", permission_classes=[IsAuthenticated])
    def confirm_return(self, request, pk=None):
        """
        Admin confirms return, marks date_returned, sets asset AVAILABLE, notifies employee.
        """
        assignment = self.get_object()
        user = request.user

        if not is_admin(user):
            raise PermissionDenied("Only admin can confirm return")

        if assignment.date_returned is not None:
            return Response({"detail": "Already returned"}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(Assignment, "Status") and getattr(assignment, "status", None) == Assignment.Status.RETURNED:
            return Response({"detail": "Already returned"}, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        # keep old field
        assignment.date_returned = now.date()

        update_fields = ["date_returned"]

        # new fields if present
        if hasattr(Assignment, "Status") and hasattr(assignment, "status"):
            assignment.status = Assignment.Status.RETURNED
            update_fields.append("status")

        if hasattr(assignment, "returned_at"):
            assignment.returned_at = now
            update_fields.append("returned_at")

        if hasattr(assignment, "returned_by"):
            assignment.returned_by = user
            update_fields.append("returned_by")

        assignment.save(update_fields=update_fields)

        # Mark asset available
        if assignment.asset_id:
            Asset.objects.filter(id=assignment.asset_id).update(status=Asset.Status.AVAILABLE)

        asset = assignment.asset
        Notification.objects.create(
            user=assignment.employee,
            notif_type=Notification.Type.ASSIGNMENT_RETURNED,
            title="Return confirmed",
            message=f"Admin confirmed return for {asset.name} ({asset.serial_number}).",
            entity_type="assignment",
            entity_id=assignment.id,
        )

        assignment.refresh_from_db()
        return Response(self.get_serializer(assignment).data, status=status.HTTP_200_OK)


class TicketViewSet(viewsets.ModelViewSet):
    queryset = RepairTicket.objects.select_related(
        "asset", "assigned_technician", "created_by", "resolved_by"
    ).all()
    serializer_class = RepairTicketSerializer
    permission_classes = [TicketPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        employee = self.request.query_params.get("employee")

        if is_admin(user):
            if employee:
                emp_asset_ids = Assignment.objects.filter(employee_id=employee).values_list("asset_id", flat=True)
                return qs.filter(
                    Q(created_by_id=employee)
                    | Q(assigned_technician_id=employee)
                    | Q(asset_id__in=emp_asset_ids)
                ).distinct()
            return qs

        my_asset_ids = Assignment.objects.filter(employee=user).values_list("asset_id", flat=True)
        return qs.filter(
            Q(created_by=user) | Q(assigned_technician=user) | Q(asset_id__in=my_asset_ids)
        ).distinct()

    def perform_create(self, serializer):
        user = self.request.user

        # Employee creates: assigned_technician stays None, notify admins
        if not is_admin(user):
            ticket = serializer.save(created_by=user, assigned_technician=None)

            admins = User.objects.filter(role="ADMIN")
            Notification.objects.bulk_create(
                [
                    Notification(
                        user=admin,
                        notif_type=Notification.Type.TICKET_CREATED,
                        title="New ticket created",
                        message=f"{user.username} created a ticket for {ticket.asset.name} ({ticket.asset.serial_number}).",
                        entity_type="ticket",
                        entity_id=ticket.id,
                    )
                    for admin in admins
                ]
            )
            return

        # Admin creates: allow optional technician, notify technician if assigned
        ticket = serializer.save(created_by=user)

        if ticket.assigned_technician_id:
            Notification.objects.create(
                user=ticket.assigned_technician,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket assigned",
                message=f"You were assigned a ticket for {ticket.asset.name} ({ticket.asset.serial_number}).",
                entity_type="ticket",
                entity_id=ticket.id,
            )

    def perform_update(self, serializer):
        user = self.request.user
        if not is_admin(user):
            raise PermissionDenied("Only admin can update tickets")

        old = self.get_object()
        old_assignee = old.assigned_technician_id
        old_status = old.status

        ticket = serializer.save()

        asset_label = (
            f"{ticket.asset.name} ({ticket.asset.serial_number})"
            if ticket.asset_id and ticket.asset
            else ""
        )

        if ticket.assigned_technician_id and ticket.assigned_technician_id != old_assignee:
            Notification.objects.create(
                user=ticket.assigned_technician,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket assigned",
                message=("You were assigned a ticket" + (f" for {asset_label}." if asset_label else ".")),
                entity_type="ticket",
                entity_id=ticket.id,
            )

        if ticket.status != old_status and ticket.created_by_id:
            Notification.objects.create(
                user=ticket.created_by,
                notif_type=Notification.Type.TICKET_UPDATED,
                title="Ticket updated",
                message=f"Ticket status changed: {old_status} -> {ticket.status}",
                entity_type="ticket",
                entity_id=ticket.id,
            )

    @action(detail=True, methods=["post"], url_path="mark-done")
    def mark_done(self, request, pk=None):
        """
        Technician marks ticket as RESOLVED with an optional note.
        Notifies the ticket creator and all admins.
        """
        ticket = self.get_object()
        user = request.user

        if ticket.status in [RepairTicket.Status.RESOLVED, RepairTicket.Status.CLOSED]:
            return Response({"detail": "Ticket is already resolved/closed"}, status=status.HTTP_400_BAD_REQUEST)

        if not ticket.assigned_technician_id:
            return Response({"detail": "No technician assigned"}, status=status.HTTP_400_BAD_REQUEST)

        if ticket.assigned_technician_id != user.id:
            raise PermissionDenied("Only the assigned technician can mark done")

        note = (request.data.get("note") or "").strip()

        ticket.status = RepairTicket.Status.RESOLVED
        ticket.resolution_note = note
        ticket.resolved_at = timezone.now()
        ticket.resolved_by = user
        ticket.save(update_fields=["status", "resolution_note", "resolved_at", "resolved_by"])

        recipients = set()
        if ticket.created_by_id:
            recipients.add(ticket.created_by_id)

        for admin_id in User.objects.filter(role="ADMIN").values_list("id", flat=True):
            recipients.add(admin_id)

        recipients.discard(user.id)

        asset_label = f"{ticket.asset.name} ({ticket.asset.serial_number})"
        msg = f"Work marked done for {asset_label}."
        if note:
            msg = msg + f" Note: {note}"

        Notification.objects.bulk_create(
            [
                Notification(
                    user_id=uid,
                    notif_type=Notification.Type.TICKET_UPDATED,
                    title="Ticket resolved",
                    message=msg,
                    entity_type="ticket",
                    entity_id=ticket.id,
                )
                for uid in recipients
            ]
        )

        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="approve-close")
    def approve_close(self, request, pk=None):
        """
        Admin verifies and closes a RESOLVED ticket.
        Notifies ticket creator and technician.
        """
        user = request.user
        if not is_admin(user):
            raise PermissionDenied("Only admin can approve and close tickets")

        ticket = self.get_object()

        if ticket.status == RepairTicket.Status.CLOSED:
            return Response({"detail": "Ticket is already closed"}, status=status.HTTP_400_BAD_REQUEST)

        if ticket.status != RepairTicket.Status.RESOLVED:
            return Response({"detail": "Ticket must be RESOLVED before closing"}, status=status.HTTP_400_BAD_REQUEST)

        ticket.status = RepairTicket.Status.CLOSED
        ticket.save(update_fields=["status"])

        recipients = set()
        if ticket.created_by_id:
            recipients.add(ticket.created_by_id)
        if ticket.assigned_technician_id:
            recipients.add(ticket.assigned_technician_id)

        asset_label = f"{ticket.asset.name} ({ticket.asset.serial_number})"

        Notification.objects.bulk_create(
            [
                Notification(
                    user_id=uid,
                    notif_type=Notification.Type.TICKET_UPDATED,
                    title="Ticket closed",
                    message=f"Admin verified and closed the ticket for {asset_label}.",
                    entity_type="ticket",
                    entity_id=ticket.id,
                )
                for uid in recipients
            ]
        )

        ticket.refresh_from_db()
        return Response(self.get_serializer(ticket).data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    asset_by_status = list(
        Asset.objects.values("status").annotate(count=Count("id")).order_by("status")
    )
    totals = {
        "assets_total": Asset.objects.count(),
        "inventory_items_total": InventoryItem.objects.count(),
        "open_tickets": RepairTicket.objects.filter(status="OPEN").count(),
        "assigned_assets": Asset.objects.filter(status="ASSIGNED").count(),
    }
    return Response({"totals": totals, "asset_by_status": asset_by_status})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recent_activity(request):
    user = request.user
    limit = int(request.query_params.get("limit", 5))

    if is_admin(user):
        tickets_qs = RepairTicket.objects.select_related(
            "asset", "assigned_technician", "created_by", "resolved_by"
        ).order_by("-created_at")[:limit]

        assignments_qs = Assignment.objects.select_related(
            "asset", "employee"
        ).order_by("-date_assigned")[:limit]
    else:
        tickets_qs = RepairTicket.objects.select_related(
            "asset", "assigned_technician", "created_by", "resolved_by"
        ).filter(
            Q(created_by=user)
            | Q(assigned_technician=user)
            | Q(asset_id__in=Assignment.objects.filter(employee=user).values_list("asset_id", flat=True))
        ).distinct().order_by("-created_at")[:limit]

        assignments_qs = Assignment.objects.select_related(
            "asset", "employee"
        ).filter(employee=user).order_by("-date_assigned")[:limit]

    return Response(
        {
            "tickets": RecentTicketSerializer(tickets_qs, many=True).data,
            "assignments": RecentAssignmentSerializer(assignments_qs, many=True).data,
        }
    )