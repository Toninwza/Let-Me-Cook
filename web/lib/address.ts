import type { Address } from "@/lib/api";

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
  if (!a.line) return "กรอกบ้านเลขที่ ซอย ถนน";
  if (!a.district) return "กรอกเขตหรืออำเภอ";
  if (!a.province) return "กรอกจังหวัด";
  if (!/^\d{5}$/.test(a.postcode)) return "รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก";
  return null;
}
