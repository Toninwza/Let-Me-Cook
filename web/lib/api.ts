// Types mirror docs/contract.md. Change the contract first.

export type ShopInfo = {
  shop_id: string;
  name: string;
  rating: number;
  ship_days: number;
};

export type ProductOption = {
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
  reason: string;
};

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
  address: Address;
  interests: string[];
  purchase_history: PastPurchase[];
  discount_percent: number;
};

export type ProductHit = Omit<ProductOption, "reason">;

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
  payment_qr_url: string | null;
  payment_test_url: string | null;
  payment_expires_at: string | null;
  payment_url: string | null;
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

export async function createSession(userId?: string): Promise<{ session_id: string; user: UserProfile }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId ?? null }),
  });
  if (!res.ok) throw new Error(`create session failed: ${res.status}`);
  return res.json();
}

/** POSTs a message and yields each SSE event as it arrives. */
export async function* sendMessage(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`send failed: ${res.status}`);

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

/** Error with the backend's Thai `detail`, safe to show to the user. */
export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = "ระบบขัดข้อง ลองใหม่อีกครั้งครับ";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new ApiError(detail);
  }
  return res.json();
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const listProducts = () => call<ProductHit[]>("/api/products");

export const createOrder = (body: {
  session_id: string | null;
  user_id: string;
  product_id: string;
  quantity: number;
  payment_method: PaymentMethod;
}) => call<Order>("/api/orders", json(body));

export const confirmOrder = (id: string) => call<Order>(`/api/orders/${id}/confirm`, { method: "POST" });
export const cancelOrder = (id: string) => call<Order>(`/api/orders/${id}/cancel`, { method: "POST" });
export const getOrder = (id: string) => call<Order>(`/api/orders/${id}`);
export const setOrderStatus = (id: string, status: "shipped" | "delivered") =>
  call<Order>(`/api/orders/${id}/status`, json({ status }));
export const listOrders = (params: { shop_id?: string; user_id?: string }) =>
  call<Order[]>(`/api/orders?${new URLSearchParams(params as Record<string, string>)}`);

export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", audio, "voice.webm");
  const { text } = await call<{ text: string }>("/api/voice/transcribe", { method: "POST", body: form });
  return text;
}

export async function speak(text: string): Promise<Blob> {
  const res = await fetch("/api/voice/speak", json({ text: text.slice(0, 600) }));
  if (!res.ok) throw new ApiError("สร้างเสียงไม่สำเร็จ");
  return res.blob();
}
