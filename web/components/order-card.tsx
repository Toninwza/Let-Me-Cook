"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Order, getOrder } from "@/lib/api";
import { baht } from "@/lib/format";
import OrderSteps from "./order-steps";
import ProductThumb from "./product-thumb";

export const STATUS_LABEL: Record<Order["status"], string> = {
  pending_confirm: "รอยืนยัน",
  awaiting_payment: "รอชำระเงิน",
  payment_failed: "จ่ายไม่สำเร็จ",
  paid: "รอร้านจัดส่ง",
  shipped: "กำลังจัดส่ง",
  delivered: "ได้รับแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

/** The order card shown in the chat after payment. Polls until delivered or cancelled. */
export default function OrderCard({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  const finished = order.status === "delivered" || order.status === "cancelled";

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(async () => {
      try {
        setOrder(await getOrder(initial.order_id));
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [finished, initial.order_id]);

  return (
    <section aria-label="ออเดอร์ของคุณ" className="space-y-3 rounded-2xl border border-line bg-paper p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">ออเดอร์ของคุณ</span>
        <span className="rounded-full bg-basil-soft px-2.5 py-0.5 text-xs font-semibold text-basil-dark">{STATUS_LABEL[order.status]}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <ProductThumb imageUrl={null} category={order.shop.name} className="h-12 w-12 shrink-0 rounded-lg text-[9px]" />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{order.title}</div>
          <div className="text-xs text-muted tabular-nums">
            x{order.quantity} · จ่ายแล้ว {baht(order.total)} · {order.shop.name}
          </div>
        </div>
      </div>
      <OrderSteps order={order} />
      {order.tracking_number && (
        <div className="text-xs text-muted">
          เลขพัสดุ <span className="font-mono text-ink">{order.tracking_number}</span>
        </div>
      )}
      <Link href="/orders" className="flex h-11 items-center justify-center rounded-xl border border-line-strong font-semibold hover:bg-ground">
        ดูรายละเอียดออเดอร์
      </Link>
    </section>
  );
}
