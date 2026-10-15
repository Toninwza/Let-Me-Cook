"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AgentSteps, Step } from "@/components/agent-steps";
import { DecisionCard } from "@/components/decision-card";
import { OrderCard } from "@/components/order-card";
import { ProfilePanel } from "@/components/profile-panel";
import { UPaySheet } from "@/components/upay-sheet";
import {
  AgentEvent,
  ApiError,
  Order,
  ProductHit,
  ProductOption,
  UserProfile,
  createSession,
  listProducts,
  sendMessage,
} from "@/lib/api";
import { useBotVoice, useVoiceInput } from "@/lib/hooks";

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

type Turn = { role: "user"; text: string; voice: boolean } | BotTurn | { role: "receipt"; order: Order };

type Checkout = { product: ProductHit; quantity: number };

const EXAMPLES = [
  "หาเก้าอี้ทำงาน ergonomic งบ 3,000 ส่งภายในวันอาทิตย์",
  "นั่งทำงานทั้งวันแล้วปวดหลัง อยากได้อะไรช่วย",
  "หูฟังใส่ออกกำลังกาย งบไม่เกิน 1,500",
  "อุปกรณ์เรียนออนไลน์และจดโน้ต งบ 5,000",
];

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
    case "checkout_request":
      return { ...turn, checkout: { product_id: event.product_id, quantity: event.quantity } };
    case "error":
      return { ...turn, error: event.message };
    case "done":
      return { ...turn, done: true };
  }
}

/** What the bot says out loud for a finished turn. */
function spokenText(turn: BotTurn) {
  if (turn.error) return "";
  const parts = [turn.text.trim()];
  if (turn.clarify) parts.push(turn.clarify.question);
  if (turn.options && turn.options.items.length === 0 && turn.options.reason) parts.push(turn.options.reason);
  return parts.filter(Boolean).join(" ");
}

export default function Chat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const products = useRef(new Map<string, ProductHit>());
  const started = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const mic = useVoiceInput();
  const bot = useBotVoice();

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

  async function findProduct(id: string) {
    const known = products.current.get(id);
    if (known) return known;
    const all = await listProducts();
    all.forEach((p) => products.current.set(p.product_id, p));
    return products.current.get(id) ?? null;
  }

  async function openCheckout(productId: string, quantity: number) {
    bot.stop();
    const product = await findProduct(productId).catch(() => null);
    if (product) setCheckout({ product, quantity });
  }

  async function send(text: string, voice = false) {
    const clean = text.trim();
    if (!clean || !sessionId || busy) return;
    bot.stop();
    setInput("");
    setBusy(true);
    let turn: BotTurn = { role: "bot", steps: [], text: "", done: false };
    setTurns((t) => [...t, { role: "user", text: clean, voice }, turn]);
    const show = (next: BotTurn) => {
      turn = next;
      setTurns((t) => [...t.slice(0, -1), next]);
    };

    try {
      for await (const event of sendMessage(sessionId, clean)) {
        show(applyEvent(turn, event));
        if (event.type === "options") event.items.forEach((p) => products.current.set(p.product_id, p));
      }
    } catch {
      show({ ...turn, error: "การเชื่อมต่อขาดหาย ลองส่งใหม่อีกครั้งครับ" });
    } finally {
      show({ ...turn, done: true });
      setBusy(false);
    }

    if (voiceOn) bot.say(spokenText(turn));
    if (turn.checkout) openCheckout(turn.checkout.product_id, turn.checkout.quantity);
  }

  async function toggleMic() {
    setMicError(null);
    if (mic.state === "recording") {
      try {
        const text = await mic.stop();
        if (text) send(text, true);
      } catch (e) {
        setMicError(e instanceof ApiError ? e.message : "แปลงเสียงไม่สำเร็จ ลองใหม่อีกครั้งครับ");
      }
      return;
    }
    try {
      bot.stop();
      await mic.start();
    } catch {
      setMicError("เปิดไมโครโฟนไม่ได้ ตรวจสิทธิ์การใช้ไมค์ในเบราว์เซอร์");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function onPaid(order: Order) {
    setTurns((t) => [...t, { role: "receipt", order }]);
    if (voiceOn) bot.say(`ชำระเงินเรียบร้อยแล้วครับ ของจะส่งถึงตามกำหนด`);
  }

  const ready = Boolean(sessionId);
  const recording = mic.state === "recording";

  return (
    <div className="flex min-h-dvh justify-center bg-linear-to-br from-violet-100 via-white to-fuchsia-100 sm:items-center sm:p-4 lg:p-6">
      <div className="flex h-dvh w-full overflow-hidden bg-[#faf9ff] sm:h-[calc(100dvh-2rem)] sm:max-w-2xl sm:rounded-[2rem] sm:shadow-2xl sm:ring-1 sm:ring-violet-100 lg:h-[min(56rem,calc(100dvh-3rem))] lg:max-w-6xl">
        <aside className="hidden w-80 shrink-0 border-r border-violet-100 bg-violet-50/40 lg:block">
          <ProfilePanel user={user} />
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 bg-white/90 px-4 py-3 backdrop-blur">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white shadow-md shadow-violet-200">
            LM
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-semibold">Let-Me-Cook</h1>
            <p className="truncate text-[11px] text-neutral-500">
              {bot.speaking ? "🔊 bot กำลังพูด..." : busy ? "bot กำลังหาของให้..." : "AI ผู้ช่วยช้อปปิ้ง บอกครั้งเดียว จบในแชต"}
            </p>
          </div>
          <button
            onClick={() => {
              if (voiceOn) bot.stop();
              setVoiceOn(!voiceOn);
            }}
            aria-label={voiceOn ? "ปิดเสียงตอบ" : "เปิดเสียงตอบ"}
            title={voiceOn ? "ปิดเสียงตอบ" : "เปิดเสียงตอบ"}
            className={`grid h-9 w-9 place-items-center rounded-full text-base ${voiceOn ? "bg-violet-100 text-violet-700" : "bg-neutral-100 text-neutral-400"}`}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
          <Link
            href="/shop"
            title="หน้าร้านค้า"
            className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-base hover:bg-neutral-200"
          >
            🏪
          </Link>
        </header>

        {user && (
          <div className="flex items-center gap-2 border-y border-violet-100 bg-violet-50/70 px-4 py-1.5 text-[11px] text-violet-800 lg:hidden">
            <span className="rounded-full bg-violet-600 px-1.5 py-px font-semibold text-white">U-Tag</span>
            <span className="truncate">
              {user.display_name} · ส่วนลด {user.discount_percent}% · ส่งที่ {user.address.district} {user.address.province}
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-5">
          {sessionError && (
            <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
              {sessionError}{" "}
              <button className="font-medium underline" onClick={startSession}>
                ลองใหม่
              </button>
            </div>
          )}

          {turns.length === 0 && !sessionError && (
            <section className="animate-rise space-y-4 pt-6 text-center sm:pt-12">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-3xl shadow-lg shadow-violet-200">
                🛍️
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {user ? `สวัสดีครับ ${user.display_name}` : "กำลังเชื่อมต่อ..."}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  พิมพ์หรือกดไมค์บอกสิ่งที่อยากได้ bot จะคัดมาให้ 3 ตัว แล้วจ่ายได้ในแชต
                </p>
              </div>
              <div className="grid gap-2 text-left sm:grid-cols-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    disabled={!ready || busy}
                    onClick={() => send(ex)}
                    className="rounded-2xl bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm ring-1 ring-violet-100 transition hover:ring-violet-300 disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </section>
          )}

          {turns.map((turn, i) => {
            if (turn.role === "user")
              return (
                <div key={i} className="animate-rise flex justify-end">
                  <p className="max-w-[85%] rounded-3xl rounded-br-md bg-linear-to-br from-violet-600 to-fuchsia-600 px-4 py-2.5 text-sm text-white shadow-sm">
                    {turn.voice && <span className="mr-1 opacity-80">🎙️</span>}
                    {turn.text}
                  </p>
                </div>
              );
            if (turn.role === "receipt")
              return (
                <div key={i} className="pl-10 md:max-w-md">
                  <OrderCard initial={turn.order} />
                </div>
              );
            return (
              <BotMessage
                key={i}
                turn={turn}
                utagPercent={user?.discount_percent ?? 0}
                disabled={busy}
                onReply={send}
                onBuy={(id) => openCheckout(id, 1)}
              />
            );
          })}
          <div ref={bottom} />
          </div>
        </main>

        <footer className="space-y-2 bg-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          {micError && <p className="mx-auto max-w-3xl px-2 text-xs text-red-600">{micError}</p>}
          <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!ready || busy || mic.state === "transcribing"}
              aria-label={recording ? "หยุดอัดเสียงและส่ง" : "พูดแทนการพิมพ์"}
              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg transition disabled:opacity-40 ${
                recording ? "bg-red-500 text-white" : "bg-violet-100 text-violet-700 hover:bg-violet-200"
              }`}
            >
              {recording && <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-60" />}
              <span className="relative">{mic.state === "transcribing" ? "…" : recording ? "■" : "🎙️"}</span>
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                recording
                  ? `กำลังฟัง... ${mic.seconds}s กดปุ่มแดงเมื่อพูดจบ`
                  : mic.state === "transcribing"
                    ? "กำลังแปลงเสียงเป็นข้อความ..."
                    : "บอกสิ่งที่อยากได้ เช่น งบ วันที่อยากได้"
              }
              maxLength={2000}
              disabled={!ready || recording}
              className="min-w-0 flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm outline-none ring-violet-300 placeholder:text-neutral-400 focus:bg-white focus:ring-2"
            />
            <button
              type="submit"
              disabled={!ready || busy || !input.trim()}
              aria-label="ส่ง"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-md transition hover:brightness-110 disabled:opacity-40"
            >
              ➤
            </button>
          </form>
        </footer>
        </section>
      </div>

      {checkout && user && (
        <UPaySheet
          product={checkout.product}
          initialQuantity={checkout.quantity}
          user={user}
          sessionId={sessionId}
          onClose={() => setCheckout(null)}
          onPaid={onPaid}
        />
      )}
    </div>
  );
}

function BotMessage({
  turn,
  utagPercent,
  disabled,
  onReply,
  onBuy,
}: {
  turn: BotTurn;
  utagPercent: number;
  disabled: boolean;
  onReply: (text: string) => void;
  onBuy: (productId: string) => void;
}) {
  const waiting = !turn.done && turn.steps.length === 0 && !turn.text;
  return (
    <div className="flex gap-2">
      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-[10px] font-bold text-white">
        LM
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        {waiting && (
          <div className="flex w-fit gap-1 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-violet-100">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${d * 120}ms` }} />
            ))}
          </div>
        )}

        <AgentSteps steps={turn.steps} done={turn.done} />

        {turn.text && (
          <p className="animate-rise w-fit max-w-full rounded-3xl rounded-tl-md bg-white px-4 py-2.5 text-sm leading-relaxed shadow-sm ring-1 ring-violet-100">
            {turn.text}
          </p>
        )}

        {turn.clarify && (
          <div className="animate-rise space-y-2">
            <p className="w-fit rounded-3xl rounded-tl-md bg-white px-4 py-2.5 text-sm font-medium shadow-sm ring-1 ring-violet-100">
              {turn.clarify.question}
            </p>
            <Chips items={turn.clarify.choices} disabled={disabled} onPick={onReply} />
          </div>
        )}

        {turn.options && turn.options.items.length > 0 && (
          <div className="rail -mr-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 md:mr-0 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:pr-0">
            {turn.options.items.map((item, idx) => (
              <DecisionCard
                key={item.product_id}
                item={item}
                rank={idx + 1}
                utagPercent={utagPercent}
                disabled={disabled}
                onBuy={() => onBuy(item.product_id)}
              />
            ))}
          </div>
        )}

        {turn.options && turn.options.items.length === 0 && (
          <div className="animate-rise space-y-2.5 rounded-3xl bg-amber-50 p-4 text-sm ring-1 ring-amber-200">
            <p className="text-amber-900">{turn.options.reason ?? "ไม่เจอสินค้าที่ตรงเงื่อนไข"}</p>
            <Chips items={turn.options.alternatives} disabled={disabled} onPick={onReply} />
          </div>
        )}

        {turn.error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{turn.error}</p>}
      </div>
    </div>
  );
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
          className="rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-violet-700 shadow-sm ring-1 ring-violet-200 transition hover:bg-violet-50 disabled:opacity-40"
        >
          {item}
        </button>
      ))}
    </div>
  );
}
