import re

from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

from app.core.config import settings


def _client() -> Client:
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)


def _normalize_number(number: str) -> str:
    """Twilio requires E.164 (+countrycode...). Staff tend to enter local Pakistani
    numbers like "0321-9876543" — strip formatting and assume +92 for a leading 0,
    since every phone number already in this app's data is Pakistani."""
    digits = re.sub(r"[^\d+]", "", number)
    if digits.startswith("+"):
        return digits
    if digits.startswith("0"):
        return "+92" + digits[1:]
    return "+" + digits


def _whatsapp_address(number: str) -> str:
    normalized = _normalize_number(number)
    return normalized if normalized.startswith("whatsapp:") else f"whatsapp:{normalized}"


def send_sms(to: str, body: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, error_message)."""
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_SMS_FROM):
        return False, None, "Twilio SMS is not configured (missing credentials in .env)"
    try:
        message = _client().messages.create(
            to=_normalize_number(to), from_=settings.TWILIO_SMS_FROM, body=body
        )
        return True, message.sid, None
    except TwilioRestException as exc:
        return False, None, str(exc)


def send_whatsapp(to: str, body: str) -> tuple[bool, str | None, str | None]:
    """Returns (success, provider_message_id, error_message)."""
    if not (
        settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_FROM
    ):
        return False, None, "Twilio WhatsApp is not configured (missing credentials in .env)"
    try:
        message = _client().messages.create(
            to=_whatsapp_address(to),
            from_=_whatsapp_address(settings.TWILIO_WHATSAPP_FROM),
            body=body,
        )
        return True, message.sid, None
    except TwilioRestException as exc:
        return False, None, str(exc)
