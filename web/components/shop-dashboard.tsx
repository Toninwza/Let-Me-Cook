"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, Order, ShopInfo, listOrders, listProducts, setOrderStatus } from "@/lib/api";
import { baht, formatDate, formatTime } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/status";

const NEXT: Partial<Record<Order["status"], { to: "shipped" | "delivered"; label: string }>> = {
  paid: { to: "shipped", label: "📦 จัดส่งแล้ว" },
  shipped: { to: "delivered", label: "✓ ลูกค้าได้รับแล้ว" },
};

export function ShopDashboard() {
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [shopId, setShopId] = useState<string>("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    listProducts()
      .then((products) => {
        const seen = new Map<string, ShopInfo>();
        products.forEach((p) => seen.set(p.shop.shop_id, p.shop));
        setShops([...seen.values()]);
      })
      .catch(() => setError("โหลดรายชื่อร้านไม่ได้"));
  }, []);

  const load = async (id: string) => setOrders(await listOrders(id ? { shop_id: id } : {}));
  usePoll(() => load(shopId), 3000, true, true);

  function selectShop(id: string) {
    setShopId(id);
    setOrders(null);
    load(id).catch(() => setError("โหลดคำสั่งซื้อไม่ได้"));
  }

  async function advance(order: Order) {
    const step = NEXT[order.status];
    if (!step) return;
    setPending(order.order_id);
    setError(null);
    try {
      const updated = await setOrderStatus(order.order_id, step.to);
      setOrders((list) => list?.map((o) => (o.order_id === updated.order_id ? updated : o)) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }

  const visible = orders?.filter((o) => o.status !== "pending_confirm") ?? null;
  const paidTotal = visible?.filter((o) => ["paid", "shipped", "delivered"].includes(o.status)).reduce((s, o) => s + o.total, 0) ?? 0;
  const toShip = visible?.filter((o) => o.status === "paid").length ?? 0;

  return (
    <div className="min-h-dvh bg-linear-to-br from-violet-50 via-white to-fuchsia-50">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">หน้าร้านค้า</h1>
            <p className="text-sm text-neutral-500">คำสั่งซื้อจากแชต อัปเดตเองทุก 3 วินาที</p>
          </div>
          <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-violet-100 hover:ring-violet-300">
            ← กลับไปแชต
          </Link>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Stat label="ยอดขายที่ชำระแล้ว" value={baht.format(paidTotal)} />
          <Stat label="รอจัดส่ง" value={`${toShip} รายการ`} highlight={toShip > 0} />
        </div>

        <nav className="rail flex gap-2 overflow-x-auto">
          {[{ shop_id: "", name: "ทุกร้าน" } as Pick<ShopInfo, "shop_id" | "name">, ...shops].map((s) => (
            <button
              key={s.shop_id || "all"}
              onClick={() => selectShop(s.shop_id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
                shopId === s.shop_id ? "bg-violet-600 text-white shadow" : "bg-white text-neutral-600 ring-1 ring-violet-100 hover:ring-violet-300"
              }`}
            >
              {s.name}
            </button>
          ))}
        </nav>

        {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {visible === null ? (
          <p className="py-10 text-center text-sm text-neutral-400">กำลังโหลด...</p>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-neutral-500 ring-1 ring-violet-100">
            ยังไม่มีคำสั่งซื้อ ลองสั่งจากหน้าแชตดูครับ
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {visible.map((o) => {
              const step = NEXT[o.status];
              return (
                <li key={o.order_id} className="animate-rise rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-100">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {o.title} <span className="text-neutral-400">× {o.quantity}</span>
                      </p>
                      <p className="text-xs text-neutral-500">
                        {o.order_id} · {o.shop.name} · สั่งเมื่อ {formatTime(o.created_at)} น.
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[o.status]}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3 text-sm">
                    <div className="space-y-0.5 text-xs text-neutral-600">
                      <p>
                        📍 {o.address.line} {o.address.district} {o.address.province}
                      </p>
                      <p>🚚 ส่งภายใน {formatDate(o.delivery_date)}</p>
                      {o.tracking_number && <p className="font-mono">📦 {o.tracking_number}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{baht.format(o.total)}</span>
                      {step && (
                        <button
                          onClick={() => advance(o)}
                          disabled={pending === o.order_id}
                          className="rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-violet-700 disabled:opacity-50"
                        >
                          {step.label}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl p-4 shadow-sm ring-1 ${highlight ? "bg-violet-600 text-white ring-violet-600" : "bg-white ring-violet-100"}`}>
      <p className={`text-xs ${highlight ? "text-violet-100" : "text-neutral-500"}`}>{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
