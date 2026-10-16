"use client";

import { Lang, t, useLang } from "@/lib/i18n";
import { MenuButton } from "@/components/app-shell";

// Each language is named in itself, so it stays readable whichever language is on.
const LANGUAGES: { key: Lang; name: string; sample: string }[] = [
  { key: "th", name: "ไทย", sample: "สวัสดี" },
  { key: "en", name: "English", sample: "Hello" },
];

export default function Settings() {
  const { lang, setLang } = useLang();
  return (
    <div className="h-full overflow-y-auto bg-ground">
      <header className="sticky top-0 z-10 flex h-[60px] items-center gap-1 border-b border-line bg-paper px-2 md:h-[68px] md:px-8">
        <MenuButton className="text-ink hover:bg-ground" />
        <h1 className="text-base font-bold md:text-lg">{t("ตั้งค่า")}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-4 md:px-8 md:py-7">
        <section className="flex flex-col gap-3.5 rounded-2xl bg-paper p-4 md:rounded-[18px] md:p-5">
          <div>
            <h2 className="text-[15px] font-bold">{t("ภาษา")}</h2>
            <p className="text-[12.5px] text-muted">{t("เลือกภาษาที่ใช้แสดงในแอป")}</p>
          </div>
          <div role="radiogroup" aria-label={t("ภาษา")} className="grid gap-2.5 sm:grid-cols-2">
            {LANGUAGES.map((l) => {
              const on = lang === l.key;
              return (
                <button
                  key={l.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLang(l.key)}
                  className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors ${
                    on ? "border-basil bg-basil-soft" : "border-line-strong bg-paper hover:border-basil"
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="font-semibold">{l.name}</span>
                    <span className="text-xs text-muted">{l.sample}</span>
                  </span>
                  <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full ${on ? "border-[6px] border-basil" : "border-2 border-faint"}`} />
                </button>
              );
            })}
          </div>
          {lang === "en" && <p className="text-[12.5px] text-muted">{t("คำตอบของ bot ยังเป็นภาษาไทย")}</p>}
        </section>
      </div>
    </div>
  );
}
