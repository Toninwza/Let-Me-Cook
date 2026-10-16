"use client";

import { t } from "@/lib/i18n";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AgentEvent, Order, ProductOption, UserProfile, createSession, listProducts, sendMessage, transcribe } from "@/lib/api";
import { MAX_RECORD_S, WARN_RECORD_S, useBotVoice, useRecorder } from "@/lib/hooks";
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

type UserTurn = { role: "user"; text: string; vid?: number; voice?: "transcribing" | "failed"; blob?: Blob };

type Turn = UserTurn | BotTurn | { role: "order"; order: Order };

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
  const recorder = useRecorder((blob) => {
    setMode(null);
    setArmed(null);
    if (blob) submitVoice(blob);
  });
  const [micMode, setMicMode] = useState<null | "hold" | "tap">(null);
  const modeRef = useRef<null | "hold" | "tap">(null);
  const [armed, setArmed] = useState<null | "cancel">(null);
  const press = useRef<{ x: number; y: number; t: number; released: boolean; sendOnUp: boolean } | null>(null);
  const vidRef = useRef(0);
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
      setSessionError(t("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"));
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
    async (text: string, fromMic = false, vid?: number) => {
      const clean = text.trim();
      if (!clean || !sessionId || busy) return;
      setInput("");
      setBusy(true);
      botVoice.stop();
      let spoken = "";
      const startedAt = Date.now();
      const botTurn: BotTurn = { role: "bot", steps: [], startedAt, seconds: null, text: "", done: false };
      setTurns((t) =>
        vid === undefined
          ? [...t, { role: "user", text: clean }, botTurn]
          : [...t.map((x) => (x.role === "user" && x.vid === vid ? { role: "user" as const, text: clean } : x)), botTurn],
      );

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
        updateBot((turn) => ({ ...turn, error: t("การเชื่อมต่อขาดหาย ลองส่งใหม่อีกครั้งครับ") }));
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

  function setMode(m: null | "hold" | "tap") {
    modeRef.current = m;
    setMicMode(m);
  }

  async function transcribeTurn(vid: number, blob: Blob) {
    try {
      const heard = await transcribe(blob);
      if (!heard.trim()) throw new Error("empty");
      send(heard, true, vid);
    } catch {
      setTurns((t) => t.map((x) => (x.role === "user" && x.vid === vid ? { ...x, voice: "failed" as const } : x)));
    }
  }

  function submitVoice(blob: Blob) {
    const vid = ++vidRef.current;
    setTurns((t) => [...t, { role: "user", text: "", vid, voice: "transcribing", blob }]);
    transcribeTurn(vid, blob);
  }

  function retryVoice(turn: UserTurn) {
    if (turn.vid === undefined || !turn.blob) return;
    const { vid, blob } = turn;
    setTurns((t) => t.map((x) => (x.role === "user" && x.vid === vid ? { ...x, voice: "transcribing" as const } : x)));
    transcribeTurn(vid, blob);
  }

  async function endRecording(sendIt: boolean) {
    setMode(null);
    setArmed(null);
    if (!sendIt) {
      await recorder.cancel();
      return;
    }
    const blob = await recorder.stop();
    if (blob) submitVoice(blob);
    else setMicError(t("สั้นเกินไป กดค้างไว้แล้วพูดครับ"));
  }

  async function micDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return;
    if (modeRef.current === "tap") {
      press.current = { x: e.clientX, y: e.clientY, t: Date.now(), released: false, sendOnUp: true };
      return;
    }
    if (!sessionId || busy || recorder.recording) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    press.current = { x: e.clientX, y: e.clientY, t: Date.now(), released: false, sendOnUp: false };
    setMicError(null);
    botVoice.stop();
    try {
      await recorder.start();
    } catch {
      press.current = null;
      setMicError(t("เปิดไมค์ไม่ได้ อนุญาตไมค์ในเบราว์เซอร์ก่อนครับ"));
      return;
    }
    // Released before the mic was ready (permission prompt): behave like a tap.
    setMode(press.current?.released ? "tap" : "hold");
  }

  function micMove(e: React.PointerEvent<HTMLButtonElement>) {
    const p = press.current;
    if (!p || modeRef.current !== "hold") return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (dy < -70) {
      setMode("tap"); // slide up = lock, hands free from here
      setArmed(null);
    } else setArmed(dx < -70 ? "cancel" : null);
  }

  function micUp() {
    const p = press.current;
    if (!p) return;
    p.released = true;
    if (p.sendOnUp) {
      press.current = null;
      endRecording(true);
      return;
    }
    if (modeRef.current === "hold") {
      press.current = null;
      if (Date.now() - p.t < 300) setMode("tap");
      else endRecording(armed !== "cancel");
    }
    // mode still null: the mic is opening, micDown decides once it is ready
  }

  function micKey() {
    // keyboard users: Enter or Space toggles hands-free recording
    if (modeRef.current === "tap") endRecording(true);
    else if (!recorder.recording && sessionId && !busy) {
      botVoice.stop();
      setMicError(null);
      recorder
        .start()
        .then(() => setMode("tap"))
        .catch(() => setMicError(t("เปิดไมค์ไม่ได้ อนุญาตไมค์ในเบราว์เซอร์ก่อนครับ")));
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
            {t("ค้นจากร้านบนแพลตฟอร์ม")}
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
          aria-label={voiceOn ? t("ปิดเสียง bot") : t("ให้ bot พูดตอบ")}
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${voiceOn ? "bg-basil-soft text-basil" : "text-ink hover:bg-ground"}`}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {voiceOn ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
        </button>
        <Link href="/orders" aria-label={t("ออเดอร์ของฉัน")} className="flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-ground">
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
              {t("ลองใหม่")}
            </button>
          </div>
        )}

        {turns.length === 0 && (
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <Magnet size={56} />
            <div>
              <h1 className="font-display text-xl font-semibold">{user ? t("สวัสดี {name}", { name: user.display_name }) : t("สวัสดี")}</h1>
              <p className="mt-1 text-sm text-muted">{t("บอกครั้งเดียวว่าอยากได้อะไร bot จะคัดให้ 3 ตัว")}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  disabled={!sessionId}
                  onClick={() => send(t(s))}
                  className="min-h-11 rounded-xl border border-line bg-paper px-3.5 py-2 text-left text-[13.5px] hover:border-basil disabled:opacity-40"
                >
                  {t(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => {
          if (turn.role === "user" && turn.voice)
            return (
              <div key={i} className="flex justify-end">
                {turn.voice === "transcribing" ? (
                  <p className="flex max-w-[85%] items-center gap-2 rounded-[18px] rounded-br-md bg-ink px-3.5 py-2.5 text-sm text-paper/80">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" />
                    {t("กำลังถอดเสียง")}
                  </p>
                ) : (
                  <div className="flex max-w-[85%] items-center gap-2.5 rounded-[18px] rounded-br-md border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                    {t("ฟังเสียงไม่ออก")}
                    <button onClick={() => retryVoice(turn)} className="rounded-full bg-danger px-3 py-1 text-[12.5px] font-semibold text-paper">
                      {t("ลองส่งใหม่")}
                    </button>
                  </div>
                )}
              </div>
            );
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
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 md:rounded-full md:border-[1.5px] md:border-[#DDE2DE] md:bg-paper md:p-1.5">
          {recorder.recording ? (
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 pl-1" role="status" aria-live="polite">
              {micMode === "tap" && (
                <button
                  type="button"
                  onClick={() => endRecording(false)}
                  aria-label={t("ยกเลิกการอัด")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                  </svg>
                </button>
              )}
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-danger" />
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${recorder.seconds >= WARN_RECORD_S ? "text-danger" : "text-ink"}`}>
                {Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}
              </span>
              <div className="flex h-8 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden" aria-hidden="true">
                {recorder.levels.map((l, k) => (
                  <span key={k} className="w-[3px] shrink-0 rounded-full bg-basil" style={{ height: `${Math.round(l * 100)}%` }} />
                ))}
              </div>
              <span className={`hidden shrink-0 text-[12.5px] sm:block ${armed === "cancel" || recorder.seconds >= WARN_RECORD_S ? "font-semibold text-danger" : "text-muted"}`}>
                {recorder.seconds >= WARN_RECORD_S
                  ? t("ส่งอัตโนมัติใน {s} วิ", { s: MAX_RECORD_S - recorder.seconds })
                  : micMode === "hold"
                    ? armed === "cancel"
                      ? t("ปล่อยเพื่อยกเลิก")
                      : t("เลื่อนซ้ายยกเลิก, ขึ้นเพื่อล็อก")
                    : ""}
              </span>
            </div>
          ) : (
            <>
              <label htmlFor="chat-input" className="sr-only">
                {t("ข้อความถึง bot")}
              </label>
              <input
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("พิมพ์ หรือกดไมค์ค้างไว้เพื่อพูด")}
                maxLength={2000}
                disabled={!sessionId}
                className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-ground px-4 text-sm outline-none focus:border-basil"
              />
            </>
          )}
          {recorder.recording || !input.trim() ? (
            <button
              type="button"
              onPointerDown={micDown}
              onPointerMove={micMove}
              onPointerUp={micUp}
              onPointerCancel={micUp}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => e.detail === 0 && micKey()}
              disabled={!recorder.recording && (!sessionId || busy)}
              aria-label={micMode === "tap" ? t("ส่งเสียง") : t("กดค้างเพื่อพูด หรือแตะเพื่ออัดแบบไม่ต้องถือ")}
              className={`flex shrink-0 touch-none select-none items-center justify-center rounded-full transition-all disabled:opacity-40 ${
                micMode === "hold"
                  ? `h-14 w-14 ${armed === "cancel" ? "bg-ink" : "bg-danger"} text-paper shadow-lg`
                  : micMode === "tap"
                    ? "h-11 w-11 bg-basil text-paper hover:bg-basil-dark"
                    : "h-11 w-11 border border-line-strong text-ink hover:border-basil hover:bg-basil-soft hover:text-basil"
              }`}
            >
              {micMode === "tap" ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 12l16-8-6 16-2-7z" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              )}
            </button>
          ) : (
            <button
              type="submit"
              aria-label={t("ส่งข้อความ")}
              disabled={!sessionId || busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-basil text-paper hover:bg-basil-dark disabled:opacity-40"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12l16-8-6 16-2-7z" />
              </svg>
            </button>
          )}
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
          {t("bot กำลังอ่านความต้องการ")}
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
        <section aria-label={t("ไม่พบสินค้าที่ตรงเงื่อนไข")} className="space-y-2.5 rounded-2xl border border-[#F0D7A6] bg-[#FFF6E5] p-3.5">
          <p className="text-[13.5px] text-[#2B1C00]">{turn.options.reason ?? t("ไม่เจอสินค้าที่ตรงเงื่อนไข")}</p>
          <div className="text-xs font-semibold text-saffron-ink">{t("ลองแบบนี้ไหม")}</div>
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
