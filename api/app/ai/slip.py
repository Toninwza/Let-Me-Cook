"""STUB. Always rejects, so no order can turn "paid" before real slip checking exists."""

from app.schemas import Receiver, SlipCheck


async def verify_slip(image_bytes: bytes, expected_amount: float, receiver: Receiver) -> SlipCheck:
    return SlipCheck(ok=False, amount=None, ref=None, reason="ระบบตรวจสลิปยังไม่พร้อมใช้งาน")
