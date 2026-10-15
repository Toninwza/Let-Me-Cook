import type { OrderStatus } from "@/lib/api";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_confirm: "รอยืนยัน",
  awaiting_payment: "รอชำระเงิน",
  payment_failed: "ชำระไม่สำเร็จ",
  paid: "ชำระแล้ว",
  shipped: "กำลังจัดส่ง",
  delivered: "ส่งถึงแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

export const STATUS_STYLE: Record<OrderStatus, string> = {
  pending_confirm: "bg-neutral-100 text-neutral-600",
  awaiting_payment: "bg-amber-100 text-amber-800",
  payment_failed: "bg-red-100 text-red-700",
  paid: "bg-emerald-100 text-emerald-800",
  shipped: "bg-sky-100 text-sky-800",
  delivered: "bg-violet-100 text-violet-800",
  cancelled: "bg-neutral-100 text-neutral-500",
};

/** Order states after which nothing changes any more. */
export const FINAL: OrderStatus[] = ["delivered", "cancelled"];
