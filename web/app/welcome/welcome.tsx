"use client";

import { t } from "@/lib/i18n";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, DEMO_USER_ID, getUser, updateUser } from "@/lib/api";
import { addressError, contactError, contactPayload, normalizeAddress, normalizeContact } from "@/lib/address";
import { useAuth } from "@/components/auth-provider";
import AddressFields, { Field } from "@/components/address-fields";
import RecipientFields from "@/components/recipient-fields";
import Magnet from "@/components/magnet";

/** Shown once after sign-up: a nickname for the bot and the shipping address. Both can be skipped. */
export default function Welcome() {
  const router = useRouter();
  const { name, setProfileName } = useAuth();
  const [nick, setNick] = useState<string | null>(null);
  const [address, setAddress] = useState(normalizeAddress(null));
  const [contact, setContact] = useState(normalizeContact(null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from what the API already knows about the user, then from the sign-up name.
  useEffect(() => {
    const t = setTimeout(() => {
      getUser(DEMO_USER_ID).then(
        (u) => {
          setAddress(normalizeAddress(u.address));
          setContact(normalizeContact(u));
        },
        () => {},
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const nickname = nick ?? name ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = !nickname.trim() ? t("กรอกชื่อเล่นที่ให้ bot เรียก") : contactError(contact) ?? addressError(address);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await updateUser(DEMO_USER_ID, { display_name: nickname.trim(), ...contactPayload(contact), address: normalizeAddress(address) });
      setProfileName(next.display_name);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 404 && err.status !== 405 ? err.message : t("บันทึกไม่สำเร็จ ลองใหม่ หรือกดข้ามไปก่อน"));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAFAF7] lg:flex-row">
      <section className="flex shrink-0 flex-col gap-3 bg-forest px-5 py-5 text-paper lg:w-[460px] lg:justify-between lg:px-11 lg:py-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Magnet size={26} />
          <span className="font-display text-lg font-extrabold lg:text-xl">PULL</span>
        </Link>
        <div className="flex flex-col gap-2 lg:gap-3.5">
          <h1 className="font-display text-2xl font-semibold leading-[1.15] tracking-[-0.02em] lg:text-[34px]">
            {t("ขอรู้จักคุณ")}
            <br className="hidden lg:block" /> {t("อีกนิดเดียว")}
          </h1>
          <p className="max-w-[330px] text-[13px] text-[#CFE3D8] lg:text-[15px]">{t("bot จะเรียกคุณด้วยชื่อเล่น และใช้ที่อยู่นี้คำนวณวันส่งให้ตอนคัดสินค้า")}</p>
        </div>
        <p className="hidden text-[12.5px] text-[#9DBFAE] lg:block">{t("กรอกครั้งเดียว แก้ได้ทุกเมื่อที่ ข้อมูลของฉัน")}</p>
      </section>

      <main className="flex flex-1 items-start justify-center px-4 py-5 lg:items-center lg:p-8">
        <form onSubmit={submit} className="flex w-full max-w-[480px] flex-col gap-4 lg:gap-[18px]">
          <div className="hidden lg:block">
            <h2 className="text-[26px] font-bold">{t("ยินดีต้อนรับ")}</h2>
            <p className="text-muted">{t("สมัครเรียบร้อยแล้ว ตั้งค่าเริ่มต้นก่อนเริ่มช้อป")}</p>
          </div>

          <Field
            label={
              <>
                {t("ชื่อเล่น")} <span className="font-normal text-muted">{t("(ให้ bot เรียกคุณ)")}</span>
              </>
            }
            htmlFor="welcome-nick"
          >
            <input
              id="welcome-nick"
              value={nickname}
              onChange={(e) => setNick(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
              className="h-12 w-full rounded-xl border-[1.5px] border-line-strong bg-paper px-3.5 text-base outline-none focus:border-basil"
            />
          </Field>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3.5 lg:p-[18px]">
            <div className="font-bold">{t("ผู้รับสินค้า")}</div>
            <RecipientFields value={contact} onChange={setContact} />
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3.5 lg:p-[18px]">
            <div className="font-bold">{t("ที่อยู่จัดส่ง")}</div>
            <AddressFields value={address} onChange={setAddress} />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="h-[50px] rounded-xl bg-basil text-base font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
            {busy ? t("กำลังบันทึก") : t("เริ่มใช้งาน")}
          </button>
          <Link href="/" className="flex min-h-11 items-center justify-center text-[13.5px] text-ink-2 hover:text-ink">
            {t("ข้ามไปก่อน กรอกตอนซื้อครั้งแรกก็ได้")}
          </Link>
        </form>
      </main>
    </div>
  );
}
