"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Order, UserProfile } from "@/lib/api";
import { shortDate } from "@/lib/format";
import Magnet from "@/components/magnet";

const ITEMS = [
  { label: "หน้าแรก", href: "/home", icon: "M4 11l8-7 8 7v9H4z", tile: "bg-basil text-paper" },
  { label: "คุยกับ bot", href: "/chat", icon: "M4 5h16v11H10l-5 4v-4H4z", tile: "bg-[#2E9A6A] text-paper" },
  { label: "ออเดอร์ของฉัน", href: "/orders", icon: "M6 8h12l-1 12H7L6 8zM9 8a3 3 0 0 1 6 0", tile: "bg-saffron text-[#2B1C00]" },
  { label: "ร้านค้าของฉัน", href: "/shop/shop_ergohome", icon: "M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6", tile: "bg-[#3B5B8C] text-paper" },
  { label: "เข้าสู่ระบบ", href: "/login", icon: "M15 3h4v18h-4M10 17l5-5-5-5M15 12H3", tile: "bg-[#E9EEEA] text-ink" },
];

const ACTIVE = ["paid", "shipped"];

export default function SideMenu({ user, orders, onClose }: { user: UserProfile | null; orders: Order[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const live = orders.find((o) => ACTIVE.includes(o.status));
  const awaiting = orders.filter((o) => o.status === "awaiting_payment" || o.status === "payment_failed").length;

  return (
    <div className="fixed inset-0 z-50">
      <button aria-label="ปิดเมนู" onClick={onClose} className="absolute inset-0 bg-[rgba(4,12,9,0.55)]" />
      <nav
        aria-label="เมนูหลัก"
        className="absolute inset-y-0 left-0 flex w-[min(330px,86vw)] flex-col gap-3.5 overflow-y-auto rounded-r-[28px] bg-[#08140F] px-4 pb-5 pt-[max(1.1rem,env(safe-area-inset-top))] text-paper shadow-[18px_0_48px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Magnet size={22} tips="#E9EEEA" />
            <span className="font-display text-lg font-extrabold">PULL</span>
          </span>
          <button onClick={onClose} aria-label="ปิดเมนู" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#13241C] text-[#C9D6CF] hover:bg-[#1d3329] hover:text-paper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 px-0.5">
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-saffron text-lg font-bold text-[#2B1C00]">
            {user?.display_name.replace(/^คุณ/, "").slice(0, 1) ?? "?"}
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold">{user?.display_name ?? "ผู้ใช้เดโม่"}</div>
            <div className="text-xs text-[#9FB8AB]">สมาชิก U-Tag</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/orders" className="col-span-2 flex flex-col gap-2.5 rounded-[22px] bg-[#173A2C] p-3.5 hover:bg-[#1c4636]">
            {live ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#9FD4B8]">{live.status === "shipped" ? "กำลังจัดส่ง" : "รอร้านจัดส่ง"}</span>
                  <span className="text-[#9FB8AB]">ถึง {shortDate(live.delivery_date)}</span>
                </div>
                <div className="line-clamp-2 text-sm font-semibold leading-snug">{live.title}</div>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className={`h-[5px] rounded-full ${n <= (live.status === "shipped" ? 2 : 1) ? "bg-[#4FC08D]" : "bg-[#2C4A3D]"}`} />
                  ))}
                </div>
                {live.tracking_number && <div className="font-mono text-[11.5px] text-[#9FB8AB]">{live.tracking_number}</div>}
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-[#9FD4B8]">ออเดอร์ที่กำลังมา</span>
                <span className="text-sm text-[#CFE3D8]">ยังไม่มีของที่กำลังส่ง</span>
              </>
            )}
          </Link>

          <Link href="/orders" className="flex aspect-square flex-col justify-between rounded-[22px] bg-ground p-3.5 text-ink hover:bg-paper">
            <span className="text-xs font-bold text-ink-2">ออเดอร์</span>
            <span className="leading-tight">
              <span className="block font-display text-4xl font-extrabold tabular-nums">{orders.length}</span>
              <span className="text-xs font-semibold text-saffron-ink">{awaiting ? `รอชำระ ${awaiting}` : "ไม่มีค้างจ่าย"}</span>
            </span>
          </Link>

          <div className="flex aspect-square flex-col justify-between rounded-[22px] bg-saffron p-3.5 text-[#2B1C00]">
            <span className="text-xs font-bold">ส่งไปที่</span>
            <span className="whitespace-pre-line text-[13px] font-semibold leading-snug">
              {user ? `${user.address.district}\n${user.address.province}` : "ยังไม่มีที่อยู่"}
            </span>
          </div>

          <Link href="/chat" className="col-span-2 flex items-center gap-3 rounded-[22px] bg-[#13241C] px-3.5 py-3 hover:bg-[#1d3329]">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-basil">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5h16v11H10l-5 4v-4H4z" />
              </svg>
            </span>
            <span className="leading-tight">
              <span className="block text-[13.5px] font-semibold">คุยกับ bot</span>
              <span className="text-xs text-[#9FB8AB]">พิมพ์หรือพูดบอกสิ่งที่อยากได้</span>
            </span>
          </Link>
        </div>

        <ul className="flex flex-col rounded-[20px] bg-[#101F18] p-1">
          {ITEMS.map((m) => (
            <li key={m.href}>
              <Link href={m.href} onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-[14px] px-2.5 hover:bg-[#1a2e24]">
                <span className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] ${m.tile}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d={m.icon} />
                  </svg>
                </span>
                <span className="flex-1 text-sm font-medium">{m.label}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E7A6C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto pl-1 text-[11.5px] text-[#5E7A6C]">Pull and serve everything you want</div>
      </nav>
    </div>
  );
}
