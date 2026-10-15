const bahtFmt = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const bahtFmt2 = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayFmt = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" });
const stampFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

export const baht = (n: number) => `฿${(Number.isInteger(n) ? bahtFmt : bahtFmt2).format(n)}`;

/** A YYYY-MM-DD date (already a Bangkok calendar date) as "ส. 17 ต.ค.". */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return dayFmt.format(new Date(y, m - 1, d));
}

/** A UTC timestamp shown in Bangkok time, e.g. "15 ต.ค. 22:41". */
export const stamp = (iso: string) => stampFmt.format(new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`));
