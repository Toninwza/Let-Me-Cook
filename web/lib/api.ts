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

export type UserProfile = {
  user_id: string;
  display_name: string;
  address: Address;
  interests: string[];
  discount_percent: number;
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
