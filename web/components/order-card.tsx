"use client";

import { useState } from "react";
import { Order, getOrder } from "@/lib/api";
import { baht, deliveryIcs, formatDate, formatTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { FINAL, STATUS_LABEL, STATUS_STYLE } from "@/lib/status";

const TRACK = [
  { key: "paid", label: "จ่ายแล้ว" },
  { key: "shipped", label: "กำลังจัดส่ง" },
  { key: "delivered", label: "ได้รับแล้ว" },
] as const;

/** E-receipt in the chat. Follows the order every 3 s until it is delivered or cancelled. */
export function OrderCard({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  usePoll(async () => setOrder(await getOrder(order.order_id)), 3000, !FINAL.includes(order.status));

  const reached = TRACK.findIndex((s) => s.key === order.status);

  function addToCalendar() {
    const ics = deliveryIcs(order.title, order.delivery_date, order.order_id);
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-${order.order_id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className="animate-rise overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-violet-100">
      <header className="flex items-center justify-between bg-linear-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">ใบเสร็จ U-Pay</p>
          <p className="text-[11px] opacity-80">{order.order_id}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </header>

      <div className="space-y-3 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <p className="line-clamp-2">
            {order.title} <span className="text-neutral-400">× {order.quantity}</span>
          </p>
          <p className="shrink-0 font-semibold">{baht.format(order.total)}</p>
        </div>
        {order.utag_discount > 0 && (
          <p className="text-xs text-violet-700">
            ประหยัดด้วย U-Tag {order.utag_discount_percent}% ({baht.format(order.utag_discount)})
          </p>
        )}

        {order.status !== "cancelled" && (
          <ol className="grid grid-cols-3 gap-1 pt-1">
            {TRACK.map((step, i) => {
              const on = reached >= i;
              return (
                <li key={step.key} className="space-y-1.5 text-center">
                  <div className={`h-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-neutral-200"}`} />
                  <p className={`text-[11px] ${on ? "font-semibold text-emerald-700" : "text-neutral-400"}`}>
                    {step.label}
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        <div className="space-y-1 rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
          {order.paid_at && <p>💳 ชำระเมื่อ {formatTime(order.paid_at)} น.</p>}
          {order.tracking_number && (
            <p>
              📦 เลขพัสดุ <span className="font-mono font-semibold text-neutral-800">{order.tracking_number}</span>
            </p>
          )}
          <p>🚚 กำหนดส่ง {formatDate(order.delivery_date)} · {order.shop.name}</p>
          <p>
            📍 {order.address.district} {order.address.province}
          </p>
        </div>

        {!FINAL.includes(order.status) && (
          <button
            onClick={addToCalendar}
            className="w-full rounded-full border border-violet-200 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50"
          >
            📅 เพิ่มวันรับของลงปฏิทิน
          </button>
        )}
      </div>
    </article>
  );
}
