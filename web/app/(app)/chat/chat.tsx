"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AgentEvent, Order, ProductOption, UserProfile, createSession, listProducts, sendMessage } from "@/lib/api";
import { useBotVoice, useVoiceInput } from "@/lib/hooks";
import Magnet from "@/components/magnet";
import { MenuButton } from "@/components/app-shell";
import OrderCard from "@/components/order-card";
import ProductWidget from "@/components/product-widget";
import StepsPanel, { Step } from "@/components/steps-panel";
import UPaySheet, { CheckoutProduct } from "@/components/upay-sheet";

type BotTurn = {
  role: "bot";
  steps: Step[];
  startedAt: number;
  seconds: number | null;
  text: string;
  clarify?: { question: string; choices: string[] };
  options?: { items: ProductOption[]; reason: string | null; alternatives: string[] };
  error?: string;
  done: boolean;
};

type Turn = { role: "user"; text: string } | BotTurn | { role: "order"; order: Order };

const STARTERS = ["หาเก้าอี้ทำงาน ergonomic งบ 3,000 ส่งภายในวันอาทิตย์", "อยากได้หูฟังใหม่", "หา iPad Pro เครื่องใหม่ งบ 5,000"];

function applyEvent(turn: BotTurn, event: AgentEvent): BotTurn {
  switch (event.type) {
    case "agent_step": {
      const step = { id: event.step_id, label: event.label, status: event.status, detail: event.detail };
      const exists = turn.steps.some((s) => s.id === step.id);
      return { ...turn, steps: exists ? turn.steps.map((s) => (s.id === step.id ? step : s)) : [...turn.steps, step] };
    }
    case "message_delta":
      return { ...turn, text: turn.text + event.text };
    case "clarify":
      return { ...turn, clarify: { question: event.question, choices: event.choices ?? [] } };
    case "options":
      return { ...turn, options: { items: event.items, reason: event.reason, alternatives: event.alternatives ?? [] } };
    case "error":
      return { ...turn, error: event.message };
    case "checkout_request":
    case "done":
      return turn;
  }
}

export default function Chat() {
  const params = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const mic = useVoiceInput();
  const botVoice = useBotVoice();
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceOnRef = useRef(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutProduct | null>(null);
  const started = useRef(false);
  const sentInitial = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const knownProducts = useRef(new Map<string, ProductOption>());

  const startSession = useCallback(async () => {
    setSessionError(null);
    try {
      const s = await createSession();
      setSessionId(s.session_id);
      setUser(s.user);
    } catch {
      setSessionError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    }
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSession();
  }, [startSession]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const openCheckout = useCallback(async (productId: string) => {
    let product: ProductOption | undefined = knownProducts.current.get(productId);
    if (!product) {
      const all = await listProducts().catch(() => []);
      const hit = all.find((p) => p.product_id === productId);
      if (hit) product = { ...hit, reason: "" };
    }
    if (product) setCheckout(product);
  }, []);

  const send = useCallback(
    async (text: string, fromMic = false) => {
      const clean = text.trim();
      if (!clean || !sessionId || busy) return;
      setInput("");
      setBusy(true);
      botVoice.stop();
      let spoken = "";
      const startedAt = Date.now();
      setTurns((t) => [...t, { role: "user", text: clean }, { role: "bot", steps: [], startedAt, seconds: null, text: "", done: false }]);

      const updateBot = (fn: (turn: BotTurn) => BotTurn) =>
        setTurns((t) => {
          const i = t.findLastIndex((x) => x.role === "bot");
          if (i < 0) return t;
          const next = [...t];
          next[i] = fn(t[i] as BotTurn);
          return next;
        });

      let checkoutId: string | null = null;
      try {
        for await (const event of sendMessage(sessionId, clean)) {
          if (event.type === "options") event.items.forEach((p) => knownProducts.current.set(p.product_id, p));
          if (event.type === "checkout_request") checkoutId = event.product_id;
          if (event.type === "message_delta") spoken += event.text;
          if (event.type === "clarify") spoken += ` ${event.question}`;
          updateBot((turn) => applyEvent(turn, event));
        }
      } catch {
        updateBot((turn) => ({ ...turn, error: "การเชื่อมต่อขาดหาย ลองส่งใหม่อีกครั้งครับ" }));
      } finally {
        updateBot((turn) => ({ ...turn, done: true, seconds: (Date.now() - turn.startedAt) / 1000 }));
        setBusy(false);
      }
      if (checkoutId) openCheckout(checkoutId);
      // Spoken requests get a spoken answer; typed ones only when the speaker toggle is on.
      if ((fromMic || voiceOnRef.current) && spoken.trim()) botVoice.say(spoken.trim());
    },
    [sessionId, busy, openCheckout, botVoice],
  );

  async function toggleMic() {
    setMicError(null);
    if (mic.state === "recording") {
      try {
        const heard = await mic.stop();
        if (heard) send(heard, true);
        else setMicError("ไม่ได้ยินเสียง ลองพูดใหม่อีกครั้งครับ");
      } catch {
        setMicError("ฟังเสียงไม่ออก ลองพูดใหม่หรือพิมพ์แทนครับ");
      }
      return;
    }
    try {
      botVoice.stop();
      await mic.start();
    } catch {
      setMicError("เปิดไมค์ไม่ได้ อนุญาตไมค์ในเบราว์เซอร์ก่อนครับ");
    }
  }

  useEffect(() => {
    const q = params.get("q");
    if (!q || !sessionId || sentInitial.current) return;
    sentInitial.current = true;
    send(q);
  }, [params, sessionId, send]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-ground">
      <header className="flex items-center gap-2 border-b border-line bg-paper px-2 py-2.5 md:gap-3 md:px-7 md:py-0 md:h-[68px]">
        <MenuButton className="text-ink hover:bg-ground" />
        <div className="min-w-0 flex-1 md:flex md:items-center md:gap-3">
          <div className="text-[15px] font-semibold md:text-lg md:font-bold">Chatbot</div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-basil" />
            ค้นจากร้านบนแพลตฟอร์ม
          </div>
        </div>
        <button
          onClick={() => {
            const next = !voiceOn;
            setVoiceOn(next);
            voiceOnRef.current = next;
            if (!next) botVoice.stop();
          }}
          aria-pressed={voiceOn}
          aria-label={voiceOn ? "ปิดเสียง bot" : "ให้ bot พูดตอบ"}
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${voiceOn ? "bg-basil-soft text-basil" : "text-ink hover:bg-ground"}`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {voiceOn ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
        </button>
        <Link href="/orders" aria-label="ออเดอร์ของฉัน" className="flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-ground">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8h12l-1 12H7L6 8z" />
            <path d="M9 8a3 3 0 0 1 6 0" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4 md:px-6 md:py-6">
        {sessionError && (
          <div className="rounded-xl bg-danger-soft p-3 text-sm text-danger">
            {sessionError}{" "}
            <button className="underline" onClick={startSession}>
              ลองใหม่
            </button>
          </div>
        )}

        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <Magnet size={56} />
            <div>
              <h1 className="font-display text-xl font-semibold">{user ? `สวัสดี ${user.display_name}` : "สวัสดี"}</h1>
              <p className="mt-1 text-sm text-muted">บอกครั้งเดียวว่าอยากได้อะไร bot จะคัดให้ 3 ตัว</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  disabled={!sessionId}
                  onClick={() => send(s)}
                  className="min-h-11 rounded-xl border border-line bg-paper px-3.5 py-2 text-left text-[13.5px] hover:border-basil disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === "user")
            return (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-[18px] rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-paper">{turn.text}</p>
              </div>
            );
          if (turn.role === "order") return <OrderCard key={i} initial={turn.order} />;
          return <BotMessage key={i} turn={turn} disabled={busy} onReply={send} onBuy={(p) => setCheckout(p)} />;
        })}
        <div ref={bottom} />
        </div>
      </main>

      {micError && <p className="border-t border-line bg-danger-soft px-4 py-2 text-[13px] text-danger">{micError}</p>}
      <form onSubmit={onSubmit} className="border-t border-line bg-paper p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:border-0 md:bg-ground md:px-7 md:pb-5">
        <div className="mx-auto flex w-full max-w-3xl gap-2 md:rounded-full md:border-[1.5px] md:border-[#DDE2DE] md:bg-paper md:p-1.5">
        <button
          type="button"
          onClick={toggleMic}
          disabled={!sessionId || busy || mic.state === "transcribing"}
          aria-label={mic.state === "recording" ? "หยุดอัดแล้วส่ง" : "พูดแทนพิมพ์"}
          className={`flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 disabled:opacity-40 ${
            mic.state === "recording" ? "border-danger bg-danger text-paper" : "w-11 border-line-strong text-ink hover:border-basil hover:bg-basil-soft hover:text-basil"
          }`}
        >
          {mic.state === "recording" ? (
            <>
              <span className="h-3 w-3 rounded-sm bg-paper" />
              <span className="text-sm font-semibold tabular-nums">{mic.seconds}s</span>
            </>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          )}
        </button>
        <label htmlFor="chat-input" className="sr-only">
          ข้อความถึง bot
        </label>
        <input
          id="chat-input"
          value={mic.state === "transcribing" ? "กำลังฟัง..." : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mic.state === "recording" ? "กำลังอัดเสียง กดปุ่มแดงเมื่อพูดจบ" : "พิมพ์หรือกดไมค์บอกสิ่งที่อยากได้"}
          maxLength={2000}
          disabled={!sessionId || mic.state !== "idle"}
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-ground px-4 text-sm outline-none focus:border-basil"
        />
        <button
          type="submit"
          aria-label="ส่งข้อความ"
          disabled={!sessionId || busy || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-basil text-paper hover:bg-basil-dark disabled:opacity-40"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12l16-8-6 16-2-7z" />
          </svg>
        </button>
        </div>
      </form>

      {checkout && (
        <UPaySheet
          product={checkout}
          user={user}
          sessionId={sessionId}
          onClose={() => setCheckout(null)}
          onPaid={(order) => setTurns((t) => [...t, { role: "order", order }])}
        />
      )}
    </div>
  );
}

function BotMessage({
  turn,
  disabled,
  onReply,
  onBuy,
}: {
  turn: BotTurn;
  disabled: boolean;
  onReply: (text: string) => void;
  onBuy: (item: ProductOption) => void;
}) {
  const waiting = !turn.done && turn.steps.length === 0 && !turn.text;
  return (
    <div className="space-y-3">
      {waiting && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" />
          bot กำลังอ่านความต้องการ
        </div>
      )}
      {turn.steps.length > 0 && <StepsPanel steps={turn.steps} finished={turn.done} seconds={turn.seconds} />}
      {turn.text && <p className="max-w-[92%] rounded-[18px] rounded-bl-md border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed">{turn.text}</p>}

      {turn.clarify && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{turn.clarify.question}</p>
          <div className="flex flex-wrap gap-2">
            {turn.clarify.choices.map((c) => (
              <button
                key={c}
                disabled={disabled}
                onClick={() => onReply(c)}
                className="h-9 rounded-full border border-basil px-3.5 text-[13px] font-medium text-basil hover:bg-basil-soft disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {turn.options && turn.options.items.length > 0 && (
        <ProductWidget items={turn.options.items} disabled={disabled} onBuy={onBuy} onAsk={onReply} />
      )}

      {turn.options && turn.options.items.length === 0 && (
        <section aria-label="ไม่พบสินค้าที่ตรงเงื่อนไข" className="space-y-2.5 rounded-2xl border border-[#F0D7A6] bg-[#FFF6E5] p-3.5">
          <p className="text-[13.5px] text-[#2B1C00]">{turn.options.reason ?? "ไม่เจอสินค้าที่ตรงเงื่อนไข"}</p>
          <div className="text-xs font-semibold text-saffron-ink">ลองแบบนี้ไหม</div>
          <div className="flex flex-col gap-2">
            {turn.options.alternatives.map((a) => (
              <button
                key={a}
                disabled={disabled}
                onClick={() => onReply(a)}
                className="min-h-11 rounded-xl border border-[#E5C78C] bg-paper px-3.5 py-2 text-left text-[13.5px] hover:border-saffron hover:bg-[#FFFBF2] disabled:opacity-40"
              >
                {a}
              </button>
            ))}
          </div>
        </section>
      )}

      {turn.error && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">{turn.error}</p>}
    </div>
  );
}
