"use client";

import { useState } from "react";
import type { StepStatus } from "@/lib/api";

export type Step = { id: string; label: string; status: StepStatus; detail: string | null };

export default function StepsPanel({ steps, finished, seconds }: { steps: Step[]; finished: boolean; seconds: number | null }) {
  const [open, setOpen] = useState(false);
  const expanded = !finished || open;
  const failed = steps.some((s) => s.status === "error");

  return (
    <section aria-label="ขั้นตอนที่ bot ทำ" className="rounded-2xl border border-line bg-paper px-4 py-3 text-[13px]">
      {finished ? (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 text-left text-xs font-semibold text-muted"
        >
          <span className={`h-2 w-2 rounded-full ${failed ? "bg-danger" : "bg-basil"}`} />
          <span className="flex-1">
            bot ทำงาน {steps.length} ขั้น{seconds !== null ? ` · ${seconds.toFixed(1)} วินาที` : ""}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-90" : ""}`}>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-saffron" />
          bot กำลังทำงาน
        </div>
      )}
      {expanded && (
        <ol className="mt-2 space-y-1.5">
          {steps.map((s) => (
            <li key={s.id} className="flex gap-2">
              <StepIcon status={s.status} />
              <span>
                <span className={`font-medium ${s.status === "error" ? "text-danger" : ""}`}>{s.label}</span>
                {s.detail && <span className="text-muted"> {s.detail}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running")
    return <span className="mt-1 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-basil border-t-transparent" />;
  if (status === "error")
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" className="mt-0.5 shrink-0 text-danger">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-basil">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}
