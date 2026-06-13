import { Bell, Languages } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n-context";
import { langMeta } from "@/lib/i18n";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { lang, showOriginal, toggleShowOriginal, t } = useI18n();
  const flag = lang ? langMeta(lang).flag : "🌐";

  return (
    <header className="sticky top-0 z-40 bg-[--color-navy] text-[--color-navy-foreground] pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-white/60">DHX Team Ops</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleShowOriginal}
            aria-label={showOriginal ? t("showTranslation") : t("showOriginal")}
            title={showOriginal ? t("showTranslation") : t("showOriginal")}
            className={`grid h-10 px-2.5 place-items-center rounded-full text-[11px] font-semibold gap-1 flex-row flex transition-colors ${
              showOriginal ? "bg-white text-[--color-navy]" : "bg-white/10 text-white"
            }`}
          >
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">
              {showOriginal ? t("original") : t("translated")}
            </span>
          </button>
          <Link
            to="/settings"
            aria-label={t("language")}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-base"
          >
            {flag}
          </Link>
          <button
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[--color-warning]" />
          </button>
        </div>
      </div>
    </header>
  );
}
