"use client";

import { useState } from "react";
import {
  ApiError,
  Order,
  PaymentMethod,
  ProductHit,
  UserProfile,
  cancelOrder,
  confirmOrder,
  createOrder,
  getOrder,
} from "@/lib/api";
import { baht, categoryIcon, formatDate } from "@/lib/format";
import { usePoll } from "@/lib/hooks";

const MIN_TOTAL = 10; // Stripe's minimum for THB, same rule as the backend

type Phase = "summary" | "paying" | "paid";

export function UPaySheet({
  product,
  initialQuantity,
  user,
  sessionId,
  onClose,
  onPaid,
}: {
  product: ProductHit;
  initialQuantity: number;
  user: UserProfile;
  sessionId: string | null;
  onClose: () => void;
  onPaid: (order: Order) => void;
}) {
  const maxQty = Math.max(1, Math.min(product.stock, 9));
  const [quantity, setQuantity] = useState(Math.min(Math.max(1, initialQuantity), maxQty));
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [phase, setPhase] = useState<Phase>("summary");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview only; the order the backend returns is what the user pays.
  const subtotal = Math.round(product.price * quantity * 100) / 100;
  const discount = Math.round(subtotal * user.discount_percent) / 100;
  const total = Math.max(Math.round((subtotal - discount) * 100) / 100, MIN_TOTAL);

  async function run(step: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await step();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้งครับ");
    } finally {
      setBusy(false);
    }
  }

  const pay = () =>
    run(async () => {
      const created =
        order ??
        (await createOrder({
          session_id: sessionId,
          user_id: user.user_id,
          product_id: product.product_id,
          quantity,
          payment_method: method,
        }));
      setOrder(created);
      setOrder(await confirmOrder(created.order_id));
      setPhase("paying");
    });

  const newQr = () =>
    run(async () => {
      if (order) setOrder(await confirmOrder(order.order_id));
    });

  const cancel = () =>
    run(async () => {
      if (order) await cancelOrder(order.order_id);
      onClose();
    });

  usePoll(
    async () => {
      if (!order) return;
      const latest = await getOrder(order.order_id);
      setOrder(latest);
      if (latest.status === "paid") {
        setPhase("paid");
        onPaid(latest);
      }
    },
    3000,
    phase === "paying" && order?.status === "awaiting_payment",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/40 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="U-Pay"
        className="animate-rise w-full max-w-md rounded-t-[2rem] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]"
      >
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white">
              U
            </span>
            <div>
              <p className="text-sm font-semibold">U-Pay</p>
              <p className="text-[11px] text-neutral-500">PromptPay หรือบัตร ผ่าน Stripe</p>
            </div>
          </div>
          {phase !== "paying" && (
            <button onClick={onClose} aria-label="ปิด" className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100">
              ✕
            </button>
          )}
        </header>

        {phase === "summary" && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-2xl bg-violet-50/60 p-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-3xl">
                {categoryIcon(product.category)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
                <p className="text-xs text-neutral-500">
                  {product.shop.name} · {baht.format(product.price)} / ชิ้น
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">จำนวน</span>
              <div className="flex items-center gap-3">
                <QtyButton label="ลด" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1 || !!order}>
                  −
                </QtyButton>
                <span className="w-5 text-center font-semibold">{quantity}</span>
                <QtyButton label="เพิ่ม" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty || !!order}>
                  +
                </QtyButton>
              </div>
            </div>

            <dl className="space-y-1.5 rounded-2xl border border-neutral-100 p-3 text-sm">
              <Row label="ราคาสินค้า" value={baht.format(subtotal)} />
              {user.discount_percent > 0 && (
                <Row label={`ส่วนลด U-Tag ${user.discount_percent}%`} value={`-${baht.format(discount)}`} accent />
              )}
              <div className="my-1 border-t border-dashed border-neutral-200" />
              <Row label="ยอดชำระ" value={baht.format(total)} strong />
            </dl>

            <div className="space-y-1 text-xs text-neutral-600">
              <p>
                📍 ส่งที่ {user.address.line} {user.address.district} {user.address.province} {user.address.postcode}
              </p>
              <p>🚚 ได้รับภายใน {formatDate(product.delivery_date)}</p>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-neutral-600">วิธีชำระเงิน</legend>
              <div className="grid grid-cols-2 gap-2">
                <MethodOption
                  active={method === "promptpay"}
                  disabled={!!order}
                  onPick={() => setMethod("promptpay")}
                  title="PromptPay"
                  note="สแกน QR ในแอปธนาคาร"
                  icon="📱"
                />
                <MethodOption
                  active={method === "card"}
                  disabled={!!order}
                  onPick={() => setMethod("card")}
                  title="บัตรเครดิต/เดบิต"
                  note="Visa · Mastercard · JCB"
                  icon="💳"
                />
              </div>
            </fieldset>

            {error && <ErrorNote text={error} />}

            <button
              onClick={pay}
              disabled={busy}
              className="w-full rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "กำลังเตรียมการชำระเงิน..." : `ยืนยันและชำระ ${baht.format(total)}`}
            </button>
          </div>
        )}

        {phase === "paying" && order && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-neutral-600">
              {order.payment_method === "card" ? "ชำระด้วยบัตรบนหน้าปลอดภัยของ Stripe" : "สแกน QR ด้วยแอปธนาคารเพื่อชำระ"}
            </p>
            <p className="text-3xl font-bold text-neutral-900">{baht.format(order.total)}</p>

            {order.status === "payment_failed" ? (
              <div className="space-y-3 rounded-2xl bg-red-50 p-4">
                <p className="text-sm text-red-700">การชำระเงินไม่สำเร็จ</p>
                <button
                  onClick={newQr}
                  disabled={busy}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  ลองชำระอีกครั้ง
                </button>
              </div>
            ) : order.payment_url ? (
              <a
                href={order.payment_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-md hover:brightness-110"
              >
                💳 ไปหน้าชำระเงินด้วยบัตร
              </a>
            ) : (
              order.payment_qr_url && (
                <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-md ring-1 ring-violet-100">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote QR from Stripe, shown once */}
                  <img src={order.payment_qr_url} alt="PromptPay QR" width={208} height={208} className="h-52 w-52" />
                </div>
              )
            )}

            {order.status === "awaiting_payment" && (
              <p className="flex items-center justify-center gap-2 text-xs text-neutral-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                รอการชำระเงิน ระบบตรวจกับ Stripe อัตโนมัติ
              </p>
            )}

            {order.payment_test_url && order.status === "awaiting_payment" && (
              <a
                href={order.payment_test_url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 hover:bg-amber-100"
              >
                โหมดทดสอบ: แตะเพื่อจำลองการสแกน (Stripe test mode)
              </a>
            )}

            {error && <ErrorNote text={error} />}

            <button onClick={cancel} disabled={busy} className="text-xs text-neutral-400 underline hover:text-neutral-600">
              ยกเลิกรายการ
            </button>
          </div>
        )}

        {phase === "paid" && order && (
          <div className="space-y-3 py-4 text-center">
            <div className="animate-pop mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-4xl text-white shadow-lg shadow-emerald-200">
              ✓
            </div>
            <p className="text-lg font-semibold">ชำระเงินสำเร็จ</p>
            <p className="text-sm text-neutral-500">
              {baht.format(order.total)} · คำสั่งซื้อ {order.order_id}
            </p>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              ดูใบเสร็จในแชต
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={strong ? "font-semibold" : "text-neutral-600"}>{label}</dt>
      <dd className={strong ? "text-base font-bold" : accent ? "font-medium text-violet-700" : ""}>{value}</dd>
    </div>
  );
}

function QtyButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-full border border-neutral-200 text-lg leading-none hover:bg-neutral-50 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">{text}</p>;
}

function MethodOption({
  active,
  disabled,
  onPick,
  title,
  note,
  icon,
}: {
  active: boolean;
  disabled: boolean;
  onPick: () => void;
  title: string;
  note: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-2xl p-3 text-left transition disabled:opacity-60 ${
        active ? "bg-violet-50 ring-2 ring-violet-500" : "bg-white ring-1 ring-neutral-200 hover:ring-violet-300"
      }`}
    >
      <span className="text-lg" aria-hidden>
        {icon}
      </span>
      <p className="mt-1 text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-neutral-500">{note}</p>
    </button>
  );
}
