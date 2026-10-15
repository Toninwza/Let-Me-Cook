"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductHit, listProducts } from "@/lib/api";
import { baht } from "@/lib/format";
import { pickVaried } from "@/lib/pick";
import { supabase } from "@/lib/supabase";
import Magnet from "@/components/magnet";
import ProductThumb from "@/components/product-thumb";

const DECOR = [
  { cls: "left-[6%] top-10 w-28", rot: -8 },
  { cls: "right-[6%] top-7 w-[104px]", rot: 7 },
  { cls: "right-[14%] top-40 w-24", rot: -5 },
];

type Step = "email" | "code";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [decor, setDecor] = useState<ProductHit[]>([]);

  useEffect(() => {
    listProducts()
      .then((all) => setDecor(pickVaried(all, DECOR.length)))
      .catch(() => {});
    supabase?.auth.getSession().then(({ data }) => setSignedInAs(data.session?.user.email ?? null));
  }, []);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(`ส่งรหัสไม่สำเร็จ: ${error.message}`);
    else setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setError("รหัสไม่ถูกต้องหรือหมดอายุ ลองใหม่อีกครั้ง");
    else router.push("/chat");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSignedInAs(null);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-[#FAFAF7]">
      <div aria-hidden="true" className="relative h-[250px] shrink-0">
        <div className="absolute left-1/2 top-[150px] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-dashed border-[#DCE7E0]" />
        {decor.map((p, i) => (
          <div
            key={p.product_id}
            className={`absolute overflow-hidden rounded-[14px] bg-paper shadow-[0_12px_30px_rgba(23,33,29,0.10)] ${DECOR[i].cls}`}
            style={{ transform: `rotate(${DECOR[i].rot}deg)` }}
          >
            <ProductThumb imageUrl={p.image_url} category={p.category} className="h-16 w-full text-xs" />
            <div className="px-2 py-1.5 text-[10.5px] font-semibold tabular-nums">{baht(p.price)}</div>
          </div>
        ))}
        <div className="absolute left-1/2 top-[106px] -translate-x-1/2">
          <Magnet size={96} />
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-6 pt-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.01em]">เข้าสู่ระบบ PULL</h1>
          <p className="mt-1 text-ink-2">เข้าสู่ระบบด้วยอีเมล รับรหัส 6 หลัก ไม่ต้องตั้งรหัสผ่าน</p>
        </div>

        {!supabase && (
          <p className="rounded-xl bg-saffron-soft px-3.5 py-2.5 text-[13px] text-saffron-ink">
            ยังไม่ได้ตั้งค่า Supabase ในเว็บ (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) ตอนนี้ใช้แบบผู้ใช้เดโม่ได้
          </p>
        )}

        {signedInAs ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-paper p-4">
            <p className="text-sm">
              เข้าสู่ระบบแล้วด้วย <span className="font-semibold">{signedInAs}</span>
            </p>
            <Link href="/chat" className="flex h-[50px] items-center justify-center rounded-[14px] bg-basil font-semibold text-paper hover:bg-basil-dark">
              ไปที่แชท
            </Link>
            <button onClick={signOut} className="h-11 text-sm text-muted underline">
              ออกจากระบบ
            </button>
          </div>
        ) : step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <label htmlFor="login-email" className="text-[13px] font-semibold">
              อีเมล
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!supabase}
              placeholder="you@example.com"
              className="-mt-1.5 h-[50px] rounded-[14px] border-[1.5px] border-line-strong bg-paper px-4 text-[15px] outline-none focus:border-basil disabled:opacity-50"
            />
            <button type="submit" disabled={!supabase || busy} className="h-[50px] rounded-[14px] bg-basil text-[15px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
              {busy ? "กำลังส่งรหัส" : "ส่งรหัส 6 หลักไปที่อีเมล"}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <p className="text-[13.5px] text-ink-2">
              ส่งรหัสไปที่ <span className="font-semibold text-ink">{email}</span> แล้ว
            </p>
            <label htmlFor="login-code" className="text-[13px] font-semibold">
              รหัส 6 หลัก
            </label>
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="-mt-1.5 h-14 rounded-[14px] border-[1.5px] border-line-strong bg-paper text-center text-2xl font-semibold tracking-[0.5em] outline-none focus:border-basil"
            />
            <button type="submit" disabled={busy || code.length !== 6} className="h-[50px] rounded-[14px] bg-basil text-[15px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
              {busy ? "กำลังตรวจรหัส" : "ยืนยันและเข้าสู่ระบบ"}
            </button>
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep("email")} className="min-h-11 text-[13.5px] font-semibold text-basil">
                เปลี่ยนอีเมล
              </button>
              <button type="button" onClick={sendCode} disabled={busy} className="min-h-11 text-[13.5px] text-muted">
                ส่งรหัสอีกครั้ง
              </button>
            </div>
          </form>
        )}

        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex-1" />
        <Link href="/chat" className="flex min-h-11 items-center justify-center text-[13.5px] text-ink-2 underline hover:text-basil">
          ลองใช้แบบผู้ใช้เดโม่
        </Link>
        <p className="text-center text-[11.5px] text-faint">การเข้าสู่ระบบดูแลโดย Supabase Auth</p>
      </main>
    </div>
  );
}
