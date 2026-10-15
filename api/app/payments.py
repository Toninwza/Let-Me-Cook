"""Stripe PromptPay. The only module that talks to Stripe."""

from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cache

import stripe

from app.config import settings


class PaymentsNotConfigured(RuntimeError):
    pass


@dataclass
class PromptPayQR:
    payment_intent_id: str
    image_url: str
    test_url: str | None
    expires_at: datetime | None


@cache
def _client() -> stripe.StripeClient:
    if not settings.stripe_secret_key:
        raise PaymentsNotConfigured("STRIPE_SECRET_KEY is not set in api/.env")
    return stripe.StripeClient(settings.stripe_secret_key)


def is_test_mode() -> bool:
    return settings.stripe_secret_key.startswith(("sk_test_", "rk_test_"))


async def create_promptpay(order_id: str, amount_thb: float, email: str) -> PromptPayQR:
    intent = await _client().v1.payment_intents.create_async(
        params={
            "amount": round(amount_thb * 100),  # satang
            "currency": "thb",
            # Newer Stripe API versions reject payment_method_types; methods come from the Dashboard.
            # PromptPay is a QR, not a redirect, so no return_url is needed.
            "automatic_payment_methods": {"enabled": True, "allow_redirects": "never"},
            "payment_method_data": {"type": "promptpay", "billing_details": {"email": email}},
            "confirm": True,
            "metadata": {"order_id": order_id},
        },
    )
    qr = intent.next_action.promptpay_display_qr_code
    # Stripe omits fields it has no value for, so read the optional ones with getattr.
    data = getattr(qr, "data", None) or ""
    expires_at = getattr(qr, "expires_at", None)
    # In test mode the QR encodes a URL to Stripe's authorize/fail page; scanning or opening it works.
    test_url = data if is_test_mode() and data.startswith("https://") else None
    expires = datetime.fromtimestamp(expires_at, UTC) if expires_at else None
    return PromptPayQR(intent.id, qr.image_url_png, test_url, expires)


@dataclass
class CheckoutPage:
    session_id: str
    url: str


async def create_checkout(order_id: str, title: str, quantity: int, amount_thb: float, email: str) -> CheckoutPage:
    """Stripe-hosted page for cards (Visa, Mastercard, JCB, Amex). Card data never touches our server.
    Which methods it offers comes from the Dashboard (newer API versions reject payment_method_types)."""
    done = f"{settings.web_url.rstrip('/')}/pay/done?order={order_id}"
    session = await _client().v1.checkout.sessions.create_async(
        params={
            "mode": "payment",
            "line_items": [
                {
                    # One line for the order total: it already includes quantity and the U-Tag discount.
                    "price_data": {
                        "currency": "thb",
                        "unit_amount": round(amount_thb * 100),
                        "product_data": {"name": f"{title} x {quantity}"},
                    },
                    "quantity": 1,
                }
            ],
            "customer_email": email,
            "success_url": done,
            "cancel_url": f"{done}&cancelled=1",
            "metadata": {"order_id": order_id},
        },
    )
    return CheckoutPage(session.id, session.url)


async def checkout_status(session_id: str) -> str:
    """'paid', 'expired' or 'open'."""
    session = await _client().v1.checkout.sessions.retrieve_async(session_id)
    if session.payment_status == "paid":
        return "paid"
    return "expired" if session.status == "expired" else "open"


async def expire_checkout(session_id: str) -> None:
    try:
        await _client().v1.checkout.sessions.expire_async(session_id)
    except stripe.StripeError:
        pass  # already paid or expired; the caller re-reads the status


async def intent_status(payment_intent_id: str) -> str:
    """Stripe status: succeeded, processing, requires_action, requires_payment_method, canceled."""
    intent = await _client().v1.payment_intents.retrieve_async(payment_intent_id)
    return intent.status


async def cancel(payment_intent_id: str) -> None:
    try:
        await _client().v1.payment_intents.cancel_async(payment_intent_id)
    except stripe.StripeError:
        pass  # already succeeded or canceled; the caller re-reads the status
