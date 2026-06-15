import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Wrench, Wallet, HandCoins, ArrowRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AvatarStack } from "@/components/Avatar";
import { currentUser, jobs, totals, fmtMYR, getEmployee } from "@/lib/mock-data";
import { useT, tStatus } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DHX Team Ops" },
      { name: "description", content: "Workshop operations dashboard for DHX Team Ops." },
    ],
  }),
  component: Dashboard,
});

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${accent}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Dashboard() {
  const { t, tr } = useT();
  const todayJobs = jobs.filter((j) => j.status !== "Completed").slice(0, 3);

  const activity = [
    { icon: CheckCircle2, color: "text-[--color-success]", text: tr("PNG 2210 marked Completed"), time: tr("1h ago") },
    { icon: HandCoins, color: "text-[--color-warning]", text: tr("Rizal requested RM250 advance"), time: tr("3h ago") },
    { icon: Wallet, color: "text-primary", text: tr("Suresh's salary paid for May"), time: tr("Yesterday") },
    { icon: AlertCircle, color: "text-destructive", text: tr("JKL 4421 waiting for parts"), time: tr("2d ago") },
  ];

  return (
    <div>
      <AppHeader title={`${t("page.dashboard.greet")}, ${currentUser.name.split(" ")[0]}`} subtitle={tr(currentUser.role)} />

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label={t("page.dashboard.activeWorkers")} value={String(totals.activeWorkers)} icon={Users} accent="bg-primary/10 text-primary" />
          <KpiCard label={t("page.dashboard.todayJobsKpi")} value={String(totals.todayJobs)} icon={Wrench} accent="bg-[--color-warning]/15 text-[--color-warning]" />
          <KpiCard label={t("page.dashboard.outstandingSalary")} value={fmtMYR(totals.outstandingSalary)} icon={Wallet} accent="bg-[--color-success]/15 text-[--color-success]" />
          <KpiCard label={t("page.dashboard.employeeAdvances")} value={fmtMYR(totals.totalAdvances)} icon={HandCoins} accent="bg-destructive/10 text-destructive" />
        </div>
      </div>

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">{t("page.dashboard.todayJobs")}</h2>
          <Link to="/jobs" className="flex items-center gap-1 text-xs font-medium text-primary">
            {t("common.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <ul className="mt-3 space-y-2.5">
          {todayJobs.map((job) => (
            <li key={job.id}>
              <Link to="/jobs" className="block rounded-2xl border border-border bg-card p-3.5 active:bg-secondary">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{job.plate}</p>
                    <p className="truncate text-sm font-semibold">{job.vehicle}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <AvatarStack initialsList={job.assignedIds.map((id) => getEmployee(id).initials)} size={24} />
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">{job.progress}%</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 px-5">
        <h2 className="text-base font-semibold tracking-tight">{t("page.dashboard.recent")}</h2>
        <ul className="mt-3 space-y-1 rounded-2xl border border-border bg-card divide-y divide-border">
          {activity.map((a, i) => (
            <li key={i} className="flex items-center gap-3 p-3.5">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary ${a.color}`}>
                <a.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.text}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" /> {a.time}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const map: Record<string, string> = {
    "In Progress": "bg-primary/10 text-primary",
    "Pending QC": "bg-[--color-warning]/15 text-[--color-warning]",
    "Completed": "bg-[--color-success]/15 text-[--color-success]",
    "Waiting Parts": "bg-destructive/10 text-destructive",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${map[status] ?? "bg-secondary text-secondary-foreground"}`}>
      {tStatus(t, status)}
    </span>
  );
}
