"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EN } from "@/lib/en";

export type Lang = "th" | "en";

const STORAGE_KEY = "pull-lang";

// The Thai text in the code is the key. English comes from lib/en.ts; a missing entry shows Thai.
let current: Lang = "th";

// t() is a plain function that components call while rendering, so it needs the language before they render.
// Writing it here, ahead of the children, keeps the first draw in the right language.
function applyLang(next: Lang) {
  current = next;
}

/** Translate a Thai UI string. Works anywhere at render time; {name} placeholders take values from vars. */
export function t(th: string, vars?: Record<string, string | number>): string {
  let out = current === "en" ? (EN[th] ?? th) : th;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export const locale = () => (current === "en" ? "en-GB" : "th-TH");

type LangState = { lang: Lang; setLang: (next: Lang) => void };
const LangContext = createContext<LangState>({ lang: "th", setLang: () => {} });

export function useLang() {
  return useContext(LangContext);
}

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

export default function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");
  applyLang(lang);

  // Read the saved choice after hydration so the first render matches the server (Thai).
  useEffect(() => {
    const timer = setTimeout(() => setLangState(readStored()), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode: the choice lasts until reload
    }
    setLangState(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);

  // Remount on change so every component, including ones that never read the context, redraws in the new language.
  return (
    <LangContext.Provider value={value}>
      <div key={lang} className="contents">
        {children}
      </div>
    </LangContext.Provider>
  );
}
