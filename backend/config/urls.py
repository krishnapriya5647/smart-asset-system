from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from accounts.views import UserViewSet
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import views as auth_views
from accounts.views_password_reset import PasswordResetView

from core.views import (
    AssetViewSet,
    InventoryViewSet,
    AssignmentViewSet,
    TicketViewSet,
    dashboard_stats,
    recent_activity,
)

router = DefaultRouter()
router.register(r"assets", AssetViewSet)
router.register(r"inventory", InventoryViewSet)
router.register(r"assignments", AssignmentViewSet)
router.register(r"tickets", TicketViewSet)
router.register(r"users", UserViewSet)
urlpatterns = [
    path("admin/", admin.site.urls),

    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/dashboard/", dashboard_stats),
    path("api/recent-activity/", recent_activity),

    path("api/", include("accounts.urls")),
    path("api/", include("notifications.urls")),
    path("api/", include(router.urls)),
    path("api/auth/password-reset/", PasswordResetView.as_view(), name="password_reset"),    path("api/auth/password-reset/done/", auth_views.PasswordResetDoneView.as_view(), name="password_reset_done"),
    path("api/auth/reset/<uidb64>/<token>/", auth_views.PasswordResetConfirmView.as_view(), name="password_reset_confirm"),
    path("api/auth/reset/done/", auth_views.PasswordResetCompleteView.as_view(), name="password_reset_complete"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
