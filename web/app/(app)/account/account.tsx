"use client";

import { t } from "@/lib/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, DEMO_USER_ID, UserProfile, getUser, updateUser } from "@/lib/api";
import { addressError, contactError, contactPayload, normalizeAddress, normalizeContact, phoneDigits } from "@/lib/address";
import { useAuth } from "@/components/auth-provider";
import { MenuButton } from "@/components/app-shell";
import AddressFields, { Field } from "@/components/address-fields";
import RecipientFields from "@/components/recipient-fields";

export default function Account() {
  const { session, email, setProfileName } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState(normalizeAddress(null));
  const [contact, setContact] = useState(normalizeContact(null));
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
          setContact(normalizeContact(u));
        },
        () => setLoadError(true),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function save() {
    const problem = !name.trim() ? t("กรอกชื่อที่แสดง") : contactError(contact) ?? addressError(address);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await updateUser(DEMO_USER_ID, { display_name: name.trim(), ...contactPayload(contact), address: normalizeAddress(address) });
      setUser(next);
      setProfileName(next.display_name);
      setSaved(true);
    } catch (e) {
      setSaved(false);
      setError(e instanceof ApiError && e.status !== 404 && e.status !== 405 ? e.message : t("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง"));
    } finally {
      setBusy(false);
    }
  }

  const preview = [address.line, address.district, address.province, address.postcode].map((s) => s.trim()).filter(Boolean).join(" ");

  return (
    <div className="h-full overflow-y-auto bg-ground">
      <header className="sticky top-0 z-10 flex h-[60px] items-center gap-1 border-b border-line bg-paper px-2 md:h-[68px] md:px-8">
        <MenuButton className="text-ink hover:bg-ground" />
        <h1 className="text-base font-bold md:text-lg">{t("ข้อมูลของฉัน")}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6 px-4 py-4 md:px-8 md:py-7 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-[640px]">
          {loadError && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{t("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้")}</p>}

          <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
            <h2 className="text-[15px] font-bold">{t("บัญชี")}</h2>
            <Field label={t("ชื่อที่แสดง")} htmlFor="account-name">
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
                  {t("อีเมล")} <span className="font-normal text-faint">{session ? t("(ใช้เข้าสู่ระบบ แก้ไม่ได้)") : t("(ยังไม่ได้เข้าสู่ระบบ)")}</span>
                </>
              }
              htmlFor="account-email"
            >
              <input
                id="account-email"
                readOnly
                value={email ?? ""}
                placeholder={t("ตอนนี้ใช้งานแบบลูกค้าทั่วไป")}
                className="h-[46px] w-full rounded-xl border-[1.5px] border-line bg-ground px-3.5 text-[15px] text-ink-2 outline-none"
              />
            </Field>
            {!session && (
              <Link href="/login" className="w-fit text-[13.5px] font-medium text-basil underline">
                {t("เข้าสู่ระบบ")}
              </Link>
            )}
          </section>

          <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
            <h2 className="text-[15px] font-bold">{t("ผู้รับสินค้า")}</h2>
            <RecipientFields
              value={contact}
              onChange={(next) => {
                setContact(next);
                setSaved(false);
              }}
            />
          </section>

          <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
            <div>
              <h2 className="text-[15px] font-bold">{t("ที่อยู่จัดส่ง")}</h2>
              <p className="text-[12.5px] text-muted">{t("ใช้กับออเดอร์ถัดไป ออเดอร์ที่สั่งไปแล้วไม่เปลี่ยน")}</p>
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
              {busy ? t("กำลังบันทึก") : t("บันทึก")}
            </button>
            <span role="status" className="text-[13.5px] font-semibold text-basil-dark">
              {saved ? <span className="rounded-[10px] bg-basil-soft px-3 py-1.5">{t("บันทึกแล้ว ใช้ที่อยู่นี้ในออเดอร์ถัดไป")}</span> : null}
            </span>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        <aside aria-label={t("ตัวอย่างตอนจ่ายเงิน")} className="flex w-full flex-col gap-2.5 lg:w-[340px] lg:shrink-0">
          <div className="text-[12.5px] font-semibold tracking-[0.04em] text-muted">{t("ตอนจ่ายเงินจะเห็นแบบนี้")}</div>
          <div className="rounded-2xl border border-line bg-paper">
            <div className="border-b border-line px-4 py-2.5 text-center text-[13px] font-bold">U-Pay</div>
            <div className="flex gap-2.5 px-4 py-3.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0 text-basil">
                <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" />
              </svg>
              <div className="flex min-w-0 flex-col">
                <div className="font-semibold">{contact.full_name.trim() || name.trim() || t("ชื่อของคุณ")}</div>
                <div className="text-[13px] text-ink-2">{preview || t("ยังไม่ได้กรอกที่อยู่")}</div>
                {phoneDigits(contact.phone) && <div className="text-[13px] tabular-nums text-ink-2">{t("โทร {phone}", { phone: contact.phone.trim() })}</div>}
              </div>
            </div>
          </div>
          <p className="text-[12.5px] text-muted">{t("ถ้ายังไม่เคยกรอกที่อยู่ ตอนกดซื้อครั้งแรกจะมีฟอร์มนี้ขึ้นมาให้กรอกก่อนจ่าย")}</p>
        </aside>
      </div>
    </div>
  );
}
