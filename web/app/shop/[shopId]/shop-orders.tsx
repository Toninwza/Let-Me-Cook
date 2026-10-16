"use client";

import { t } from "@/lib/i18n";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ApiError, Order, listOrders, listProducts, setOrderStatus } from "@/lib/api";
import { baht, shortDate, stamp } from "@/lib/format";

type Tab = "all" | "paid" | "shipped" | "delivered" | "awaiting_payment";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "paid", label: "ต้องจัดส่ง" },
  { key: "shipped", label: "กำลังส่ง" },
  { key: "delivered", label: "ได้รับแล้ว" },
  { key: "awaiting_payment", label: "รอชำระ" },
];

const CHIP: Record<Order["status"], { label: string; cls: string }> = {
  pending_confirm: { label: "รอยืนยัน", cls: "bg-ground text-ink-2" },
  awaiting_payment: { label: "รอชำระ", cls: "bg-ground text-ink-2" },
  payment_failed: { label: "จ่ายไม่สำเร็จ", cls: "bg-danger-soft text-danger" },
  paid: { label: "จ่ายแล้ว ต้องจัดส่ง", cls: "bg-saffron-soft text-saffron-ink" },
  shipped: { label: "กำลังจัดส่ง", cls: "bg-basil-soft text-basil-dark" },
  delivered: { label: "ได้รับแล้ว", cls: "bg-[#E8ECF4] text-[#24365A]" },
  cancelled: { label: "ยกเลิก", cls: "bg-ground text-faint" },
};

export default function ShopOrders() {
  const { shopId } = useParams<{ shopId: string }>();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [shopName, setShopName] = useState<string>(shopId);
  const [tab, setTab] = useState<Tab>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOrders(await listOrders({ shopId }));
    } catch {
      setError(t("โหลดออเดอร์ไม่สำเร็จ"));
    }
  }, [shopId]);

  useEffect(() => {
    listProducts(shopId).then((p) => p[0] && setShopName(p[0].shop.name), () => {});
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [shopId, refresh]);

  async function move(o: Order, status: "shipped" | "delivered") {
    setBusyId(o.order_id);
    setError(null);
    try {
      await setOrderStatus(o.order_id, status);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) setError(e instanceof ApiError ? e.message : t("ทำรายการไม่สำเร็จ"));
    }
    setBusyId(null);
    refresh();
  }

  const all = orders ?? [];
  const shown = all.filter((o) => (tab === "all" ? o.status !== "pending_confirm" : o.status === tab));
  const count = (t: Tab) => (t === "all" ? all.filter((o) => o.status !== "pending_confirm").length : all.filter((o) => o.status === t).length);

  return (
    <div className="min-h-dvh bg-ground">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3.5 sm:px-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-bold text-paper">{shopName.slice(0, 2).toUpperCase()}</span>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{shopName}</h1>
            <p className="text-[12.5px] text-muted">{t("หน้าร้าน · ออเดอร์จาก PULL bot")}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-ground px-3 py-1 text-[12.5px] text-ink-2">
            <span className="h-2 w-2 rounded-full bg-basil" />
            {t("อัปเดตอัตโนมัติทุก 3 วินาที")}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
        <div role="tablist" aria-label={t("กรองตามสถานะ")} className="flex flex-wrap gap-2">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={`h-10 rounded-full border px-4 text-[13.5px] font-medium ${tab === tb.key ? "border-ink bg-ink text-paper" : "border-line-strong bg-paper hover:border-ink"}`}
            >
              {t(tb.label)} <span className="tabular-nums opacity-75">{count(tb.key)}</span>
            </button>
          ))}
        </div>

        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-xs text-muted">
                {[t("เวลา"), t("ออเดอร์"), t("สินค้า"), t("ยอด"), t("ส่งไปที่"), t("สถานะ"), t("ทำต่อ")].map((h, i) => (
                  <th key={h} className={`border-b border-line px-4 py-3 font-semibold ${i === 3 || i === 6 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.order_id} className={`hover:bg-ground/60 ${o.status === "paid" ? "bg-[#FFFBF2]" : ""}`}>
                  <td className="whitespace-nowrap border-b border-line/70 px-4 py-3.5 tabular-nums">{stamp(o.created_at)}</td>
                  <td className="whitespace-nowrap border-b border-line/70 px-4 py-3.5 font-mono text-[12.5px]">{o.order_id}</td>
                  <td className="border-b border-line/70 px-4 py-3.5">
                    <div className="font-medium">{o.title}</div>
                    <div className="text-xs text-muted">
                      x{o.quantity} · {t("ส่งถึง {date}", { date: shortDate(o.delivery_date) })}
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-line/70 px-4 py-3.5 text-right font-semibold tabular-nums">{baht(o.total)}</td>
                  <td className="border-b border-line/70 px-4 py-3.5 text-[13px] text-ink-2">
                    {o.address.district} {o.address.province}
                  </td>
                  <td className="border-b border-line/70 px-4 py-3.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CHIP[o.status].cls}`}>{t(CHIP[o.status].label)}</span>
                    {o.tracking_number && <div className="mt-1 font-mono text-[11.5px] text-ink-2">{o.tracking_number}</div>}
                  </td>
                  <td className="whitespace-nowrap border-b border-line/70 px-4 py-3.5 text-right">
                    {o.status === "paid" && (
                      <button
                        disabled={busyId === o.order_id}
                        onClick={() => move(o, "shipped")}
                        className="h-10 rounded-xl bg-basil px-4 font-semibold text-paper hover:bg-basil-dark disabled:opacity-50"
                      >
                        {t("จัดส่ง")}
                      </button>
                    )}
                    {o.status === "shipped" && (
                      <button
                        disabled={busyId === o.order_id}
                        onClick={() => move(o, "delivered")}
                        className="h-10 rounded-xl border border-basil px-4 font-semibold text-basil hover:bg-basil-soft disabled:opacity-50"
                      >
                        {t("ส่งถึงแล้ว")}
                      </button>
                    )}
                    {o.status === "awaiting_payment" && <span className="text-[12.5px] text-faint">{t("รอลูกค้าจ่าย")}</span>}
                    {o.status === "delivered" && <span className="text-[12.5px] text-faint">{t("เสร็จแล้ว")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders !== null && shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted">{t("ไม่มีออเดอร์ในสถานะนี้")}</p>}
          {orders === null && <p className="px-4 py-8 text-center text-sm text-muted">{t("กำลังโหลด")}</p>}
        </div>
        <p className="text-[12.5px] text-muted">{t("กด \"จัดส่ง\" แล้วระบบสร้างเลขพัสดุให้ ลูกค้าเห็นในแชทและหน้าออเดอร์ทันที")}</p>
      </main>
    </div>
  );
}
