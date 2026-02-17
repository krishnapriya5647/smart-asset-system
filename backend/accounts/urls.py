from django.urls import path
from .views import (
    MeView,
    MeAvatarUploadView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/avatar/", MeAvatarUploadView.as_view(), name="me-avatar"),

    # Password reset
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset/<str:uidb64>/<str:token>/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]