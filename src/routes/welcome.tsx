import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LANGS, type Lang, UI } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-context";
import { Check, Languages } from "lucide-react";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome — DHX Team Ops" },
      { name: "description", content: "Choose your display language to get started." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { setLang, user } = useI18n();
  const navigate = useNavigate();
  const [pick, setPick] = useState<Lang>("en");
  const labels = UI[pick];

  const submit = () => {
    setLang(pick);
    navigate({ to: user ? "/" : "/auth" });
  };

  return (
    <div className="min-h-screen bg-[--color-navy] text-white px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-10 flex flex-col">
      <div className="flex items-center gap-2">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
          <Languages className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/60">DHX Team Ops</p>
          <p className="text-sm font-semibold">{labels.chooseLang}</p>
        </div>
      </div>

      <div className="mt-10">
        <h1 className="text-2xl font-semibold leading-tight">{labels.chooseLang}</h1>
        <p className="mt-2 text-sm text-white/70">{labels.chooseLangSub}</p>
      </div>

      <ul className="mt-8 space-y-3 flex-1">
        {LANGS.map((l) => {
          const active = pick === l.code;
          return (
            <li key={l.code}>
              <button
                onClick={() => setPick(l.code)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                  active
                    ? "border-white bg-white text-[--color-navy]"
                    : "border-white/20 bg-white/5 text-white"
                }`}
              >
                <span className="text-2xl leading-none">{l.flag}</span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold">{l.native}</span>
                  <span className={`block text-[11px] ${active ? "text-[--color-navy]/70" : "text-white/60"}`}>
                    {l.label}
                  </span>
                </span>
                {active && <Check className="h-5 w-5" />}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        onClick={submit}
        className="mt-6 w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-[--color-navy] shadow-lg active:scale-[0.99]"
      >
        {labels.continue}
      </button>
    </div>
  );
}
