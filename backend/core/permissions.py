from rest_framework.permissions import BasePermission, SAFE_METHODS

def is_admin(user) -> bool:
    return bool(user and user.is_authenticated and getattr(user, "role", None) == "ADMIN")


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)


class AdminWriteElseReadOnly(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        return is_admin(user)


class TicketPermission(BasePermission):
    """
    Everyone can read (GET) and create (POST).
    Only ADMIN can update (PUT/PATCH) or delete (DELETE).
    Technician (assigned_technician) can mark done via custom action.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # allow list/retrieve
        if request.method in SAFE_METHODS:
            return True

        # allow create ticket
        if request.method == "POST":
            return True

        # allow technician mark-done action
        if getattr(view, "action", None) == "mark_done":
            return True

        # everything else update/delete only admin
        return is_admin(user)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        if getattr(view, "action", None) == "mark_done":
            return is_admin(user) or (obj.assigned_technician_id == user.id)

        return is_admin(user)


