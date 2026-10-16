import { t } from "@/lib/i18n";
// Types mirror docs/contract.md. Change the contract first.

import { supabase } from "@/lib/supabase";

export const DEMO_USER_ID = "u_demo";

export type ShopInfo = {
  shop_id: string;
  name: string;
  rating: number;
  ship_days: number;
};

export type ProductHit = {
  product_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  image_url: string | null;
  price: number;
  original_price: number;
  discount_percent: number;
  rating: number;
  review_count: number;
  stock: number;
  delivery_date: string;
  shop: ShopInfo;
};

export type ProductOption = ProductHit & { reason: string };

export type Address = { line: string; district: string; province: string; postcode: string };

export type PastPurchase = {
  product_id: string;
  title: string;
  category: string;
  price: number;
  purchased_at: string;
};

export type UserProfile = {
  user_id: string;
  display_name: string;
  /** Recipient name and phone. Absent until the API has the fields (see docs/handoff.md). */
  full_name?: string | null;
  phone?: string | null;
  address: Address;
  interests: string[];
  purchase_history: PastPurchase[];
  discount_percent: number;
};

export type PaymentMethod = "promptpay" | "card";

export type OrderStatus =
  | "pending_confirm"
  | "awaiting_payment"
  | "payment_failed"
  | "paid"
  | "shipped"
  | "delivered"
  | "cancelled";

export type Order = {
  order_id: string;
  session_id: string | null;
  user_id: string;
  product_id: string;
  title: string;
  shop: ShopInfo;
  quantity: number;
  unit_price: number;
  subtotal: number;
  utag_discount_percent: number;
  utag_discount: number;
  total: number;
  delivery_date: string;
  address: Address;
  payment_method: PaymentMethod | "avax_escrow";
  status: OrderStatus;
  /** card only: Stripe's hosted Checkout page. Open from a direct tap, never after an await (popup blockers). */
  payment_url: string | null;
  payment_qr_url: string | null;
  /** Stripe test mode only: the page that simulates a scan and authorizes the payment. */
  payment_test_url: string | null;
  payment_expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  tracking_number: string | null;
};

export type StepStatus = "running" | "done" | "error";

export type AgentEvent =
  | { type: "agent_step"; step_id: string; label: string; status: StepStatus; detail: string | null }
  | { type: "message_delta"; text: string }
  | { type: "clarify"; question: string; choices: string[] }
  | { type: "options"; items: ProductOption[]; reason: string | null; alternatives: string[] }
  | { type: "checkout_request"; product_id: string; quantity: number }
  | { type: "error"; code: string; message: string }
  | { type: "done" };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Supabase access token as a Bearer header; empty for guests (the API then serves the demo user). */
async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(await authHeader()), ...init?.headers },
  });
  if (!res.ok) {
    let detail = t("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export const createSession = (userId?: string) =>
  call<{ session_id: string; user: UserProfile }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ user_id: userId ?? null }),
  });

export const getUser = (id: string) => call<UserProfile>(`/api/users/${id}`);

/** Needs PATCH /api/users/{id} on the API (see docs/handoff.md). Every field is optional. */
export const updateUser = (id: string, body: { display_name?: string; full_name?: string; phone?: string; address?: Address }) =>
  call<UserProfile>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const listProducts = (shopId?: string) =>
  call<ProductHit[]>(`/api/products${shopId ? `?shop_id=${encodeURIComponent(shopId)}` : ""}`);

export const createOrder = (body: {
  session_id: string | null;
  product_id: string;
  quantity: number;
  payment_method: PaymentMethod;
}) =>
  call<Order>("/api/orders", {
    method: "POST",
    body: JSON.stringify({ ...body, user_id: DEMO_USER_ID }),
  });

export const confirmOrder = (id: string) => call<Order>(`/api/orders/${id}/confirm`, { method: "POST" });
export const cancelOrder = (id: string) => call<Order>(`/api/orders/${id}/cancel`, { method: "POST" });
export const getOrder = (id: string) => call<Order>(`/api/orders/${id}`);
export const setOrderStatus = (id: string, status: "shipped" | "delivered") =>
  call<Order>(`/api/orders/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });

export const listOrders = (filter: { shopId?: string; userId?: string }) => {
  const q = new URLSearchParams();
  if (filter.shopId) q.set("shop_id", filter.shopId);
  if (filter.userId) q.set("user_id", filter.userId);
  return call<Order[]>(`/api/orders?${q}`);
};

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "voice.webm");
  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) throw new ApiError(res.status, t("ฟังเสียงไม่ออก ลองพูดใหม่อีกครั้งครับ"));
  return (await res.json()).text as string;
}

export async function speak(text: string): Promise<Blob> {
  const res = await fetch("/api/voice/speak", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 600) }),
  });
  if (!res.ok) throw new ApiError(res.status, t("สร้างเสียงไม่สำเร็จ"));
  return res.blob();
}

/** POSTs a message and yields each SSE event as it arrives. */
export async function* sendMessage(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream", ...(await authHeader()) },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, t("ส่งข้อความไม่สำเร็จ"));

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value.replace(/\r\n/g, "\n");
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as AgentEvent;
    }
  }
}
