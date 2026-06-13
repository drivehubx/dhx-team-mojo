import { Bell } from "lucide-react";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-[--color-navy] text-[--color-navy-foreground] pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">DHX Team Ops</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        </div>
        <button
          aria-label="Notifications"
          className="relative grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[--color-warning]" />
        </button>
      </div>
    </header>
  );
}
