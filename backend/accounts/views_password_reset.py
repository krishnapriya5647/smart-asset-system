from django.conf import settings
from django.contrib.auth import views as auth_views

class PasswordResetView(auth_views.PasswordResetView):
    email_template_name = "registration/password_reset_email.html"

    def get_email_context(self, **kwargs):
        ctx = super().get_email_context(**kwargs)
        ctx["frontend_url"] = settings.FRONTEND_URL
        return ctx
