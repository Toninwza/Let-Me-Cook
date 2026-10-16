"use client";

import { t } from "@/lib/i18n";

import { useId } from "react";
import type { Contact } from "@/lib/address";
import { Field } from "./address-fields";

const INPUT = "h-[46px] w-full rounded-xl border-[1.5px] border-line-strong bg-paper px-3.5 text-[15px] text-ink outline-none focus:border-basil";

/** Recipient name and phone: used by /welcome, /account and the first-checkout form in U-Pay. */
export default function RecipientFields({ value, onChange }: { value: Contact; onChange: (next: Contact) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <Field
        label={
          <>
            {t("ชื่อจริง นามสกุล")} <span className="font-normal text-muted">{t("(ให้คนส่งของใช้เรียก)")}</span>
          </>
        }
        htmlFor={`${id}-fullname`}
      >
        <input id={`${id}-fullname`} autoComplete="name" value={value.full_name} onChange={(e) => onChange({ ...value, full_name: e.target.value })} maxLength={100} className={INPUT} />
      </Field>
      <Field
        label={
          <>
            {t("เบอร์โทร")} <span className="font-normal text-muted">{t("(ให้ขนส่งโทรหาตอนส่งของ)")}</span>
          </>
        }
        htmlFor={`${id}-phone`}
      >
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^\d\s-]/g, "") })}
          maxLength={14}
          className={`${INPUT} tabular-nums`}
        />
      </Field>
    </div>
  );
}
