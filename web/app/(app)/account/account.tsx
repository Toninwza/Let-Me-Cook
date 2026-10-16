"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, DEMO_USER_ID, UserProfile, getUser, updateUser } from "@/lib/api";
import { addressError, normalizeAddress } from "@/lib/address";
import { useAuth } from "@/components/auth-provider";
import { MenuButton } from "@/components/app-shell";
import AddressFields, { Field } from "@/components/address-fields";

export default function Account() {
  const { session, email } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState(normalizeAddress(null));
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      getUser(DEMO_USER_ID).then(
        (u) => {
          setUser(u);
          setName(u.display_name);
          setAddress(normalizeAddress(u.address));
        },
        () => setLoadError(true),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const problem = !name.trim() ? "กรอกชื่อที่แสดง" : addressError(address);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await updateUser(DEMO_USER_ID, { display_name: name.trim(), address: normalizeAddress(address) });
      setUser(next);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setError(e instanceof ApiError && e.status !== 404 && e.status !== 405 ? e.message : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  const preview = [address.line, address.district, address.province, address.postcode].map((s) => s.trim()).filter(Boolean).join(" ");

  return (
    <div className="h-full overflow-y-auto bg-ground">
      <header className="sticky top-0 z-10 flex h-[60px] items-center gap-1 border-b border-line bg-paper px-2 md:h-[68px] md:px-8">
        <MenuButton className="text-ink hover:bg-ground" />
        <h1 className="text-base font-bold md:text-lg">ข้อมูลของฉัน</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-4 md:px-8 md:py-7 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-[640px]">
          {loadError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้</p>}

          <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
            <h2 className="text-[15px] font-bold">บัญชี</h2>
            <Field label="ชื่อที่แสดง" htmlFor="account-name">
              <input
                id="account-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                maxLength={60}
                className="h-[46px] w-full rounded-xl border-[1.5px] border-line-strong bg-paper px-3.5 text-[15px] outline-none focus:border-basil"
              />
            </Field>
            <Field
              label={
                <>
                  อีเมล <span className="font-normal text-faint">{session ? "(ใช้เข้าสู่ระบบ แก้ไม่ได้)" : "(ยังไม่ได้เข้าสู่ระบบ)"}</span>
                </>
              }
              htmlFor="account-email"
            >
              <input
                id="account-email"
                readOnly
                value={email ?? ""}
                placeholder="ตอนนี้ใช้เป็นผู้ใช้เดโม่"
                className="h-[46px] w-full rounded-xl border-[1.5px] border-line bg-ground px-3.5 text-[15px] text-ink-2 outline-none"
              />
            </Field>
            {!session && (
              <Link href="/login" className="w-fit text-[13.5px] font-medium text-basil underline">
                เข้าสู่ระบบ
              </Link>
            )}
          </section>

          <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
            <div>
              <h2 className="text-[15px] font-bold">ที่อยู่จัดส่ง</h2>
              <p className="text-[12.5px] text-muted">ใช้กับออเดอร์ถัดไป ออเดอร์ที่สั่งไปแล้วไม่เปลี่ยน</p>
            </div>
            <AddressFields
              value={address}
              onChange={(next) => {
                setAddress(next);
                setSaved(false);
              }}
            />
          </section>

          <div className="flex flex-wrap items-center gap-3.5">
            <button onClick={save} disabled={busy || !user} className="h-12 rounded-xl bg-basil px-7 text-[15px] font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
              {busy ? "กำลังบันทึก" : "บันทึก"}
            </button>
            <span role="status" className="text-[13.5px] font-semibold text-basil-dark">
              {saved ? <span className="rounded-[10px] bg-basil-soft px-3 py-1.5">บันทึกแล้ว ใช้ที่อยู่นี้ในออเดอร์ถัดไป</span> : null}
            </span>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <aside aria-label="ตัวอย่างตอนจ่ายเงิน" className="flex w-full flex-col gap-2.5 lg:w-[340px] lg:shrink-0">
          <div className="text-[12.5px] font-semibold tracking-[0.04em] text-muted">ตอนจ่ายเงินจะเห็นแบบนี้</div>
          <div className="rounded-2xl border border-line bg-paper">
            <div className="border-b border-line px-4 py-2.5 text-center text-[13px] font-bold">U-Pay</div>
            <div className="flex gap-2.5 px-4 py-3.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-basil">
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <div className="flex min-w-0 flex-col">
                <div className="font-semibold">{name.trim() || "ชื่อของคุณ"}</div>
                <div className="text-[13px] text-ink-2">{preview || "ยังไม่ได้กรอกที่อยู่"}</div>
              </div>
            </div>
          </div>
          <p className="text-[12.5px] text-muted">ถ้ายังไม่เคยกรอกที่อยู่ ตอนกดซื้อครั้งแรกจะมีฟอร์มนี้ขึ้นมาให้กรอกก่อนจ่าย</p>
        </aside>
      </div>
    </div>
  );
}
