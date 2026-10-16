"use client";

import { useEffect } from "react";
import { listProducts } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { baht, shortDate } from "@/lib/format";
import ProductThumb from "./product-thumb";
import type { ProductHit } from "@/lib/api";

export default function CartSheet({ onClose, onBuy }: { onClose: () => void; onBuy: (product: ProductHit, quantity: number) => void }) {
  const { items, total, count, setQuantity, remove, sync } = useCart();

  // Prices and stock may have changed since the item was added: refresh from the catalog.
  useEffect(() => {
    let live = true;
    listProducts()
      .then((all) => live && sync(all))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sync]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <button aria-label="ปิดตะกร้า" onClick={onClose} className="absolute inset-0 bg-ink/45" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="ตะกร้าสินค้า"
        className="relative flex max-h-[85dvh] w-full flex-col rounded-t-[24px] bg-paper shadow-xl md:max-h-none md:w-[400px] md:rounded-none"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="text-base font-bold">ตะกร้า {count > 0 && <span className="text-muted">({count} ชิ้น)</span>}</h2>
          <button onClick={onClose} aria-label="ปิดตะกร้า" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-ground hover:text-ink">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">ยังไม่มีสินค้าในตะกร้า กด &quot;ใส่ตะกร้า&quot; ที่สินค้าที่ bot แนะนำได้เลย</p>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-line overflow-y-auto px-4">
              {items.map(({ product: p, quantity }) => {
                const out = p.stock <= 0;
                return (
                  <li key={p.product_id} className="flex gap-3 py-3">
                    <ProductThumb imageUrl={p.image_url} category={p.category} className="h-16 w-16 shrink-0 rounded-xl" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-start gap-2">
                        <h3 className="line-clamp-2 flex-1 text-[13.5px] font-semibold leading-snug">{p.title}</h3>
                        <button onClick={() => remove(p.product_id)} aria-label={`เอา ${p.title} ออกจากตะกร้า`} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-ground hover:text-danger">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-xs text-muted">
                        {p.shop.name} · ส่งถึง {shortDate(p.delivery_date)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold tabular-nums">{baht(Math.round(p.price * quantity * 100) / 100)}</span>
                        {out ? (
                          <span className="text-xs font-semibold text-danger">สินค้าหมด</span>
                        ) : (
                          <div className="flex items-center rounded-lg border border-line-strong">
                            <button aria-label="ลดจำนวน" disabled={quantity <= 1} onClick={() => setQuantity(p.product_id, quantity - 1)} className="h-8 w-8 hover:bg-ground disabled:opacity-40">
                              −
                            </button>
                            <span className="w-7 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                            <button aria-label="เพิ่มจำนวน" disabled={quantity >= Math.min(p.stock, 20)} onClick={() => setQuantity(p.product_id, quantity + 1)} className="h-8 w-8 hover:bg-ground disabled:opacity-40">
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        disabled={out}
                        onClick={() => onBuy(p, quantity)}
                        className="h-9 rounded-lg bg-basil text-[13px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-40"
                      >
                        ซื้อรายการนี้
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <footer className="border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">รวมในตะกร้า</span>
                <span className="text-lg font-bold tabular-nums">{baht(total)}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted">ชำระทีละรายการ ส่วนลด U-Tag คิดตอนชำระ</p>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
