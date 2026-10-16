"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, DEMO_USER_ID, Order, PaymentMethod, ShopInfo, UserProfile, cancelOrder, confirmOrder, createOrder, getOrder, updateUser } from "@/lib/api";
import { addressError, apiHasContact, contactError, contactPayload, normalizeAddress, normalizeContact } from "@/lib/address";
import { baht, shortDate } from "@/lib/format";
import AddressFields from "./address-fields";
import RecipientFields from "./recipient-fields";
import ProductThumb from "./product-thumb";

const METHODS: { key: PaymentMethod; label: string; hint: string; badge: string; badgeCls: string }[] = [
  { key: "promptpay", label: "PromptPay QR", hint: "สแกนจ่ายด้วยแอปธนาคารไหนก็ได้", badge: "QR", badgeCls: "bg-[#13385F]" },
  { key: "card", label: "บัตรเครดิต / เดบิต", hint: "Visa, Mastercard, JCB ผ่านหน้าของ Stripe", badge: "CARD", badgeCls: "bg-ink" },
];

export type CheckoutProduct = {
  product_id: string;
  title: string;
  category: string;
  image_url: string | null;
  price: number;
  original_price: number;
  stock: number;
  delivery_date: string;
  shop: ShopInfo;
};

type Step = "summary" | "qr" | "paid";

export default function UPaySheet({
  product,
  resumeOrder,
  user,
  sessionId,
  onClose,
  onPaid,
}: {
  product: CheckoutProduct | null;
  resumeOrder?: Order | null;
  user: UserProfile | null;
  sessionId: string | null;
  onClose: () => void;
  onPaid?: (order: Order) => void;
}) {
  const [step, setStep] = useState<Step>(resumeOrder ? "qr" : "summary");
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("promptpay");
  const [order, setOrder] = useState<Order | null>(resumeOrder ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // First checkout without an address: collect it here, then keep it on the account.
  const [savedUser, setSavedUser] = useState<UserProfile | null>(null);
  const me = savedUser ?? user;
  // Recipient name and phone are only required once the API stores them.
  const wantsContact = apiHasContact(me);
  const needsAddress = !!me && (addressError(me.address) !== null || (wantsContact && contactError(normalizeContact(me)) !== null));
  const [draft, setDraft] = useState(() => normalizeAddress(user?.address));
  const [contactDraft, setContactDraft] = useState(() => normalizeContact(user));
  const [savingAddress, setSavingAddress] = useState(false);

  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const orderId = order?.order_id;
  useEffect(() => {
    if (step !== "qr" || !orderId) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await getOrder(orderId);
        setOrder(fresh);
        if (fresh.status === "paid" || fresh.status === "shipped" || fresh.status === "delivered") {
          setStep("paid");
          onPaidRef.current?.(fresh);
        } else if (fresh.status === "cancelled") {
          setError("ออเดอร์นี้ถูกยกเลิกแล้ว");
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [step, orderId]);

  const title = product?.title ?? order?.title ?? "";
  const shop = product?.shop ?? order?.shop;
  const round = (n: number) => Math.round(n * 100) / 100;
  const unit = product?.price ?? order?.unit_price ?? 0;
  const original = product?.original_price ?? unit;
  // Same math as the API's create_order, so the summary matches what Stripe charges.
  const subtotal = round(unit * qty);
  const utagPercent = user?.discount_percent ?? 0;
  const utag = round((subtotal * utagPercent) / 100);
  const total = Math.max(round(subtotal - utag), 10);
  const shopSaved = round((original - unit) * qty);
  const saved = round(shopSaved + utag);
  const maxQty = Math.max(1, Math.min(product?.stock ?? 1, 20));

  async function saveAddress() {
    const problem = (wantsContact ? contactError(contactDraft) : null) ?? addressError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSavingAddress(true);
    setError(null);
    try {
      setSavedUser(
        await updateUser(me?.user_id ?? DEMO_USER_ID, {
          ...(wantsContact ? contactPayload(contactDraft) : {}),
          address: normalizeAddress(draft),
        }),
      );
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 404 && e.status !== 405 ? e.message : "บันทึกที่อยู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSavingAddress(false);
    }
  }

  async function confirm() {
    if (!product || needsAddress) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createOrder({ session_id: sessionId, product_id: product.product_id, quantity: qty, payment_method: method });
      const confirmed = await confirmOrder(created.order_id);
      setOrder(confirmed);
      setStep("qr");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "สร้างออเดอร์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      setOrder(await confirmOrder(order.order_id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "สร้าง QR ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!order) return onClose();
    setBusy(true);
    try {
      await cancelOrder(order.order_id);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "ยกเลิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const payLabel = order?.payment_method === "card" ? "จ่ายด้วยบัตร" : "สแกนจ่าย";
  const stepLabel = step === "summary" ? "ขั้น 1 จาก 3 · ตรวจยอดก่อนยืนยัน" : step === "qr" ? `ขั้น 2 จาก 3 · ${payLabel}` : "ขั้น 3 จาก 3 · เสร็จแล้ว";

  return (
    <div role="dialog" aria-modal="true" aria-label="U-Pay" className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 md:items-center md:p-6">
      <button aria-label="ปิด" onClick={step === "paid" ? onClose : undefined} className="absolute inset-0 cursor-default" />
      <div className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-ground md:rounded-3xl md:shadow-2xl">
        <header className="relative flex flex-col items-center border-b border-line bg-paper px-4 pb-2.5 pt-3.5">
          <span className="font-display text-base font-semibold">U-Pay</span>
          <span className="text-xs text-muted">{stepLabel}</span>
          {step !== "qr" && (
            <button onClick={onClose} aria-label="ปิด" className="absolute right-2 top-2.5 flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-ground">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </header>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
          {step === "summary" && product && (
            <>
              <section className="rounded-2xl bg-paper">
                {needsAddress ? (
                  <div className="flex flex-col gap-3 p-3.5">
                    <div className="flex gap-2.5">
                      <span className="mt-0.5 shrink-0 text-basil">
                        <PinIcon />
                      </span>
                      <div>
                        <div className="font-semibold">{wantsContact ? "กรอกข้อมูลผู้รับและที่อยู่จัดส่ง" : "กรอกที่อยู่จัดส่ง"}</div>
                        <div className="text-[12.5px] text-muted">กรอกครั้งเดียว ครั้งต่อไปใช้ที่อยู่นี้ให้ และแก้ได้ที่ ข้อมูลของฉัน</div>
                      </div>
                    </div>
                    {wantsContact && <RecipientFields value={contactDraft} onChange={setContactDraft} />}
                    <AddressFields value={draft} onChange={setDraft} />
                    <button
                      onClick={saveAddress}
                      disabled={savingAddress}
                      className="h-11 rounded-xl bg-ink font-semibold text-paper hover:bg-[#2a3530] disabled:opacity-50"
                    >
                      {savingAddress ? "กำลังบันทึก" : "บันทึกที่อยู่"}
                    </button>
                  </div>
                ) : (
                  <Row icon={<PinIcon />}>
                    <div className="font-semibold">{me?.full_name || me?.display_name || "ผู้ใช้เดโม่"}</div>
                    {me && (
                      <div className="text-[13px] text-ink-2">
                        {me.address.line} {me.address.district} {me.address.province} {me.address.postcode}
                      </div>
                    )}
                    {me?.phone && <div className="text-[13px] tabular-nums text-ink-2">โทร {me.phone}</div>}
                  </Row>
                )}
                <div className="border-t border-line" />
                <Row icon={<TruckIcon />}>
                  <div className="font-semibold">ส่งถึง {shortDate(product.delivery_date)}</div>
                  <div className="text-[13px] text-ink-2">
                    {product.shop.name} จัดส่งภายใน {product.shop.ship_days} วัน
                  </div>
                </Row>
              </section>

              <section className="space-y-2.5 rounded-2xl bg-paper p-3.5">
                <div className="text-sm font-semibold">
                  {product.shop.name} <span className="text-xs font-normal text-muted">★ {product.shop.rating.toFixed(1)}</span>
                </div>
                <div className="flex gap-3">
                  <ProductThumb imageUrl={product.image_url} category={product.category} className="h-[76px] w-[76px] shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="text-[13.5px] font-medium leading-snug">{product.title}</div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 tabular-nums">
                        <span className="font-bold">{baht(product.price)}</span>
                        {original > unit && <s className="text-xs text-faint">{baht(original)}</s>}
                      </div>
                      <div role="group" aria-label="จำนวน" className="flex items-center overflow-hidden rounded-xl border border-line-strong">
                        <button aria-label="ลดจำนวน" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 text-lg hover:bg-ground">
                          −
                        </button>
                        <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
                        <button aria-label="เพิ่มจำนวน" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="h-9 w-9 text-lg hover:bg-ground">
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-[11.5px] text-muted">เหลือในร้าน {product.stock} ชิ้น</div>
                  </div>
                </div>
              </section>

              <section role="radiogroup" aria-label="วิธีชำระเงิน" className="overflow-hidden rounded-2xl bg-paper">
                {METHODS.map((m, i) => {
                  const on = method === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setMethod(m.key)}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-ground ${i ? "border-t border-line" : ""}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={`flex h-6 w-9 items-center justify-center rounded-md text-[9px] font-bold text-paper ${m.badgeCls}`}>{m.badge}</span>
                        <span className="flex flex-col">
                          <span className="font-medium">{m.label}</span>
                          <span className="text-xs text-muted">{m.hint}</span>
                        </span>
                      </span>
                      <span aria-hidden="true" className={`h-5 w-5 rounded-full ${on ? "border-[6px] border-basil" : "border-2 border-faint"}`} />
                    </button>
                  );
                })}
              </section>

              <section className="space-y-1.5 rounded-2xl bg-paper p-3.5 text-[13.5px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-ink-2">ราคาสินค้า ({qty} ชิ้น)</span>
                  <span>{baht(Math.round(original * qty * 100) / 100)}</span>
                </div>
                {shopSaved > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-2">ส่วนลดร้าน</span>
                    <span className="text-saffron-ink">-{baht(shopSaved)}</span>
                  </div>
                )}
                {utag > 0 && (
                  <div className="flex justify-between">
                    <span className="text-ink-2">ส่วนลดสมาชิก {utagPercent}%</span>
                    <span className="text-saffron-ink">-{baht(utag)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-line pt-1.5 text-[15px] font-bold">
                  <span>ยอดชำระ</span>
                  <span>{baht(total)}</span>
                </div>
              </section>
            </>
          )}

          {step === "qr" && order && order.payment_method === "card" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-center">
                <div className="text-[13px] text-muted">ยอดที่ต้องจ่าย</div>
                <div className="text-3xl font-bold tabular-nums">{baht(order.total)}</div>
                <div className="text-[13px] text-ink-2">
                  จ่ายให้ <span className="font-semibold">{shop?.name}</span> ด้วยบัตร ผ่านหน้าชำระเงินของ Stripe
                </div>
              </div>
              {order.payment_url && order.status === "awaiting_payment" && (
                <a
                  href={order.payment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-semibold text-paper transition-colors hover:bg-[#2a3530]"
                >
                  ไปหน้าจ่ายด้วยบัตร
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </a>
              )}
              <p className="text-center text-xs text-muted">เลขบัตรกรอกในหน้าของ Stripe เท่านั้น ไม่ผ่านระบบของเรา</p>
              {order.payment_url?.includes("cs_test_") && (
                <p className="rounded-lg bg-ground px-3 py-1.5 text-xs text-ink-2">
                  โหมดทดสอบ: ใช้บัตร <span className="font-mono">4242 4242 4242 4242</span> วันหมดอายุในอนาคต CVC อะไรก็ได้
                </p>
              )}
              <div className="text-xs text-muted">
                ออเดอร์ <span className="font-mono text-ink">{order.order_id}</span>
              </div>
              {order.status === "payment_failed" ? (
                <button onClick={retry} disabled={busy} className="h-12 w-full rounded-xl bg-basil font-semibold text-paper transition-colors hover:bg-basil-dark disabled:opacity-50">
                  {busy ? "กำลังสร้างหน้าชำระเงิน" : "หน้าชำระเงินหมดอายุ สร้างใหม่"}
                </button>
              ) : (
                <div className="flex w-full items-center gap-3 rounded-2xl bg-basil-soft px-3.5 py-3 text-basil-dark">
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-[2.5px] border-basil border-t-transparent" />
                  <div className="flex-1 leading-tight">
                    <div className="text-sm font-semibold">รอการชำระเงิน</div>
                    <div className="text-xs text-ink-2">จ่ายในหน้า Stripe เสร็จแล้ว หน้านี้จะเปลี่ยนเอง</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "qr" && order && order.payment_method !== "card" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="text-center">
                <div className="text-[13px] text-muted">ยอดที่ต้องโอน</div>
                <div className="text-3xl font-bold tabular-nums">{baht(order.total)}</div>
                <div className="text-[13px] text-ink-2">
                  จ่ายให้ <span className="font-semibold">{shop?.name}</span> ผ่าน PromptPay
                </div>
              </div>
              <div className="rounded-3xl border border-line bg-paper p-4">
                {order.payment_qr_url && order.status === "awaiting_payment" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={order.payment_qr_url} alt="QR PromptPay สำหรับจ่ายออเดอร์นี้" className="h-56 w-56" />
                ) : (
                  <div className="flex h-56 w-56 items-center justify-center text-center text-sm text-muted">
                    {order.status === "payment_failed" ? "QR นี้ใช้ไม่ได้แล้ว" : "กำลังสร้าง QR"}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted">
                ออเดอร์ <span className="font-mono text-ink">{order.order_id}</span>
              </div>
              {order.status === "payment_failed" ? (
                <button onClick={retry} disabled={busy} className="h-12 w-full rounded-xl bg-basil font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
                  {busy ? "กำลังสร้าง QR" : "จ่ายไม่สำเร็จ สร้าง QR ใหม่"}
                </button>
              ) : (
                <div className="flex w-full items-center gap-3 rounded-2xl bg-basil-soft px-3.5 py-3 text-basil-dark">
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-[2.5px] border-basil border-t-transparent" />
                  <div className="flex-1 leading-tight">
                    <div className="text-sm font-semibold">รอการชำระเงิน</div>
                    <div className="text-xs text-ink-2">จ่ายเสร็จแล้วหน้านี้จะเปลี่ยนเอง ไม่ต้องส่งสลิป</div>
                  </div>
                </div>
              )}
              {order.payment_test_url && order.status === "awaiting_payment" && (
                <a href={order.payment_test_url} target="_blank" rel="noreferrer" className="text-[13px] font-medium text-basil underline hover:text-basil-dark">
                  จำลองการจ่าย (Stripe test mode)
                </a>
              )}
            </div>
          )}

          {step === "paid" && order && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-basil-soft text-basil">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              </span>
              <h2 className="text-xl font-bold">ชำระเงินสำเร็จ</h2>
              <p className="max-w-[18rem] text-[13.5px] text-ink-2">Stripe ยืนยันการชำระเงินแล้ว ร้านเห็นออเดอร์ของคุณและจะเริ่มจัดส่ง</p>
              <dl className="w-full divide-y divide-line rounded-2xl bg-paper px-3.5 text-[13.5px] tabular-nums">
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">ยอดที่จ่าย</dt>
                  <dd className="font-bold">{baht(order.total)}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">สินค้า</dt>
                  <dd className="max-w-[60%] truncate">
                    {title} x{order.quantity}
                  </dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">ส่งถึง</dt>
                  <dd>{shortDate(order.delivery_date)}</dd>
                </div>
              </dl>
            </div>
          )}

          {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        </div>

        <footer className="border-t border-line bg-paper px-3.5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {step === "summary" && (
            <div className="flex items-center gap-3">
              <div className="flex flex-1 flex-col items-end tabular-nums">
                <div className="text-[13px]">
                  รวมยอด <span className="text-lg font-bold text-basil">{baht(total)}</span>
                </div>
                {saved > 0 && <div className="text-xs text-saffron-ink">ประหยัดไป {baht(saved)}</div>}
              </div>
              <button onClick={confirm} disabled={busy || needsAddress} className="h-12 rounded-xl bg-basil px-6 font-semibold text-paper hover:bg-basil-dark disabled:opacity-50">
                {busy ? "กำลังสร้าง QR" : "ยืนยันสั่งซื้อ"}
              </button>
            </div>
          )}
          {step === "qr" && (
            <button onClick={cancel} disabled={busy} className="h-11 w-full rounded-xl font-medium text-[#8C2A1E] hover:bg-danger-soft disabled:opacity-50">
              ยกเลิกออเดอร์
            </button>
          )}
          {step === "paid" && (
            <div className="flex flex-col gap-2">
              <Link href="/orders" className="flex h-12 items-center justify-center rounded-xl bg-basil font-semibold text-paper hover:bg-basil-dark">
                ติดตามออเดอร์
              </Link>
              <button onClick={onClose} className="h-11 rounded-xl font-medium hover:bg-ground">
                กลับไปแชท
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 px-3.5 py-3">
      <span className="mt-0.5 shrink-0 text-basil">{icon}</span>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </svg>
  );
}
