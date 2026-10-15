"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speak, transcribe } from "@/lib/api";

/** Calls `fn` every `ms` while `active` (first call right away when `immediate`).
 *  Waits for each call to finish before scheduling the next. */
export function usePoll(fn: () => Promise<unknown>, ms: number, active: boolean, immediate = false) {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        await latest.current();
      } catch {
        // keep polling; the next tick may succeed
      }
      if (!stopped) timer = setTimeout(tick, ms);
    };
    timer = setTimeout(tick, immediate ? 0 : ms);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [ms, active, immediate]);
}

const MAX_RECORD_S = 30;

/** Push-to-talk: start() asks for the mic, stop() returns the recording transcribed to text. */
export function useVoiceInput() {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const finished = useRef<((blob: Blob) => void) | null>(null);

  useEffect(() => {
    if (state !== "recording") return;
    const started = Date.now();
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setSeconds(s);
      if (s >= MAX_RECORD_S) recorder.current?.stop();
    }, 250);
    return () => clearInterval(timer);
  }, [state]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      finished.current?.(new Blob(chunks.current, { type: rec.mimeType }));
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setState("recording");
  }, []);

  const stop = useCallback(async (): Promise<string> => {
    const rec = recorder.current;
    if (!rec || rec.state === "inactive") return "";
    const blob = await new Promise<Blob>((resolve) => {
      finished.current = resolve;
      rec.stop();
    });
    setState("transcribing");
    try {
      return await transcribe(blob);
    } finally {
      setState("idle");
    }
  }, []);

  return { state, seconds, start, stop };
}

/** Plays the bot's reply through /api/voice/speak. A new reply stops the previous one. */
export function useBotVoice() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const turn = useRef(0);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    turn.current += 1;
    audio.current?.pause();
    audio.current = null;
    setSpeaking(false);
  }, []);

  const say = useCallback(
    async (text: string) => {
      stop();
      const mine = turn.current;
      if (!text.trim()) return;
      try {
        const blob = await speak(text);
        if (mine !== turn.current) return; // user moved on while the audio was being made
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        audio.current = el;
        el.onended = () => {
          URL.revokeObjectURL(url);
          setSpeaking(false);
        };
        setSpeaking(true);
        await el.play();
      } catch {
        setSpeaking(false); // voice is a bonus; the text is already on screen
      }
    },
    [stop],
  );

  return { say, stop, speaking };
}
