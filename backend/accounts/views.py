from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser

from .models import User
from .serializers import (
    MeSerializer,
    MeUpdateSerializer,
    UserPublicSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from core.permissions import IsAdminRole


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        ser = MeUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(MeSerializer(request.user, context={"request": request}).data)


class MeAvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        avatar = request.FILES.get("avatar")
        if not avatar:
            return Response({"detail": "avatar file is required"}, status=status.HTTP_400_BAD_REQUEST)

        request.user.avatar = avatar
        request.user.save(update_fields=["avatar"])
        return Response(MeSerializer(request.user, context={"request": request}).data)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserPublicSerializer
    permission_classes = [IsAuthenticated, IsAdminRole]


class PasswordResetRequestView(APIView):
    permission_classes = []  # public

    def post(self, request):
        ser = PasswordResetRequestSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()

        # Always return same message (security)
        return Response(
            {"detail": "If that account exists, we sent password reset instructions."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = []  # public

    def post(self, request, uidb64: str, token: str):
        ser = PasswordResetConfirmSerializer(
            data=request.data,
            context={"uidb64": uidb64, "token": token},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"detail": "Password reset successful. Please login."}, status=status.HTTP_200_OK)