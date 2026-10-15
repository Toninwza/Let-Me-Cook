import type { ProductOption } from "@/lib/api";
import { baht, categoryIcon, formatDate } from "@/lib/format";

const TILE = [
  "from-violet-500 to-fuchsia-500",
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-indigo-500",
];

export function DecisionCard({
  item,
  rank,
  utagPercent,
  disabled,
  onBuy,
}: {
  item: ProductOption;
  rank: number;
  utagPercent: number;
  disabled: boolean;
  onBuy: () => void;
}) {
  const withUtag = Math.round(item.price * (100 - utagPercent)) / 100;
  return (
    <article
      className="animate-rise flex w-[78%] shrink-0 snap-start md:w-auto flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-violet-100"
      style={{ animationDelay: `${rank * 80}ms` }}
    >
      <div className={`relative grid h-28 place-items-center bg-linear-to-br ${TILE[(rank - 1) % TILE.length]}`}>
        <span className="text-5xl drop-shadow" aria-hidden>
          {categoryIcon(item.category)}
        </span>
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          {rank === 1 ? "#1 แนะนำ" : `#${rank}`}
        </span>
        {item.discount_percent > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            -{item.discount_percent}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h3>
        <p className="text-xs text-neutral-500">
          <span className="text-amber-500">★</span> {item.rating.toFixed(1)} ({item.review_count.toLocaleString("th-TH")})
          · {item.shop.name}
        </p>
        <p className="text-xs text-neutral-600">🚚 ส่งถึง {formatDate(item.delivery_date)}</p>

        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-neutral-900">{baht.format(item.price)}</span>
          {item.discount_percent > 0 && (
            <s className="text-xs text-neutral-400">{baht.format(item.original_price)}</s>
          )}
        </div>
        {utagPercent > 0 && (
          <p className="w-fit rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-violet-200">
            ลดจาก U-Tag {utagPercent}% เหลือ {baht.format(withUtag)}
          </p>
        )}

        <p className="rounded-2xl bg-violet-50/70 p-2.5 text-xs leading-relaxed text-neutral-700">
          <span aria-hidden>✨ </span>
          {item.reason}
        </p>

        <button
          onClick={onBuy}
          disabled={disabled || item.stock <= 0}
          className="mt-auto rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
        >
          สั่งซื้อด้วย U-Pay
        </button>
      </div>
    </article>
  );
}
