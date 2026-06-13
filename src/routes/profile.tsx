import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { currentUser, salaries, fmtMYR, netSalary, advanceBalance } from "@/lib/mock-data";
import { useI18n } from "@/lib/i18n-context";
import { langMeta, UI } from "@/lib/i18n";
import { Phone, IdCard, FileText, Settings, LogOut, ChevronRight, Wallet, Clock4, HandCoins, Languages } from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DHX Team Ops" },
      { name: "description", content: "Your profile and personal workshop stats." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const mySalary = salaries.find((s) => s.employeeId === currentUser.id);
  const myAdvance = advanceBalance(currentUser.id);

  return (
    <div>
      <AppHeader title="Profile" />

      <div className="px-5 -mt-4">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
            {currentUser.initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser.role}</p>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <IdCard className="h-3 w-3" /> EMP-{currentUser.id.toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">This month</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Wallet} label="Salary" value={mySalary ? fmtMYR(netSalary(mySalary)) : "—"} />
          <StatCard icon={Clock4} label="OT hrs" value={mySalary ? String(Math.round(mySalary.ot / 20)) : "0"} />
          <StatCard icon={HandCoins} label="Advance" value={fmtMYR(myAdvance.balance)} />
        </div>
      </section>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Account</h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <Row icon={Phone} label="Phone" value={currentUser.phone} />
          <Row icon={FileText} label="Documents" value="2 files" />
          <Row icon={Settings} label="Settings" value="" />
        </ul>
      </section>

      <div className="mt-6 px-5">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm font-semibold text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">DHX Team Ops · v1.0</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-2 text-sm font-semibold tracking-tight truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 p-3.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {value && <p className="text-[11px] text-muted-foreground truncate">{value}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </li>
  );
}
