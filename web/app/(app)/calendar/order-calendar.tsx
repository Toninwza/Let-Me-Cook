"use client";

import { t, locale } from "@/lib/i18n";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DEMO_USER_ID, Order, listOrders } from "@/lib/api";
import { baht, shortDate } from "@/lib/format";
import { MenuButton } from "@/components/app-shell";
import { STATUS_LABEL } from "@/components/order-card";

/** Orders that have a delivery to wait for. Unpaid, failed and cancelled ones have no real date yet. */
const TRACKED: Order["status"][] = ["paid", "shipped", "delivered"];

const DOT: Partial<Record<Order["status"], string>> = {
  paid: "bg-[#24365A]",
  shipped: "bg-basil",
  delivered: "bg-faint",
};

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today's calendar date in Bangkok, the same zone the API uses for delivery_date. */
const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());

const monthStart = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1);
};

function dayDiff(iso: string, from: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const [fy, fm, fd] = from.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

function when(o: Order, today: string) {
  const n = dayDiff(o.delivery_date, today);
  if (o.status === "delivered") return t("ได้รับแล้ว");
  if (n === 0) return t("ถึงวันนี้");
  if (n === 1) return t("ถึงพรุ่งนี้");
  if (n > 1) return t("ถึงอีก {n} วัน", { n });
  return t("เลยกำหนดมา {n} วัน", { n: -n });
}

export default function OrderCalendar() {
  // "Today" depends on the clock, so it is read after mount (Next.js cannot prerender the current time).
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setToday(todayKey()), 0);
    return () => clearTimeout(timer);
  }, []);
  return today ? <Calendar today={today} /> : <div className="h-full bg-ground" />;
}

function Calendar({ today }: { today: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState(false);
  const [month, setMonth] = useState(() => monthStart(today));
  const [selected, setSelected] = useState(today);

  useEffect(() => {
    let live = true;
    const load = () =>
      listOrders({ userId: DEMO_USER_ID }).then(
        (list) => {
          if (!live) return;
          setOrders(list);
          setError(false);
        },
        () => live && setError(true),
      );
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 5000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of orders ?? []) {
      if (!TRACKED.includes(o.status)) continue;
      map.set(o.delivery_date, [...(map.get(o.delivery_date) ?? []), o]);
    }
    return map;
  }, [orders]);

  const upcoming = useMemo(
    () =>
      [...byDay.values()]
        .flat()
        .filter((o) => o.status !== "delivered")
        .sort((a, b) => a.delivery_date.localeCompare(b.delivery_date)),
    [byDay],
  );

  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const lead = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(y, m, i + 1))];
  }, [month]);

  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale(), { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 7 + i))); // 7 Jan 2024 is a Sunday
  }, []);

  const title = new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(month);
  const dayOrders = byDay.get(selected) ?? [];
  const step = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  function pick(o: Order) {
    setSelected(o.delivery_date);
    setMonth(monthStart(o.delivery_date));
  }

  return (
    <div className="h-full overflow-y-auto bg-ground">
      <header className="sticky top-0 z-10 flex h-[60px] items-center gap-1 border-b border-line bg-paper px-2 md:h-[68px] md:px-8">
        <MenuButton className="text-ink hover:bg-ground" />
        <h1 className="text-base font-bold md:text-lg">{t("ปฏิทินสั่งซื้อ")}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-4 py-4 md:px-8 md:py-7 lg:flex-row lg:items-start">
        <section className="rounded-2xl bg-paper p-4 lg:flex-1">
          {error && <p className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{t("โหลดออเดอร์ไม่สำเร็จ")}</p>}
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => step(-1)} aria-label={t("เดือนก่อน")} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-ground">
              ‹
            </button>
            <h2 className="font-bold">{title}</h2>
            <button onClick={() => step(1)} aria-label={t("เดือนถัดไป")} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-ground">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((w) => (
              <div key={w} className="py-1 text-[11.5px] font-semibold text-muted">
                {w}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`blank${i}`} />;
              const k = key(d);
              const list = byDay.get(k) ?? [];
              const isSel = k === selected;
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  aria-pressed={isSel}
                  className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm tabular-nums ${
                    isSel ? "bg-basil font-bold text-paper" : k === today ? "bg-basil-soft font-bold text-basil-dark" : "hover:bg-ground"
                  }`}
                >
                  {d.getDate()}
                  <span className="flex h-1.5 gap-0.5">
                    {list.slice(0, 3).map((o) => (
                      <span key={o.order_id} className={`h-1.5 w-1.5 rounded-full ${isSel ? "bg-paper" : DOT[o.status]}`} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            {TRACKED.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${DOT[s]}`} />
                {t(STATUS_LABEL[s])}
              </span>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:w-[340px]">
          <section className="rounded-2xl bg-paper p-4">
            <h2 className="mb-2.5 text-[15px] font-bold">{shortDate(selected)}</h2>
            {orders === null ? (
              <p className="text-sm text-muted">{t("กำลังโหลด")}</p>
            ) : dayOrders.length === 0 ? (
              <p className="text-sm text-muted">{t("ไม่มีของถึงวันนี้")}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {dayOrders.map((o) => (
                  <Row key={o.order_id} o={o} today={today} />
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl bg-paper p-4">
            <h2 className="mb-2.5 text-[15px] font-bold">{t("กำลังจะถึง")}</h2>
            {orders !== null && upcoming.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-muted">{t("ยังไม่มีของที่รอส่ง")}</p>
                <Link href="/chat" className="text-[13.5px] font-medium text-basil underline">
                  {t("บอก bot ว่าอยากได้อะไร")}
                </Link>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upcoming.map((o) => (
                  <Row key={o.order_id} o={o} today={today} showDate onPick={() => pick(o)} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ o, today, showDate, onPick }: { o: Order; today: string; showDate?: boolean; onPick?: () => void }) {
  const body = (
    <>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[o.status]}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="line-clamp-2 text-[13.5px] font-medium leading-snug">{o.title}</span>
        <span className="text-xs text-muted">
          {showDate && <>{shortDate(o.delivery_date)} · </>}
          {o.shop.name} · {t(STATUS_LABEL[o.status])} · {when(o, today)}
        </span>
      </span>
      <span className="text-[13px] font-semibold tabular-nums">{baht(o.total)}</span>
    </>
  );
  return (
    <li>
      {onPick ? (
        <button onClick={onPick} className="flex w-full gap-2.5 rounded-xl p-1.5 hover:bg-ground">
          {body}
        </button>
      ) : (
        <div className="flex gap-2.5 p-1.5">{body}</div>
      )}
    </li>
  );
}
