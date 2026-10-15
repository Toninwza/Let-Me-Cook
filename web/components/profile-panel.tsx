"use client";

import Link from "next/link";
import { useState } from "react";
import { Order, UserProfile, listOrders } from "@/lib/api";
import { baht } from "@/lib/format";
import { usePoll } from "@/lib/hooks";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/status";

/** Desktop sidebar: the U-Tag the bot uses, and this user's orders (live). */
export function ProfilePanel({ user }: { user: UserProfile | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  usePoll(
    async () => {
      if (user) setOrders((await listOrders({ user_id: user.user_id })).filter((o) => o.status !== "pending_confirm"));
    },
    5000,
    Boolean(user),
    true,
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white shadow-md shadow-violet-200">
          LM
        </div>
        <div>
          <p className="font-semibold">Let-Me-Cook</p>
          <p className="text-xs text-neutral-500">AI ผู้ช่วยช้อปปิ้ง</p>
        </div>
      </div>

      {user && (
        <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-violet-100">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-semibold text-white">U-Tag</span>
            <span className="text-xs text-neutral-500">bot ใช้ข้อมูลนี้ตอนเลือกของ</span>
          </div>
          <p className="text-lg font-semibold">{user.display_name}</p>
          <dl className="space-y-2 text-xs">
            <Item label="ส่วนลดตอนจ่าย" value={`${user.discount_percent}%`} />
            <Item
              label="ที่อยู่จัดส่ง"
              value={`${user.address.line} ${user.address.district} ${user.address.province} ${user.address.postcode}`}
            />
            {user.interests.length > 0 && (
              <div>
                <dt className="mb-1 text-neutral-500">ความสนใจ</dt>
                <dd className="flex flex-wrap gap-1">
                  {user.interests.map((i) => (
                    <span key={i} className="rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                      {i}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {user.purchase_history.length > 0 && (
              <Item label="เคยซื้อ" value={user.purchase_history.slice(0, 3).map((p) => p.title).join(", ")} />
            )}
          </dl>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">คำสั่งซื้อของฉัน</h2>
          <Link href="/shop" className="text-xs text-violet-700 hover:underline">
            หน้าร้าน →
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-4 text-center text-xs text-neutral-400 ring-1 ring-violet-100">
            ยังไม่มีคำสั่งซื้อ
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.slice(0, 6).map((o) => (
              <li key={o.order_id} className="rounded-2xl bg-white p-3 text-xs shadow-sm ring-1 ring-violet-100">
                <p className="line-clamp-1 font-medium">{o.title}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                  <span className="font-semibold">{baht.format(o.total)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-800">{value}</dd>
    </div>
  );
}
