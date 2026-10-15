"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductHit, listProducts } from "@/lib/api";
import { baht } from "@/lib/format";
import { pickVaried } from "@/lib/pick";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import Magnet from "@/components/magnet";
import ProductThumb from "@/components/product-thumb";

type Mode = "in" | "up";

/** Supabase error messages are English; show the ones a user can act on in Thai. */
function thaiError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (m.includes("already registered") || m.includes("already been registered")) return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
  if (m.includes("password") && m.includes("characters")) return "รหัสผ่านสั้นเกินไป ใช้อย่างน้อย 8 ตัวอักษร";
  if (m.includes("rate limit") || m.includes("too many")) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  if (m.includes("email not confirmed")) return "ยังไม่ได้ยืนยันอีเมล เช็คกล่องจดหมายของคุณ";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "ยังไม่ได้เปิดการเข้าสู่ระบบด้วย Google";
  if (m.includes("invalid email")) return "รูปแบบอีเมลไม่ถูกต้อง";
  return `เข้าสู่ระบบไม่สำเร็จ (${message})`;
}

export default function Login() {
  const router = useRouter();
  const { configured, loading, session, name, email: signedInEmail, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [decor, setDecor] = useState<ProductHit[]>([]);

  useEffect(() => {
    listProducts()
      .then((all) => setDecor(pickVaried(all, 3)))
      .catch(() => {});
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setError(thaiError(error.message));
      else router.push("/");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: displayName.trim() || email.trim().split("@")[0] } },
    });
    setBusy(false);
    if (error) setError(thaiError(error.message));
    else if (data.session) router.push("/");
    else setNotice("สมัครแล้ว ส่งลิงก์ยืนยันไปที่อีเมลของคุณ กดลิงก์แล้วกลับมาเข้าสู่ระบบได้เลย");
  }

  async function google() {
    if (!supabase) return;
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/` } });
    if (error) setError(thaiError(error.message));
  }

  async function forgot() {
    if (!supabase) return;
    if (!email.trim()) return setError("กรอกอีเมลก่อน แล้วกดลืมรหัสผ่านอีกครั้ง");
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` });
    if (error) setError(thaiError(error.message));
    else setNotice("ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว");
  }

  const inputCls =
    "h-[50px] w-full rounded-[14px] border-[1.5px] border-line-strong bg-paper px-4 text-[15px] outline-none placeholder:text-faint focus:border-basil focus:shadow-[0_0_0_4px_rgba(30,111,80,0.12)] disabled:opacity-50 lg:h-[52px]";

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAF7] lg:flex-row">
      <section aria-hidden="true" className="relative h-[200px] shrink-0 overflow-hidden rounded-b-[32px] bg-forest text-paper lg:h-auto lg:min-h-dvh lg:w-[46%] lg:rounded-none">
        <svg viewBox="0 0 760 760" fill="none" className="absolute left-1/2 top-[110px] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 lg:top-1/2 lg:h-[760px] lg:w-[760px]">
          <circle cx="380" cy="380" r="120" stroke="#2E6B53" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
          <circle cx="380" cy="380" r="210" stroke="#235A44" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
          <circle cx="380" cy="380" r="300" stroke="#1B4A38" strokeWidth="1.5" strokeDasharray="2 8" strokeLinecap="round" />
        </svg>
        <div className="absolute left-1/2 top-[62px] -translate-x-1/2 lg:top-1/2 lg:-translate-y-1/2">
          <span className="lg:hidden">
            <Magnet size={78} tips="#E9EEEA" />
          </span>
          <span className="hidden lg:block">
            <Magnet size={150} tips="#E9EEEA" />
          </span>
        </div>
        {decor.map((p, i) => (
          <div
            key={p.product_id}
            className={`absolute overflow-hidden rounded-xl bg-paper text-ink shadow-[0_10px_26px_rgba(0,0,0,0.25)] lg:rounded-2xl lg:shadow-[0_16px_40px_rgba(0,0,0,0.25)] ${
              [
                "left-[22px] top-[34px] w-24 -rotate-[8deg] lg:left-[9%] lg:top-[23%] lg:w-[158px] lg:-rotate-[7deg]",
                "right-[22px] top-[26px] w-[90px] rotate-[7deg] lg:left-auto lg:right-[9%] lg:top-[15%] lg:w-[150px] lg:rotate-6",
                "hidden lg:block lg:right-[8%] lg:top-[61%] lg:w-[150px] lg:-rotate-[4deg]",
              ][i]
            }`}
          >
            <ProductThumb imageUrl={p.image_url} category={p.category} className="h-12 w-full text-xs lg:h-[72px] lg:text-sm" />
            <div className="px-2 py-1.5 text-[10.5px] font-semibold tabular-nums lg:px-3 lg:py-2 lg:text-[12.5px]">
              {p.shop.name} · {baht(p.price)}
            </div>
          </div>
        ))}
        <div className="absolute left-12 top-10 hidden items-center gap-2.5 lg:flex">
          <Magnet size={28} tips="#E9EEEA" />
          <span className="font-display text-[21px] font-extrabold">PULL</span>
        </div>
        <div className="absolute inset-x-12 bottom-12 hidden flex-col gap-1.5 lg:flex">
          <div className="font-display text-2xl font-semibold leading-[1.3]">
            Pull and serve
            <br />
            <span className="text-saffron">Everything you want</span>
          </div>
          <div className="text-sm text-[#A9C9B8]">บอกครั้งเดียว bot ดึงของจากร้านบนแพลตฟอร์ม คัดให้ 3 ตัว แล้วจ่ายจบในแชท</div>
        </div>
      </section>

      <main className="flex flex-1 items-start justify-center px-5 pb-6 pt-5 lg:items-center lg:p-8">
        <div className="flex w-full max-w-[392px] flex-col gap-4 lg:gap-5">
          <div>
            <h1 className="font-display text-[22px] font-semibold tracking-[-0.01em] lg:text-[28px]">
              {session ? "เข้าสู่ระบบอยู่แล้ว" : mode === "in" ? "ยินดีต้อนรับกลับมา" : "สร้างบัญชี PULL"}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-2 lg:text-sm">
              {session ? "bot จะจำที่อยู่และประวัติการซื้อของคุณ" : mode === "in" ? "เข้าสู่ระบบเพื่อให้ bot จำที่อยู่และประวัติการซื้อของคุณ" : "ใช้เวลาไม่ถึงนาที"}
            </p>
          </div>

          {!configured && (
            <p className="rounded-xl bg-saffron-soft px-3.5 py-2.5 text-[13px] text-saffron-ink">
              ยังไม่ได้ตั้งค่า Supabase ในเว็บ (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) ตอนนี้ใช้แบบผู้ใช้เดโมได้
            </p>
          )}

          {session ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-paper p-4 shadow-[0_8px_30px_rgba(23,33,29,0.06)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron text-lg font-bold text-[#2B1C00]">{(name ?? "?").slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-semibold">{name}</div>
                  <div className="truncate text-xs text-muted">{signedInEmail}</div>
                </div>
              </div>
              <Link href="/" className="flex h-[50px] items-center justify-center rounded-[14px] bg-basil font-semibold text-paper hover:bg-basil-dark">
                ไปหน้าแรก
              </Link>
              <button onClick={signOut} className="h-11 rounded-xl text-sm text-muted underline hover:text-ink">
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="เลือกโหมด" className="grid grid-cols-2 gap-1 rounded-[14px] bg-[#ECEFEA] p-1">
                {(["in", "up"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={`h-10 rounded-[11px] text-sm font-semibold lg:h-[42px] ${mode === m ? "bg-paper text-ink shadow-[0_1px_3px_rgba(23,33,29,0.12)]" : "text-muted hover:text-ink"}`}
                  >
                    {m === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={google}
                disabled={!configured}
                className="flex h-[50px] items-center justify-center gap-3 rounded-[14px] border-[1.5px] border-line-strong bg-paper text-[15px] font-semibold hover:border-basil hover:bg-[#F7FAF8] disabled:opacity-50 lg:h-[52px]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] border-ink text-[13px] font-bold">G</span>
                ดำเนินการต่อด้วย Google
              </button>

              <div className="flex items-center gap-3 text-[12.5px] text-faint">
                <span className="h-px flex-1 bg-[#DDE2DE]" />
                หรือใช้อีเมล
                <span className="h-px flex-1 bg-[#DDE2DE]" />
              </div>

              <form onSubmit={submit} className="flex flex-col gap-3">
                {mode === "up" && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-name" className="text-[13px] font-semibold">
                      ชื่อที่ให้ bot เรียก
                    </label>
                    <input id="login-name" autoComplete="given-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!configured} placeholder="เช่น มิ้นท์" className={inputCls} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email" className="text-[13px] font-semibold">
                    อีเมล
                  </label>
                  <input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!configured} placeholder="you@example.com" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="login-pass" className="text-[13px] font-semibold">
                      รหัสผ่าน
                    </label>
                    {mode === "in" && (
                      <button type="button" onClick={forgot} className="text-[12.5px] text-basil hover:text-basil-dark hover:underline">
                        ลืมรหัสผ่าน
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="login-pass"
                      type={show ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete={mode === "in" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={!configured}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                      className={`${inputCls} pr-[52px]`}
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      aria-pressed={show}
                      className="absolute right-1.5 top-1.5 flex h-10 w-10 items-center justify-center rounded-[10px] text-muted hover:bg-ground hover:text-ink lg:top-2"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                        <circle cx="12" cy="12" r="3" />
                        {show && <path d="M4 4l16 16" />}
                      </svg>
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={!configured || busy || loading} className="mt-1 h-[50px] rounded-[14px] bg-basil text-[15.5px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-50 lg:h-[52px]">
                  {busy ? "กำลังดำเนินการ" : mode === "in" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                </button>
              </form>
            </>
          )}

          <div role="status" aria-live="polite">
            {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            {notice && <p className="rounded-xl bg-basil-soft px-3 py-2 text-sm text-basil-dark">{notice}</p>}
          </div>

          <div className="flex flex-col items-center gap-1">
            <Link href="/" className="flex min-h-10 items-center text-[13.5px] text-ink-2 underline hover:text-basil">
              ลองใช้แบบผู้ใช้เดโม่
            </Link>
            <span className="text-[11.5px] text-faint">การเข้าสู่ระบบดูแลโดย Supabase Auth</span>
          </div>
        </div>
      </main>
    </div>
  );
}
