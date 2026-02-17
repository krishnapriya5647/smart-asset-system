from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers

from .models import User


class UserPublicSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and hasattr(obj.avatar, "url"):
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class MeSerializer(UserPublicSerializer):
    pass


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "email"]


class PasswordResetRequestSerializer(serializers.Serializer):
    email_or_username = serializers.CharField()

    def save(self):
        value = self.validated_data["email_or_username"].strip()
        request = self.context.get("request")

        user = None
        if "@" in value:
            user = User.objects.filter(email__iexact=value).first()
        else:
            user = User.objects.filter(username__iexact=value).first()

        # Always act success (security best practice)
        if not user:
            return

        # Cannot send if no email
        if not user.email:
            return

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        frontend_url = getattr(settings, "FRONTEND_URL", "").rstrip("/")
        if not frontend_url:
            # fallback if not configured
            if request:
                frontend_url = request.build_absolute_uri("/").rstrip("/")
            else:
                return

        reset_link = f"{frontend_url}/reset-password/{uid}/{token}"

        subject = "Reset your password"
        ctx = {
            "user": user,
            "reset_link": reset_link,
            "app_name": getattr(settings, "APP_NAME", "Smart Asset System"),
        }

        # You can use templates (recommended). If missing, fallback to a simple text.
        try:
            text_body = render_to_string("accounts/password_reset_email.txt", ctx)
        except Exception:
            text_body = f"Use this link to reset your password: {reset_link}"

        try:
            html_body = render_to_string("accounts/password_reset_email.html", ctx)
        except Exception:
            html_body = f"<p>Use this link to reset your password:</p><p><a href='{reset_link}'>{reset_link}</a></p>"

        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
            to=[user.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    new_password1 = serializers.CharField(min_length=8, write_only=True)
    new_password2 = serializers.CharField(min_length=8, write_only=True)

    def validate(self, attrs):
        if attrs["new_password1"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password2": "Passwords do not match."})
        return attrs

    def save(self):
        uidb64 = self.context["uidb64"]
        token = self.context["token"]

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except Exception:
            raise serializers.ValidationError({"detail": "Invalid reset link."})

        if not default_token_generator.check_token(user, token):
            raise serializers.ValidationError({"detail": "Reset link is invalid or expired."})

        user.set_password(self.validated_data["new_password1"])
        user.save(update_fields=["password"])
        return user
