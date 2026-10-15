"use client";

import { useState } from "react";
import type { StepStatus } from "@/lib/api";

export type Step = { id: string; label: string; status: StepStatus; detail: string | null };

/** The bot's live work log. Folds into one line once the turn is done. */
export function AgentSteps({ steps, done }: { steps: Step[]; done: boolean }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  const failed = steps.some((s) => s.status === "error");

  if (done && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs text-neutral-500 ring-1 ring-violet-100 hover:text-violet-700"
      >
        <StepIcon status={failed ? "error" : "done"} />
        {failed ? "บางขั้นตอนขัดข้อง" : `ทำครบ ${steps.length} ขั้นตอน`}
        <span aria-hidden>▾</span>
      </button>
    );
  }

  return (
    <ol className="animate-rise space-y-1.5 rounded-2xl bg-white/80 p-3 text-xs ring-1 ring-violet-100">
      {steps.map((step) => (
        <li key={step.id} className="flex gap-2">
          <StepIcon status={step.status} />
          <span className="leading-relaxed">
            <span className={step.status === "error" ? "text-red-600" : "font-medium text-neutral-800"}>
              {step.label}
            </span>
            {step.detail && <span className="text-neutral-500"> · {step.detail}</span>}
          </span>
        </li>
      ))}
      {done && (
        <li>
          <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-violet-700">
            ย่อ ▴
          </button>
        </li>
      )}
    </ol>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "running")
    return (
      <span className="mt-0.5 inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
    );
  if (status === "error")
    return (
      <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-red-500 text-[9px] text-white">
        ✕
      </span>
    );
  return (
    <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-emerald-500 text-[9px] text-white">
      ✓
    </span>
  );
}
