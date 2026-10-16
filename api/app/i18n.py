"""Reply language (Thai or English) and the fixed bot texts in both.

The bot answers in the language of the user's latest message. Detection is by script, not by the
model, so the very first status line of a turn is already in the right language.
"""

import re
from datetime import date
from typing import Literal

Lang = Literal["th", "en"]

_THAI = re.compile(r"[฀-๿]")
_LATIN = re.compile(r"[A-Za-z]")


def detect(text: str, fallback: Lang = "th") -> Lang:
    """Thai script -> th, Latin letters only -> en, neither (e.g. "1", "👍") -> fallback."""
    if _THAI.search(text):
        return "th"
    if _LATIN.search(text):
        return "en"
    return fallback


NAME = {"th": "Thai", "en": "English"}
VOICE = {
    "th": 'polite male shop assistant: end sentences with "ครับ", never "ค่ะ" or "คะ"',
    "en": "friendly, natural and concise shop assistant",
}

_MONTHS = {
    "th": ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}


def short_date(d: date, lang: Lang) -> str:
    return f"{d.day} {_MONTHS[lang][d.month - 1]}"


_TEXT: dict[Lang, dict[str, str]] = {
    "th": {
        # step labels
        "parse": "อ่านความต้องการ",
        "profile": "ดึงที่อยู่จัดส่งจาก U-Tag",
        "search": "ค้นสินค้าจากร้านบนแพลตฟอร์ม",
        "retry": "ค้นใหม่ด้วยคำที่กว้างขึ้น",
        "filter": "คัดสินค้าที่ส่งไม่ได้หรือเกินงบออก",
        "rank": "จัดอันดับจากรีวิว ราคา และวันส่ง",
        "rank_all": "เรียงตามความตรง รีวิว และจำนวนรีวิว",
        "resolve": "หาสินค้าที่เลือกจากรอบก่อน",
        # step details
        "found": "เจอ {n} รายการที่ตรงคำค้น",
        "retry_done": "ลองคำว่า {words}: เจอ {n} รายการ",
        "retry_words": "คำทั่วไป",
        "retry_failed": "ค้นซ้ำไม่สำเร็จ ใช้ผลรอบแรก",
        "out_of_stock": "ตัดของหมดสต็อก {n} รายการ",
        "over_budget": "เกินงบ {n} รายการ",
        "out_of_range": "ราคาไม่อยู่ในช่วง {n} รายการ",
        "late_by": "ส่งไม่ทัน {date} {n} รายการ",
        "late": "ส่งไม่ทัน {n} รายการ",
        "left": "เหลือ {n} ตัวเลือก",
        "showing": "แสดง {shown} จาก {total} รายการ",
        "resolve_failed": "ไม่พบสินค้าที่เลือกในรอบก่อน",
        "step_failed": "ขั้นตอนนี้ขัดข้อง",
        # bot messages
        "everything": "สินค้าทั้งหมดบนแพลตฟอร์ม",
        "all_count": "{what} มี {total} รายการครับ",
        "all_more": " แสดง {shown} รายการที่ตรงและรีวิวดีที่สุดก่อน บอกหมวดหรืองบเพิ่มได้เลยครับ",
        "which_one": "ยังไม่แน่ใจว่าหมายถึงสินค้าตัวไหนครับ บอกชื่อหรือลำดับในการ์ดได้เลย",
        "pay_promptpay": " จ่ายด้วย PromptPay",
        "pay_card": " จ่ายด้วยบัตร",
        "checkout": "เปิดหน้า U-Pay{pay} สำหรับ {title} ให้แล้วครับ {next}",
        "next_pay": "ยืนยันแล้วจ่ายได้เลย",
        "next_review": "ตรวจยอดก่อนกดยืนยันได้เลย",
        "no_more": "ไม่มีตัวเลือกอื่นนอกจากที่แสดงไปแล้วครับ",
        "no_match": "ยังไม่มีสินค้าที่ตรงกับ {what}{budget}",
        "budget": " ในงบ {amount} บาท",
        "alt_default": "ดูสินค้าทั้งหมดในหมวดนี้",
        "fact_discount": "ลด {pct}% เหลือ {price} บาท",
        "fact_price": "ราคา {price} บาท",
        "fact": "รีวิว {rating} จาก {reviews} รีวิว {price} ส่งถึง {date} จากร้าน {shop}",
        "no_orders": "ยังไม่มีคำสั่งซื้อเลยครับ อยากให้ช่วยหาสินค้าอะไรบอกได้เลย",
        "order_line": "{title}: {status} ส่งถึง {date}",
        "tracking": " เลขพัสดุ {number}",
        "status_pending_confirm": "รอยืนยัน",
        "status_awaiting_payment": "รอชำระเงิน",
        "status_payment_failed": "จ่ายไม่สำเร็จ",
        "status_paid": "จ่ายแล้ว ร้านกำลังเตรียมส่ง",
        "status_shipped": "กำลังจัดส่ง",
        "status_delivered": "ได้รับแล้ว",
        "status_cancelled": "ยกเลิกแล้ว",
        # route errors
        "timeout": "bot ใช้เวลานานเกินไป ลองส่งใหม่อีกครั้งครับ",
        "agent_failed": "bot ขัดข้องชั่วคราว ลองส่งข้อความใหม่อีกครั้งครับ",
    },
    "en": {
        "parse": "Reading your request",
        "profile": "Getting your delivery address from U-Tag",
        "search": "Searching shops on the platform",
        "retry": "Searching again with broader words",
        "filter": "Removing items that can't arrive in time or are over budget",
        "rank": "Ranking by reviews, price and delivery",
        "rank_all": "Sorting by relevance, rating and reviews",
        "resolve": "Finding the product you picked",
        "found": "Found {n} matching items",
        "retry_done": "Tried broader words: found {n} items",  # the words themselves are often Thai
        "retry_words": "general words",
        "retry_failed": "Second search failed, using the first results",
        "out_of_stock": "{n} out of stock",
        "over_budget": "{n} over budget",
        "out_of_range": "{n} outside the price range",
        "late_by": "{n} can't arrive by {date}",
        "late": "{n} can't arrive in time",
        "left": "{n} picks left",
        "showing": "Showing {shown} of {total}",
        "resolve_failed": "Couldn't find the product you picked",
        "step_failed": "This step failed",
        "everything": "All products on the platform",
        "all_count": "{what}: {total} items.",
        "all_more": " Showing the {shown} best matches first. Tell me a category or budget to narrow it down.",
        "which_one": "I'm not sure which product you mean. Tell me its name or its number on the cards.",
        "pay_promptpay": " with PromptPay",
        "pay_card": " by card",
        "checkout": "Opening U-Pay{pay} for {title}. {next}",
        "next_pay": "Confirm and pay.",
        "next_review": "Check the total, then confirm.",
        "no_more": "There are no other options besides the ones I already showed.",
        "no_match": "Nothing matches {what}{budget} yet",
        "budget": " within {amount} baht",
        "alt_default": "See everything in this category",
        "fact_discount": "{pct}% off, now {price} baht",
        "fact_price": "{price} baht",
        "fact": "Rated {rating} from {reviews} reviews, {price}, arrives {date}, sold by {shop}",
        "no_orders": "You have no orders yet. Tell me what you are looking for and I will find it.",
        "order_line": "{title}: {status}, arrives {date}",
        "tracking": ", tracking number {number}",
        "status_pending_confirm": "not confirmed yet",
        "status_awaiting_payment": "waiting for payment",
        "status_payment_failed": "payment failed",
        "status_paid": "paid, the shop is preparing it",
        "status_shipped": "on the way",
        "status_delivered": "delivered",
        "status_cancelled": "cancelled",
        "timeout": "The bot took too long. Please send your message again.",
        "agent_failed": "The bot hit a temporary problem. Please send your message again.",
    },
}


def t(lang: Lang, key: str, **values) -> str:
    return _TEXT[lang][key].format(**values)
