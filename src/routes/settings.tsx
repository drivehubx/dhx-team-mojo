import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, User, Languages, KeyRound, LogOut, FlaskConical, Check } from "lucide-react";
import { toast } from "sonner";
import { useT, LanguagePicker } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DHX Team Ops" },
      { name: "description", content: "Account, language, and session settings." },
    ],
  }),
  component: SettingsPage,
});

const DEV_ROLE_KEY = "dhx:dev:role";
const SESSION_KEYS = ["dhx:profile:phone", "dhx:dev:role"];

type DevRole = "worker" | "manager" | "owner";

function SettingsPage() {
  const { t, tr } = useT();
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [devRole, setDevRole] = useState<DevRole | null>(null);
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    const v = localStorage.getItem(DEV_ROLE_KEY) as DevRole | null;
    if (v) setDevRole(v);
  }, []);

  const switchRole = (r: DevRole) => {
    localStorage.setItem(DEV_ROLE_KEY, r);
    setDevRole(r);
    toast.success(`${tr("Role")}: ${tr(r === "worker" ? "Worker" : r === "manager" ? "Manager" : "Owner")}`);
  };

  const doLogout = () => {
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
    setConfirmLogout(false);
    toast.success(tr("Signed out"));
    router.navigate({ to: "/login" });
  };

  return (
    <div>
      <header className="sticky top-0 z-40 bg-[--color-navy] text-[--color-navy-foreground] pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            aria-label={tr("Back")}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">{t("common.brand")}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tr("Settings")}</h1>
          </div>
        </div>
      </header>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {tr("Account")}
        </h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <Link to="/profile">
            <Row icon={User} label={tr("Profile")} />
          </Link>
          <button onClick={() => setPickerOpen(true)} className="w-full text-left">
            <Row icon={Languages} label={tr("Change Language")} />
          </button>
          <button
            onClick={() => toast.info(tr("Password change coming soon"))}
            className="w-full text-left"
          >
            <Row icon={KeyRound} label={tr("Change Password")} />
          </button>
        </ul>
      </section>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {tr("Session")}
        </h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full text-left"
          >
            <Row icon={LogOut} label={tr("Logout")} destructive />
          </button>
        </ul>
      </section>

      {isDev && (
        <section className="mt-5 px-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> {tr("Developer")}
          </h2>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs text-muted-foreground mb-2">{tr("Switch Role")}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["worker", "manager", "owner"] as DevRole[]).map((r) => {
                const active = devRole === r;
                const label = r === "worker" ? tr("Worker") : r === "manager" ? tr("Manager") : tr("Owner");
                return (
                  <button
                    key={r}
                    onClick={() => switchRole(r)}
                    className={`flex items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground"
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {tr("Open Skills, Team or Salary with ?role= to preview.")}
            </p>
          </div>
        </section>
      )}

      <p className="mt-6 mb-4 text-center text-[11px] text-muted-foreground">{t("common.brand")} · v1.0</p>

      {pickerOpen && <LanguagePicker onClose={() => setPickerOpen(false)} />}

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Logout?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr("You will be returned to the login screen.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doLogout}>{tr("Logout")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  destructive,
}: {
  icon: typeof User;
  label: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          destructive ? "bg-destructive/10 text-destructive" : "bg-secondary text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className={`flex-1 text-sm font-medium ${destructive ? "text-destructive" : ""}`}>{label}</p>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
