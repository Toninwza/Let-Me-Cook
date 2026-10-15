"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AgentEvent,
  ProductOption,
  StepStatus,
  UserProfile,
  createSession,
  sendMessage,
} from "@/lib/api";

type Step = { id: string; label: string; status: StepStatus; detail: string | null };

type BotTurn = {
  role: "bot";
  steps: Step[];
  text: string;
  clarify?: { question: string; choices: string[] };
  options?: { items: ProductOption[]; reason: string | null; alternatives: string[] };
  checkout?: { product_id: string; quantity: number };
  error?: string;
  done: boolean;
};

type Turn = { role: "user"; text: string } | BotTurn;

function applyEvent(turn: BotTurn, event: AgentEvent): BotTurn {
  switch (event.type) {
    case "agent_step": {
      const step = { id: event.step_id, label: event.label, status: event.status, detail: event.detail };
      const exists = turn.steps.some((s) => s.id === step.id);
      return {
        ...turn,
        steps: exists ? turn.steps.map((s) => (s.id === step.id ? step : s)) : [...turn.steps, step],
      };
    }
    case "message_delta":
      return { ...turn, text: turn.text + event.text };
    case "clarify":
      return { ...turn, clarify: { question: event.question, choices: event.choices ?? [] } };
    case "options":
      return {
        ...turn,
        options: { items: event.items, reason: event.reason, alternatives: event.alternatives ?? [] },
      };
    case "checkout_request":
      return { ...turn, checkout: { product_id: event.product_id, quantity: event.quantity } };
    case "error":
      return { ...turn, error: event.message };
    case "done":
      return { ...turn, done: true };
  }
}

const baht = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 2 });
const thaiDate = new Intl.DateTimeFormat("th-TH", { weekday: "short", day: "numeric", month: "short" });

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return thaiDate.format(new Date(y, m - 1, d));
}

export default function Chat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function startSession() {
    setSessionError(null);
    try {
      const s = await createSession();
      setSessionId(s.session_id);
      setUser(s.user);
    } catch {
      setSessionError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession();
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || !sessionId || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { role: "user", text: clean }, { role: "bot", steps: [], text: "", done: false }]);

    const updateBot = (fn: (turn: BotTurn) => BotTurn) =>
      setTurns((t) => {
        const last = t[t.length - 1];
        return last?.role === "bot" ? [...t.slice(0, -1), fn(last)] : t;
      });

    try {
      for await (const event of sendMessage(sessionId, clean)) {
        updateBot((turn) => applyEvent(turn, event));
      }
    } catch {
      updateBot((turn) => ({ ...turn, error: "การเชื่อมต่อขาดหาย ลองส่งใหม่อีกครั้งครับ" }));
    } finally {
      updateBot((turn) => ({ ...turn, done: true }));
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const optionTitles = new Map<string, string>();
  for (const t of turns) {
    if (t.role === "bot") t.options?.items.forEach((o) => optionTitles.set(o.product_id, o.title));
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-white dark:bg-neutral-950">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 className="text-base font-semibold">Let-Me-Cook</h1>
        <p className="text-xs text-neutral-500">
          {user ? `สวัสดี ${user.display_name} บอกได้เลยว่าอยากได้อะไร` : "กำลังเชื่อมต่อ..."}
        </p>
      </header>

      <main className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {sessionError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {sessionError}{" "}
            <button className="underline" onClick={startSession}>
              ลองใหม่
            </button>
          </div>
        )}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-neutral-900 px-3 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900">
                {turn.text}
              </p>
            </div>
          ) : (
            <BotMessage
              key={i}
              turn={turn}
              disabled={busy}
              onReply={send}
              titleOf={(id) => optionTitles.get(id) ?? id}
            />
          ),
        )}
        <div ref={bottom} />
      </main>

      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-neutral-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="เช่น หาเก้าอี้ทำงาน งบ 3,000 ส่งภายในวันอาทิตย์"
          maxLength={2000}
          disabled={!sessionId}
          className="min-w-0 flex-1 rounded-full border border-neutral-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={!sessionId || busy || !input.trim()}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}

function BotMessage({
  turn,
  disabled,
  onReply,
  titleOf,
}: {
  turn: BotTurn;
  disabled: boolean;
  onReply: (text: string) => void;
  titleOf: (productId: string) => string;
}) {
  const waiting = !turn.done && turn.steps.length === 0 && !turn.text;
  return (
    <div className="space-y-2">
      {waiting && <p className="text-sm text-neutral-500">bot กำลังคิด...</p>}

      {turn.steps.length > 0 && (
        <ol className="space-y-1 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          {turn.steps.map((step) => (
            <li key={step.id} className="flex gap-2">
              <StepIcon status={step.status} />
              <span>
                <span className={step.status === "error" ? "text-red-600" : ""}>{step.label}</span>
                {step.detail && <span className="text-neutral-500">: {step.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {turn.text && <p className="text-sm leading-relaxed">{turn.text}</p>}

      {turn.clarify && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{turn.clarify.question}</p>
          <Chips items={turn.clarify.choices} disabled={disabled} onPick={onReply} />
        </div>
      )}

      {turn.options && turn.options.items.length > 0 && (
        <div className="space-y-2">
          {turn.options.items.map((item, idx) => (
            <ProductCard key={item.product_id} item={item} rank={idx + 1} />
          ))}
        </div>
      )}

      {turn.options && turn.options.items.length === 0 && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <p>{turn.options.reason ?? "ไม่เจอสินค้าที่ตรงเงื่อนไข"}</p>
          <Chips items={turn.options.alternatives} disabled={disabled} onPick={onReply} />
        </div>
      )}

      {turn.checkout && (
        <p className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          สั่งซื้อ: {titleOf(turn.checkout.product_id)} จำนวน {turn.checkout.quantity}
        </p>
      )}

      {turn.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {turn.error}
        </p>
      )}
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running")
    return <span className="mt-0.5 inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />;
  if (status === "error") return <span className="w-3 shrink-0 text-red-600">✕</span>;
  return <span className="w-3 shrink-0 text-green-600">✓</span>;
}

function Chips({ items, disabled, onPick }: { items: string[]; disabled: boolean; onPick: (t: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          disabled={disabled}
          onClick={() => onPick(item)}
          className="rounded-full border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function ProductCard({ item, rank }: { item: ProductOption; rank: number }) {
  return (
    <article className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">
          <span className="mr-1 text-neutral-400">{rank}.</span>
          {item.title}
        </h3>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{baht.format(item.price)}</p>
          {item.discount_percent > 0 && (
            <p className="text-xs text-neutral-500">
              <s>{baht.format(item.original_price)}</s> -{item.discount_percent}%
            </p>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        ★ {item.rating.toFixed(1)} ({item.review_count}) · {item.shop.name} · ส่งถึง {formatDate(item.delivery_date)}
      </p>
      <p className="mt-2 text-xs leading-relaxed">{item.reason}</p>
    </article>
  );
}
