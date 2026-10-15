"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speak } from "@/lib/api";

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

export const MAX_RECORD_S = 120;
export const WARN_RECORD_S = 110;
const MIN_RECORD_MS = 600;
const BARS = 28;

/** Mic recorder. start() asks for the mic; stop() returns the audio (null when shorter than
 *  0.6 s); cancel() throws it away. At MAX_RECORD_S it stops by itself and calls onLimit. */
export function useRecorder(onLimit?: (blob: Blob | null) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const cleanup = useRef<(() => void) | null>(null);
  const limitRef = useRef(onLimit);
  useEffect(() => {
    limitRef.current = onLimit;
  });

  const finish = useCallback((keep: boolean) => {
    return new Promise<Blob | null>((resolve) => {
      const r = rec.current;
      if (!r || r.state === "inactive") {
        resolve(null);
        return;
      }
      const long = Date.now() - startedAt.current >= MIN_RECORD_MS;
      r.onstop = () => {
        cleanup.current?.();
        cleanup.current = null;
        rec.current = null;
        setRecording(false);
        resolve(keep && long ? new Blob(chunks.current, { type: r.mimeType }) : null);
      };
      r.stop();
    });
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(s);
      if (s >= MAX_RECORD_S) finish(true).then((b) => limitRef.current?.(b));
    }, 250);
    return () => clearInterval(timer);
  }, [recording, finish]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);

    // Live level for the waveform. Optional: the recording works without it.
    let meter: ReturnType<typeof setInterval> | null = null;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      meter = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        const level = Math.min(1, 0.08 + (peak / 128) * 1.6);
        setLevels((l) => [...l.slice(1), level]);
      }, 70);
    } catch {
      // no analyser, flat bars
    }

    cleanup.current = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (meter) clearInterval(meter);
      ctx?.close().catch(() => {});
      setLevels(Array(BARS).fill(0.08));
    };
    rec.current = r;
    startedAt.current = Date.now();
    r.start();
    setSeconds(0);
    setRecording(true);
  }, []);

  const stop = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(async () => {
    await finish(false);
  }, [finish]);

  useEffect(() => () => cleanup.current?.(), []);

  return { recording, seconds, levels, start, stop, cancel };
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
