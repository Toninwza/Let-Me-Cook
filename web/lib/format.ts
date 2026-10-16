import { locale } from "@/lib/i18n";

// Formatters follow the language chosen in Settings; they are built per call so a switch takes effect at once.
const bahtFmt = (min: number) => new Intl.NumberFormat(locale(), { minimumFractionDigits: min, maximumFractionDigits: 2 });

export const baht = (n: number) => `฿${bahtFmt(Number.isInteger(n) ? 0 : 2).format(n)}`;

/** A YYYY-MM-DD date (already a Bangkok calendar date) as "ส. 17 ต.ค." or "Sat 17 Oct". */
export function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale(), { weekday: "short", day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
}

/** A UTC timestamp shown in Bangkok time, e.g. "15 ต.ค. 22:41". */
export const stamp = (iso: string) =>
  new Intl.DateTimeFormat(locale(), {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`));
