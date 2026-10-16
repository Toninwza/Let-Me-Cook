import { t } from "@/lib/i18n";
import type { Address, UserProfile } from "@/lib/api";

/** The API may return an empty or partial address for a user who never filled one in. */
export function normalizeAddress(a: Partial<Address> | null | undefined): Address {
  return {
    line: a?.line?.trim() ?? "",
    district: a?.district?.trim() ?? "",
    province: a?.province?.trim() ?? "",
    postcode: a?.postcode?.trim() ?? "",
  };
}

/** Thai message for the first problem found, or null when the address can be used for an order. */
export function addressError(raw: Partial<Address> | null | undefined): string | null {
  const a = normalizeAddress(raw);
  if (!a.line) return t("กรอกบ้านเลขที่ ซอย ถนน");
  if (!a.district) return t("กรอกเขตหรืออำเภอ");
  if (!a.province) return t("กรอกจังหวัด");
  if (!/^\d{5}$/.test(a.postcode)) return t("รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก");
  return null;
}

export type Contact = { full_name: string; phone: string };

export function normalizeContact(u: { full_name?: string | null; phone?: string | null } | null | undefined): Contact {
  return { full_name: u?.full_name?.trim() ?? "", phone: u?.phone?.trim() ?? "" };
}

/** Digits only, so "081-234 5678" and "0812345678" compare and save the same. */
export const phoneDigits = (phone: string) => phone.replace(/\D/g, "");

export function contactError(c: Contact): string | null {
  if (!c.full_name.trim()) return t("กรอกชื่อจริงและนามสกุลของผู้รับ");
  if (!/^0\d{8,9}$/.test(phoneDigits(c.phone))) return t("เบอร์โทรต้องขึ้นต้นด้วย 0 และมี 9 หรือ 10 หลัก");
  return null;
}

/** The body to save: phone is stored as digits. */
export function contactPayload(c: Contact) {
  return { full_name: c.full_name.trim(), phone: phoneDigits(c.phone) };
}

/** True when the API returns recipient fields at all, so old APIs do not block checkout. */
export const apiHasContact = (u: UserProfile | null | undefined) => !!u && "phone" in u && "full_name" in u;
