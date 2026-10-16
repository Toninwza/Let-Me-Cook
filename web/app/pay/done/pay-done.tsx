"use client";

import { t } from "@/lib/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Order, getOrder } from "@/lib/api";
import { baht } from "@/lib/format";
import Magnet from "@/components/magnet";

const PAID = ["paid", "shipped", "delivered"];

/** Stripe Checkout lands here. Shows the order status our API read from Stripe, not just the redirect. */
export function PayDone() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const cancelled = params.has("cancelled");
  const [order, setOrder] = useState<Order | null>(null);
  const paid = order !== null && PAID.includes(order.status);

  useEffect(() => {
    if (!orderId || paid) return;
    const load = () => getOrder(orderId).then(setOrder, () => {});
    const first = setTimeout(load, 0);
    const timer = setInterval(load, 2000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [orderId, paid]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-paper p-8 text-center shadow-[0_18px_50px_rgba(23,33,29,0.10)]">
      {paid ? (
        <>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-basil-soft text-basil">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
          <h1 className="text-xl font-bold">{t("ชำระเงินสำเร็จ")}</h1>
          <p className="text-sm text-ink-2">
            {order.title} · <span className="font-semibold tabular-nums">{baht(order.total)}</span>
          </p>
        </>
      ) : cancelled ? (
        <>
          <Magnet size={48} />
          <h1 className="text-xl font-bold">{t("ยังไม่ได้ชำระเงิน")}</h1>
          <p className="text-sm text-ink-2">{t("กลับไปที่แชทเพื่อจ่ายอีกครั้ง หรือเลือกวิธีจ่ายอื่นได้ครับ")}</p>
        </>
      ) : (
        <>
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-basil-soft border-t-basil" />
          <h1 className="text-xl font-bold">{t("กำลังยืนยันการชำระเงิน")}</h1>
        </>
      )}
      <p className="text-xs text-muted">{t("ปิดแท็บนี้แล้วกลับไปที่แชทได้เลย สถานะในแชทจะอัปเดตเอง")}</p>
      <Link href="/orders" className="flex h-11 items-center rounded-xl bg-basil px-5 font-semibold text-paper transition-colors hover:bg-basil-dark">
        {t("ดูออเดอร์ของฉัน")}
      </Link>
    </div>
  );
}
