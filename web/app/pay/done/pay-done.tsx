"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Order, getOrder } from "@/lib/api";
import { baht } from "@/lib/format";
import { usePoll } from "@/lib/hooks";

/** Shows the real order status (read from Stripe by the backend), not just "Stripe said OK". */
export function PayDone() {
  const params = useSearchParams();
  const orderId = params.get("order");
  const cancelled = params.has("cancelled");
  const [order, setOrder] = useState<Order | null>(null);

  usePoll(
    async () => {
      if (orderId) setOrder(await getOrder(orderId));
    },
    2000,
    Boolean(orderId) && order?.status !== "paid",
    true,
  );

  const paid = order && ["paid", "shipped", "delivered"].includes(order.status);

  return (
    <div className="animate-rise w-full max-w-sm space-y-4 rounded-[2rem] bg-white p-8 text-center shadow-2xl ring-1 ring-violet-100">
      {paid ? (
        <>
          <div className="animate-pop mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-4xl text-white shadow-lg shadow-emerald-200">
            ✓
          </div>
          <h1 className="text-lg font-semibold">ชำระเงินสำเร็จ</h1>
          <p className="text-sm text-neutral-500">
            {order.title} · {baht.format(order.total)}
          </p>
        </>
      ) : cancelled ? (
        <>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-neutral-100 text-3xl">↩</div>
          <h1 className="text-lg font-semibold">ยังไม่ได้ชำระเงิน</h1>
          <p className="text-sm text-neutral-500">กลับไปที่แชตเพื่อชำระอีกครั้งหรือเลือกวิธีอื่นได้ครับ</p>
        </>
      ) : (
        <>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
          <h1 className="text-lg font-semibold">กำลังยืนยันการชำระเงิน...</h1>
        </>
      )}
      <p className="text-xs text-neutral-400">ปิดแท็บนี้แล้วกลับไปที่แชตได้เลย ใบเสร็จจะขึ้นในแชตเอง</p>
      <Link href="/" className="inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white">
        กลับไปที่แชต
      </Link>
    </div>
  );
}
