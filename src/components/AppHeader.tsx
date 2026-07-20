import { Bell } from "lucide-react";
import { useT } from "@/lib/i18n";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-40 mb-4 bg-navy text-navy-foreground pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-navy-foreground/60">{t("common.brand")}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-navy-foreground/70">{subtitle}</p>}
        </div>
        <button
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-navy-foreground/10 text-navy-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warning" />
        </button>
      </div>
    </header>
  );
}
