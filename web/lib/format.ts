export const baht = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

const thaiDay = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" });
const thaiTime = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit" });

/** "2026-10-17" (a Bangkok calendar date) -> "ส. 17 ต.ค." */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return thaiDay.format(new Date(y, m - 1, d));
}

export function formatTime(iso: string) {
  return thaiTime.format(new Date(iso));
}

/** Product images are not in the catalog yet, so cards show a tile per category. */
export function categoryIcon(category: string) {
  if (category.includes("เก้าอี้")) return "🪑";
  if (category.includes("หูฟัง")) return "🎧";
  if (category.includes("แท็บเล็ต")) return "📱";
  if (category.includes("ไฟ") || category.includes("โคม")) return "💡";
  return "🛍️";
}

/** A one-event .ics file for the delivery day, so the user can add it to any calendar app. */
export function deliveryIcs(title: string, isoDate: string, orderId: string) {
  const day = isoDate.replaceAll("-", "");
  const next = new Date(`${isoDate}T00:00:00`);
  next.setDate(next.getDate() + 1);
  const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, "0")}${String(next.getDate()).padStart(2, "0")}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Let-Me-Cook//U-Pay//TH",
    "BEGIN:VEVENT",
    `UID:${orderId}@let-me-cook`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:รอรับ ${title}`,
    `DESCRIPTION:คำสั่งซื้อ ${orderId} จาก Let-Me-Cook`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
