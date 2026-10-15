"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  DEMO_USER_ID,
  Order,
  UserProfile,
  cancelOrder,
  getUser,
  listOrders,
  listProducts,
  setOrderStatus,
} from "@/lib/api";
import { baht, shortDate } from "@/lib/format";
import { STATUS_LABEL } from "@/components/order-card";
import OrderSteps from "@/components/order-steps";
import ProductThumb from "@/components/product-thumb";
import UPaySheet, { CheckoutProduct } from "@/components/upay-sheet";

type Tab = "all" | "awaiting_payment" | "paid" | "shipped" | "delivered";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "awaiting_payment", label: "รอชำระ" },
  { key: "paid", label: "รอจัดส่ง" },
  { key: "shipped", label: "กำลังส่ง" },
  { key: "delivered", label: "ได้รับแล้ว" },
];

const TONE: Record<Order["status"], { text: string; strip: string }> = {
  pending_confirm: { text: "text-muted", strip: "bg-ground text-ink-2" },
  awaiting_payment: { text: "text-saffron-ink", strip: "bg-[#FFF6E5] text-saffron-ink" },
  payment_failed: { text: "text-danger", strip: "bg-danger-soft text-danger" },
  paid: { text: "text-[#24365A]", strip: "bg-[#EEF2F8] text-[#24365A]" },
  shipped: { text: "text-basil-dark", strip: "bg-basil-soft text-basil-dark" },
  delivered: { text: "text-ink-2", strip: "bg-ground text-ink-2" },
  cancelled: { text: "text-faint", strip: "bg-ground text-faint" },
};

function stripText(o: Order) {
  switch (o.status) {
    case "payment_failed":
      return "จ่ายไม่สำเร็จ สร้าง QR ใหม่ได้";
    case "awaiting_payment":
      return "ยังไม่ได้จ่าย QR PromptPay พร้อมแล้ว";
    case "paid":
      return "จ่ายแล้ว ร้านกำลังเตรียมของ";
    case "shipped":
      return `กำลังจัดส่ง คาดว่าถึง ${shortDate(o.delivery_date)}`;
    case "delivered":
      return "ได้รับสินค้าแล้ว";
    case "cancelled":
      return "ออเดอร์นี้ถูกยกเลิก";
    default:
      return "รอยืนยันออเดอร์";
  }
}

export default function MyOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [rebuy, setRebuy] = useState<CheckoutProduct | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listOrders({ userId: DEMO_USER_ID });
      setOrders(list);
      setOpen((cur) => cur ?? list.find((o) => o.status === "shipped")?.order_id ?? null);
    } catch {
      setError("โหลดออเดอร์ไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    getUser(DEMO_USER_ID).then(setUser, () => {});
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) setError(e instanceof ApiError ? e.message : "ทำรายการไม่สำเร็จ");
    }
    refresh();
  }

  async function buyAgain(o: Order) {
    const products = await listProducts(o.shop.shop_id).catch(() => []);
    const p = products.find((x) => x.product_id === o.product_id);
    if (p) setRebuy(p);
    else setError("สินค้านี้ไม่มีขายแล้ว");
  }

  const shown = (orders ?? []).filter((o) => tab === "all" || o.status === tab);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#EEF0EC] md:max-w-2xl">
      <header className="sticky top-0 z-10 bg-paper">
        <div className="flex items-center gap-1.5 px-2 pb-1 pt-2.5">
          <Link href="/chat" aria-label="กลับไปแชท" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-ground">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="flex-1 text-lg font-bold">ออเดอร์ของฉัน</h1>
        </div>
        <div role="tablist" aria-label="สถานะออเดอร์" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`h-11 shrink-0 whitespace-nowrap px-3 text-sm ${tab === t.key ? "font-bold text-basil shadow-[inset_0_-3px_0_var(--color-basil)]" : "font-medium text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="mx-3 mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <main className="flex flex-col gap-2.5 py-2.5">
        {orders === null && <p className="p-6 text-center text-sm text-muted">กำลังโหลด</p>}
        {orders !== null && shown.length === 0 && (
          <div className="flex flex-col items-center gap-3 bg-paper px-4 py-10 text-center">
            <p className="text-sm text-muted">ยังไม่มีออเดอร์ในสถานะนี้</p>
            <Link href="/chat" className="flex h-11 items-center rounded-xl bg-basil px-5 font-semibold text-paper hover:bg-basil-dark">
              บอก bot ว่าอยากได้อะไร
            </Link>
          </div>
        )}
        {shown.map((o) => {
          const tone = TONE[o.status];
          const expanded = open === o.order_id;
          return (
            <article key={o.order_id} className="flex flex-col gap-3 bg-paper px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9l1.5-5h13L20 9" />
                    <path d="M4 9h16v11H4z" />
                    <path d="M9 20v-6h6v6" />
                  </svg>
                  {o.shop.name}
                </span>
                <span className={`text-[13.5px] font-semibold ${tone.text}`}>{STATUS_LABEL[o.status]}</span>
              </div>

              <div className="flex gap-3">
                <ProductThumb imageUrl={null} category={o.shop.name} className="h-[72px] w-[72px] shrink-0 rounded-lg text-[10px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="text-[13.5px] leading-snug">{o.title}</div>
                  <div className="flex items-baseline justify-between tabular-nums">
                    <span className="text-[12.5px] text-muted">x{o.quantity}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-sm">{baht(o.unit_price)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right text-[13.5px] tabular-nums">
                รวม {o.quantity} รายการ: <span className="text-[15px] font-bold">{baht(o.total)}</span>
              </div>

              <button
                onClick={() => setOpen(expanded ? null : o.order_id)}
                aria-expanded={expanded}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] font-medium hover:brightness-[0.97] ${tone.strip}`}
              >
                <span className="flex-1">{stripText(o)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${expanded ? "rotate-90" : ""}`}>
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>

              {expanded && (
                <div className="space-y-2.5 px-0.5">
                  {o.status !== "cancelled" && <OrderSteps order={o} />}
                  {o.tracking_number && (
                    <div className="flex items-center gap-2 rounded-xl bg-ground py-1 pl-3 pr-1">
                      <span className="text-xs text-muted">เลขพัสดุ</span>
                      <span className="flex-1 font-mono text-sm tracking-wider">{o.tracking_number}</span>
                      <button
                        aria-label="คัดลอกเลขพัสดุ"
                        onClick={() => navigator.clipboard?.writeText(o.tracking_number ?? "").catch(() => {})}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-basil hover:bg-basil-soft"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="8" y="8" width="12" height="12" rx="2" />
                          <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted">
                    ส่งไปที่ {o.address.line} {o.address.district} {o.address.province} {o.address.postcode} · ออเดอร์{" "}
                    <span className="font-mono">{o.order_id}</span>
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {(o.status === "awaiting_payment" || o.status === "payment_failed") && (
                  <>
                    <Btn onClick={() => act(() => cancelOrder(o.order_id))}>ยกเลิก</Btn>
                    <Btn primary onClick={() => setPayOrder(o)}>
                      จ่ายเงิน
                    </Btn>
                  </>
                )}
                {o.status === "paid" && <BtnLink href="/chat">ถาม bot</BtnLink>}
                {o.status === "shipped" && (
                  <>
                    <BtnLink href="/chat">ถาม bot</BtnLink>
                    <Btn primary onClick={() => act(() => setOrderStatus(o.order_id, "delivered"))}>
                      ฉันได้รับสินค้าแล้ว
                    </Btn>
                  </>
                )}
                {(o.status === "delivered" || o.status === "cancelled") && (
                  <Btn primary onClick={() => buyAgain(o)}>
                    ซื้ออีกครั้ง
                  </Btn>
                )}
              </div>
            </article>
          );
        })}
      </main>

      {payOrder && (
        <UPaySheet
          product={null}
          resumeOrder={payOrder}
          user={user}
          sessionId={payOrder.session_id}
          onClose={() => {
            setPayOrder(null);
            refresh();
          }}
          onPaid={refresh}
        />
      )}
      {rebuy && (
        <UPaySheet
          product={rebuy}
          user={user}
          sessionId={null}
          onClose={() => {
            setRebuy(null);
            refresh();
          }}
          onPaid={refresh}
        />
      )}
    </div>
  );
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`h-10 rounded-xl border px-4 text-[13.5px] ${primary ? "border-basil bg-basil font-semibold text-paper hover:bg-basil-dark" : "border-line-strong text-ink hover:bg-ground"}`}
    >
      {children}
    </button>
  );
}

function BtnLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="flex h-10 items-center rounded-xl border border-line-strong px-4 text-[13.5px] text-ink hover:bg-ground">
      {children}
    </Link>
  );
}
