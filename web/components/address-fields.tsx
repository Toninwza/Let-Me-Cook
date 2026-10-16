"use client";

import { t } from "@/lib/i18n";

import { useId } from "react";
import type { Address } from "@/lib/api";

const INPUT = "h-[46px] w-full rounded-xl border-[1.5px] border-line-strong bg-paper px-3.5 text-[15px] text-ink outline-none focus:border-basil";

/** The four address inputs. Used by the account page and by the first-checkout form in U-Pay. */
export default function AddressFields({ value, onChange }: { value: Address; onChange: (next: Address) => void }) {
  const id = useId();
  const set = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="flex flex-col gap-3">
      <Field label={t("บ้านเลขที่ ซอย ถนน")} htmlFor={`${id}-line`}>
        <input id={`${id}-line`} autoComplete="street-address" value={value.line} onChange={set("line")} maxLength={200} className={INPUT} />
      </Field>
      <div className="flex gap-3">
        <Field label={t("เขต / อำเภอ")} htmlFor={`${id}-district`}>
          <input id={`${id}-district`} value={value.district} onChange={set("district")} maxLength={80} className={INPUT} />
        </Field>
        <Field label={t("จังหวัด")} htmlFor={`${id}-province`}>
          <input id={`${id}-province`} value={value.province} onChange={set("province")} maxLength={80} className={INPUT} />
        </Field>
      </div>
      <div className="w-full sm:w-[200px]">
        <Field label={t("รหัสไปรษณีย์")} htmlFor={`${id}-postcode`}>
          <input
            id={`${id}-postcode`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={value.postcode}
            onChange={(e) => onChange({ ...value, postcode: e.target.value.replace(/\D/g, "") })}
            className={`${INPUT} tabular-nums`}
          />
        </Field>
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, children }: { label: React.ReactNode; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}
