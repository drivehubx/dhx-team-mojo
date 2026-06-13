import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n-context";
import { LANGS, UI, type Lang } from "@/lib/i18n";
import { Check, LogOut, Languages } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DHX Team Ops" },
      { name: "description", content: "Manage your display language and account." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { lang, setLang, setUser } = useI18n();
  const labels = UI[lang ?? "en"];
  const navigate = useNavigate();

  const signOut = () => {
    setUser(null);
    navigate({ to: "/auth" });
  };

  return (
    <div>
      <AppHeader title={labels.settings} subtitle={labels.preferredLang} />

      <section className="px-5 -mt-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{labels.language}</p>
          </div>
          <ul className="space-y-2">
            {LANGS.map((l) => {
              const active = lang === l.code;
              return (
                <li key={l.code}>
                  <button
                    onClick={() => setLang(l.code as Lang)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    }`}
                  >
                    <span className="text-xl leading-none">{l.flag}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{l.native}</span>
                      <span className="block text-[11px] text-muted-foreground">{l.label}</span>
                    </span>
                    {active && <Check className="h-5 w-5 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="mt-6 px-5">
        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> {labels.signOut}
        </button>
      </div>
    </div>
  );
}
