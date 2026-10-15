"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEMO_USER_ID, ProductHit, UserProfile, getUser, listProducts } from "@/lib/api";
import { baht } from "@/lib/format";
import { pickVaried } from "@/lib/pick";
import Magnet from "@/components/magnet";
import { MenuButton } from "@/components/app-shell";

const STARTERS = ["หาเก้าอี้ทำงาน งบ 3,000 ส่งภายในวันอาทิตย์", "หูฟังประชุม ส่งพรุ่งนี้"];

// Where the pulled products float above the magnet, and the field lines that reach it.
const CHIPS = [
  { cls: "left-4 top-10 -rotate-[5deg]" },
  { cls: "left-1/2 top-1.5 -translate-x-1/2" },
  { cls: "right-4 top-24 rotate-[6deg]" },
];

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [chips, setChips] = useState<ProductHit[]>([]);

  useEffect(() => {
    getUser(DEMO_USER_ID).then(setUser, () => {});
    listProducts().then((all) => setChips(pickVaried(all, CHIPS.length)), () => {});
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col overflow-hidden text-paper md:max-w-xl">
      <header className="flex items-center gap-2.5 px-3 pt-4">
        <MenuButton className="border border-[#2E6B53] hover:bg-[#13241C]" />
        <div className="min-w-0 flex-1 text-[13px] text-[#A9C9B8]">{user ? `สวัสดี ${user.display_name}` : "สวัสดี"}</div>
        <Link href="/orders" aria-label="ออเดอร์ของฉัน" className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2E6B53] hover:bg-[#13241C]">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8h12l-1 12H7L6 8z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
          </svg>
        </Link>
      </header>

      <section aria-label="PULL ดึงของที่ใช่มาให้คุณ" className="relative h-[300px] shrink-0">
        <svg viewBox="0 0 390 200" fill="none" aria-hidden="true" className="absolute inset-x-0 top-0 w-full">
          <path d="M81 84 C 100 140, 170 150, 192 184" stroke="#6FB592" strokeWidth="1.6" strokeDasharray="3 6" strokeLinecap="round" />
          <path d="M195 50 L195 180" stroke="#6FB592" strokeWidth="1.6" strokeDasharray="3 6" strokeLinecap="round" />
          <path d="M309 140 C 290 166, 230 160, 198 184" stroke="#6FB592" strokeWidth="1.6" strokeDasharray="3 6" strokeLinecap="round" />
        </svg>
        {chips.map((p, i) => (
          <Link
            key={p.product_id}
            href={`/chat?q=${encodeURIComponent(p.title)}`}
            className={`absolute flex w-[132px] flex-col rounded-xl bg-paper px-2.5 py-2 text-ink shadow-lg hover:shadow-xl hover:ring-2 hover:ring-saffron ${CHIPS[i].cls}`}
          >
            <span className="truncate text-xs font-semibold">{p.title}</span>
            <span className="text-[11px] text-muted tabular-nums">{baht(p.price)}</span>
          </Link>
        ))}
        <div className="absolute left-1/2 top-[170px] -translate-x-1/2">
          <Magnet size={118} tips="#E9EEEA" label="โลโก้แม่เหล็ก PULL" />
        </div>
      </section>

      <div className="flex flex-col items-center gap-2.5 px-5 text-center">
        <h1 aria-label="PULL" className="flex items-end gap-1 font-display text-6xl font-extrabold leading-[0.9]">
          <span aria-hidden="true">P</span>
          <span aria-hidden="true" className="mb-px">
            <Magnet size={52} tips="#E9EEEA" />
          </span>
          <span aria-hidden="true">LL</span>
        </h1>
        <p className="font-display text-[17px] font-semibold leading-snug">
          Pull and serve
          <br />
          <span className="text-saffron">Everything you want</span>
        </p>
        <p className="max-w-[300px] text-[13.5px] text-[#CFE3D8]">บอกครั้งเดียว bot ดึงของที่ใช่จากร้านบนแพลตฟอร์ม คัดให้ 3 ตัว แล้วจ่ายจบในแชท</p>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 px-4 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-6">
        <div className="pl-1 text-xs text-[#A9C9B8]">ลองเริ่มจาก</div>
        {STARTERS.map((s) => (
          <Link key={s} href={`/chat?q=${encodeURIComponent(s)}`} className="flex min-h-11 items-center rounded-xl border border-[#2E6B53] px-3.5 text-[13.5px] hover:border-[#6FB592] hover:bg-[#13241C]">
            {s}
          </Link>
        ))}
        <Link href="/chat" className="mt-1 flex h-[52px] items-center justify-center rounded-2xl bg-paper text-base font-bold text-forest hover:bg-[#E9EEEA]">
          เริ่มคุยกับ bot
        </Link>
        <Link href="/shop/shop_ergohome" className="flex min-h-11 items-center justify-center text-[13px] text-[#A9C9B8] underline hover:text-paper">
          เป็นร้านค้า? ดูออเดอร์ร้าน
        </Link>
      </div>

    </div>
  );
}
