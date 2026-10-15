import type { Order } from "@/lib/api";
import { shortDate, stamp } from "@/lib/format";

const RANK: Record<Order["status"], number> = {
  pending_confirm: 0,
  awaiting_payment: 0,
  payment_failed: 0,
  cancelled: 0,
  paid: 1,
  shipped: 2,
  delivered: 3,
};

export default function OrderSteps({ order }: { order: Order }) {
  const r = RANK[order.status];
  const steps = [
    { label: "จ่ายแล้ว", when: order.paid_at ? stamp(order.paid_at) : "รอจ่าย", done: r >= 1 },
    {
      label: "กำลังจัดส่ง",
      when: order.shipped_at ? stamp(order.shipped_at) : r >= 1 ? "ร้านกำลังเตรียมของ" : "",
      done: r >= 2,
    },
    {
      label: "ได้รับแล้ว",
      when: order.delivered_at ? stamp(order.delivered_at) : `คาดว่า ${shortDate(order.delivery_date)}`,
      done: r >= 3,
    },
  ];
  return (
    <ol className="grid grid-cols-3 gap-1.5" aria-label="สถานะออเดอร์">
      {steps.map((s) => (
        <li key={s.label} className="flex flex-col gap-1.5">
          <span className={`h-1 rounded-full ${s.done ? "bg-basil" : "bg-line"}`} />
          <span className={`text-xs font-semibold ${s.done ? "text-basil-dark" : "text-faint"}`}>{s.label}</span>
          <span className="text-[11px] leading-tight text-muted">{s.when}</span>
        </li>
      ))}
    </ol>
  );
}
