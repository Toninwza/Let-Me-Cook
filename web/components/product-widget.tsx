"use client";

import { t } from "@/lib/i18n";

import { useState } from "react";
import type { ProductOption } from "@/lib/api";
import { baht, shortDate } from "@/lib/format";
import ProductThumb from "./product-thumb";

type View = "cards" | "compare";

export default function ProductWidget({
  items,
  disabled,
  onBuy,
  onAsk,
}: {
  items: ProductOption[];
  disabled: boolean;
  onBuy: (item: ProductOption) => void;
  onAsk: (text: string) => void;
}) {
  const [view, setView] = useState<View>("cards");

  const followUps = [t("ถูกกว่านี้"), t("ส่งเร็วกว่านี้"), ...(items.length > 1 ? [t("เทียบตัวที่ 1 กับ 2 ให้หน่อย")] : [])];

  return (
    <section aria-label={t("สินค้าที่ bot แนะนำ")} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("bot แนะนำ {n} ตัว", { n: items.length })}</h3>
        {items.length > 1 && (
          <div role="tablist" aria-label={t("มุมมอง")} className="flex rounded-full bg-line/60 p-0.5 text-xs font-semibold">
            {(["cards", "compare"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`h-8 rounded-full px-3 ${view === v ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {v === "cards" ? t("การ์ด") : t("เทียบ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "cards" ? (
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {items.map((item, i) => (
            <Card key={item.product_id} item={item} rank={i + 1} disabled={disabled} onBuy={onBuy} onAsk={onAsk} />
          ))}
        </div>
      ) : (
        <Compare items={items} disabled={disabled} onBuy={onBuy} />
      )}

      <div className="flex flex-wrap gap-2">
        {followUps.map((t) => (
          <button
            key={t}
            disabled={disabled}
            onClick={() => onAsk(t)}
            className="h-9 rounded-full border border-line-strong bg-paper px-3.5 text-[13px] text-ink-2 hover:border-basil hover:text-basil disabled:opacity-40"
          >
            {t}
          </button>
        ))}
      </div>
    </section>
  );
}

function Card({
  item,
  rank,
  disabled,
  onBuy,
  onAsk,
}: {
  item: ProductOption;
  rank: number;
  disabled: boolean;
  onBuy: (item: ProductOption) => void;
  onAsk: (text: string) => void;
}) {
  return (
    <article className="flex w-[264px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-paper hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_28px_rgba(23,33,29,0.08)] md:w-auto">
      <div className="relative">
        <ProductThumb imageUrl={item.image_url} category={item.category} className="h-32 w-full" />
        {rank === 1 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-paper">
            {t("เหมาะสุด")}
          </span>
        )}
        {item.discount_percent > 0 && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-saffron px-2 py-0.5 text-[11px] font-bold text-[#2B1C00]">
            -{item.discount_percent}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h4 className="line-clamp-2 text-[14px] font-semibold leading-snug">{item.title}</h4>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-basil">
            <TruckIcon />
            {shortDate(item.delivery_date)}
          </span>
          <span className="text-line-strong">|</span>
          <span className="inline-flex items-center gap-0.5">
            <StarIcon />
            {item.rating.toFixed(1)} <span className="text-muted">({item.review_count})</span>
          </span>
          <span className="text-line-strong">|</span>
          <span className="text-muted">{item.shop.name}</span>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-lg font-bold">{baht(item.price)}</span>
          {item.discount_percent > 0 && <s className="text-xs text-faint">{baht(item.original_price)}</s>}
        </div>
        <p className="rounded-xl bg-basil-soft/70 px-2.5 py-2 text-[12.5px] leading-relaxed text-[#17402F]">
          <span className="font-semibold">{t("ทำไม bot เลือก:")}</span> {item.reason}
        </p>
        <div className="mt-auto flex gap-2 pt-1">
          <button
            disabled={disabled}
            onClick={() => onAsk(t("เล่ารายละเอียด {title} เพิ่มหน่อย", { title: item.title }))}
            aria-label={t("ถาม bot เรื่อง {title}", { title: item.title })}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong text-basil hover:border-basil hover:bg-basil-soft disabled:opacity-40"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v11H10l-5 4v-4H4z" />
            </svg>
          </button>
          <button
            onClick={() => onBuy(item)}
            disabled={item.stock <= 0}
            className="h-11 flex-1 rounded-xl bg-basil text-[15px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-40"
          >
            {item.stock > 0 ? t("ซื้อสินค้า") : t("สินค้าหมด")}
          </button>
        </div>
      </div>
    </article>
  );
}

function Compare({ items, disabled, onBuy }: { items: ProductOption[]; disabled: boolean; onBuy: (item: ProductOption) => void }) {
  const minPrice = Math.min(...items.map((i) => i.price));
  const maxRating = Math.max(...items.map((i) => i.rating));
  const earliest = items.map((i) => i.delivery_date).sort()[0];

  const rows: { label: string; cell: (i: ProductOption) => React.ReactNode; best?: (i: ProductOption) => boolean }[] = [
    { label: t("ราคา"), cell: (i) => baht(i.price), best: (i) => i.price === minPrice },
    { label: t("ส่วนลด"), cell: (i) => (i.discount_percent ? `-${i.discount_percent}%` : t("ไม่มี")) },
    { label: t("รีวิว"), cell: (i) => `${i.rating.toFixed(1)} (${i.review_count})`, best: (i) => i.rating === maxRating },
    { label: t("ส่งถึง"), cell: (i) => shortDate(i.delivery_date), best: (i) => i.delivery_date === earliest },
    { label: t("ร้าน"), cell: (i) => i.shop.name },
    { label: t("เหลือ"), cell: (i) => t("{n} ชิ้น", { n: i.stock }) },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="w-full min-w-[340px] border-collapse text-[13px] tabular-nums">
        <thead>
          <tr>
            <th className="w-16 p-2.5" />
            {items.map((i, n) => (
              <th key={i.product_id} className="p-2.5 text-left align-top font-semibold">
                <span className="mb-1 block text-[11px] text-muted">#{n + 1}</span>
                <span className="line-clamp-2 leading-snug">{i.title}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line">
              <th scope="row" className="p-2.5 text-left text-xs font-medium text-muted">
                {row.label}
              </th>
              {items.map((i) => {
                const best = row.best?.(i) && items.length > 1;
                return (
                  <td key={i.product_id} className={`p-2.5 ${best ? "font-semibold text-basil-dark" : ""}`}>
                    {row.cell(i)}
                    {best && <span className="mt-0.5 block w-fit whitespace-nowrap rounded bg-basil-soft px-1 text-[10px] font-semibold">{t("ดีสุด")}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="border-t border-line">
            <td />
            {items.map((i) => (
              <td key={i.product_id} className="p-2.5">
                <button
                  onClick={() => onBuy(i)}
                  disabled={disabled || i.stock <= 0}
                  className="h-9 w-full rounded-lg bg-basil text-[13px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-40"
                >
                  {t("ซื้อ")}
                </button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TruckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#C98A00" aria-hidden="true">
      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" />
    </svg>
  );
}
