"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductHit, listProducts } from "@/lib/api";
import { baht } from "@/lib/format";
import { pickVaried } from "@/lib/pick";
import { MenuButton } from "@/components/app-shell";
import Magnet from "@/components/magnet";
import ProductThumb from "@/components/product-thumb";

const EXAMPLES = ["หาเก้าอี้ทำงาน งบ 3,000", "หูฟังประชุม ส่งพรุ่งนี้", "ของขวัญวันเกิดแม่ งบ 1,500"];

// Spots on the magnetic field, as % of the field width and px from its top.
const SPOTS = [
  { left: "6%", top: 110, rot: -7 },
  { left: "57%", top: 60, rot: 5 },
  { left: "71%", top: 320, rot: -3 },
  { left: "62%", top: 600, rot: 4 },
  { left: "12%", top: 610, rot: -4 },
  { left: "0%", top: 370, rot: 3 },
];

export default function Landing() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [products, setProducts] = useState<ProductHit[]>([]);

  useEffect(() => {
    listProducts()
      .then((all) => setProducts(pickVaried(all, SPOTS.length)))
      .catch(() => {});
  }, []);

  function start(q: string) {
    const clean = q.trim();
    router.push(clean ? `/chat?q=${encodeURIComponent(clean)}` : "/chat");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    start(text);
  }

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto bg-[#FAFAF7]">
      <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-3 px-2 py-3 sm:px-6 md:hidden">
        <div className="flex items-center gap-1 md:hidden">
          <MenuButton className="text-ink hover:bg-ground" />
          <Link href="/" className="flex items-center gap-2">
            <Magnet size={22} />
            <span className="font-display text-lg font-extrabold">PULL</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-wrap items-stretch">
        <main className="flex min-w-0 flex-[1_1_520px] flex-col justify-center gap-5 px-5 pb-14 pt-4 sm:px-8 md:pt-6 xl:pl-12">
          <span className="flex w-fit items-center gap-2 rounded-full bg-basil-soft px-3 py-1 text-[13px] font-semibold text-basil-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-basil" />
            AI shopping agent ในแชท
          </span>
          <h1 aria-label="Pull and serve everything you want" className="font-display text-[36px] font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[44px] 2xl:text-[58px]">
            <span aria-hidden="true">Pull and serve</span>
            <br />
            <span aria-hidden="true" className="inline-flex items-center gap-3 sm:gap-3.5">
              everything
              <span className="mt-1.5 inline-flex">
                <Magnet size={40} />
              </span>
              want
            </span>
          </h1>
          <p className="max-w-[500px] text-[17px] text-ink-2">บอกครั้งเดียว bot ดึงของจากร้านบนแพลตฟอร์มมาให้ คัดเหลือ 3 ตัว แล้วจ่ายจบในแชท</p>

          <form
            onSubmit={onSubmit}
            className="flex max-w-[560px] flex-col gap-2 rounded-[26px] border-[1.5px] border-[#DDE2DE] bg-paper py-4 pl-5 pr-3.5 shadow-[0_18px_50px_rgba(23,33,29,0.08)] focus-within:border-basil"
          >
            <label htmlFor="landing-prompt" className="text-[12.5px] font-semibold text-muted">
              บอก bot ว่าอยากได้อะไร
            </label>
            <textarea
              id="landing-prompt"
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  start(text);
                }
              }}
              maxLength={2000}
              placeholder="เช่น หาเก้าอี้ทำงานหลังไม่ปวด งบ 3,000 ส่งก่อนวันอาทิตย์"
              className="resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-faint">ส่งแล้วจะเปิดแชทใหม่ให้ทันที</span>
              <button type="submit" className="flex h-[46px] items-center gap-2 rounded-full bg-basil pl-5 pr-4 font-semibold text-paper hover:bg-basil-dark">
                เริ่มแชท
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </form>

          <div className="flex max-w-[560px] flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => start(e)}
                className="min-h-10 rounded-full border border-[#DDE2DE] bg-paper px-3.5 text-[13.5px] text-ink-2 hover:border-basil hover:text-basil"
              >
                {e}
              </button>
            ))}
          </div>
        </main>

        <section aria-label="สินค้าจากร้านบนแพลตฟอร์ม" className="relative hidden min-h-[780px] flex-[1_1_560px] xl:block">
          <svg width="760" height="760" viewBox="0 0 760 760" fill="none" aria-hidden="true" className="absolute left-1/2 top-[440px] -translate-x-1/2 -translate-y-1/2">
            <circle cx="380" cy="380" r="150" stroke="#DCE7E0" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
            <circle cx="380" cy="380" r="240" stroke="#E3ECE6" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
            <circle cx="380" cy="380" r="330" stroke="#EAF0EC" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
            <circle cx="380" cy="380" r="96" fill="#F2F6F3" />
          </svg>
          <div className="absolute left-1/2 top-[440px] -translate-x-1/2 -translate-y-[42%]">
            <Magnet size={150} label="โลโก้แม่เหล็ก PULL" />
          </div>

          {products.map((p, i) => (
            <Link
              key={p.product_id}
              href={`/chat?q=${encodeURIComponent(p.title)}`}
              aria-label={`ถาม bot เรื่อง ${p.title} ${baht(p.price)}`}
              className="absolute w-[168px] rounded-[18px] bg-paper shadow-[0_16px_40px_rgba(23,33,29,0.10)] transition-transform hover:z-10 hover:scale-105"
              style={{ left: SPOTS[i].left, top: SPOTS[i].top, transform: `rotate(${SPOTS[i].rot}deg)` }}
            >
              <div className="relative">
                <ProductThumb imageUrl={p.image_url} category={p.category} className="h-[104px] w-full rounded-t-[18px]" />
                <span className="absolute -bottom-3 left-2.5 rounded-full bg-ink px-2.5 py-0.5 text-[12.5px] font-bold text-paper tabular-nums">{baht(p.price)}</span>
              </div>
              <div className="flex items-center gap-2 px-3 pb-3 pt-5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-[10.5px] font-bold text-paper">
                  {p.shop.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-[12.5px] font-semibold">{p.title}</div>
                  <div className="text-[11px] text-muted">{p.shop.name}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
      </div>
    </div>
  );
}
