import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, Wallet, HandCoins, Users, ArrowRight, ClipboardCheck, AlertCircle, CheckCircle, CalendarClock, RotateCcw, Car, Gauge } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useJobs } from "@/lib/jobs";
import { useAdvances } from "@/lib/advances";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — DHX Body & Paint" },
      { name: "description", content: "Workshop operations dashboard for DHX Body & Paint." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <Dashboard />
    </WorkspaceGate>
  ),
});

function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);
}

function Dashboard() {
  const { profile, workspaceId, role } = useWorkspace();
  const jobsQ = useJobs(workspaceId);
  const advancesQ = useAdvances(workspaceId, {});

  const jobs = jobsQ.data ?? [];
  const open = jobs.filter((j) => j.status === "open" || j.status === "in_progress");
  const completed = jobs.filter((j) => j.status === "completed");
  const advances = advancesQ.data ?? [];
  const pending = advances.filter((a) => a.status === "pending");
  const approvedTotal = advances
    .filter((a) => a.status === "approved")
    .reduce((s, a) => s + Number(a.amount), 0);

  const today = new Date().toISOString().slice(0, 10);
  const readyForQc = jobs.filter((j) => j.repair_stage === "qc" && j.status !== "completed").length;
  const delayed = jobs.filter((j) => j.due_date && j.due_date < today && !j.released_at && j.status !== "completed").length;
  const releasedToday = jobs.filter((j) => j.released_at && j.released_at.slice(0, 10) === today).length;

  const completedReleased = completed.filter((j) => j.released_at);
  const avgRepairDays = completedReleased.length
    ? (completedReleased.reduce((s, j) => s + (new Date(j.released_at!).getTime() - new Date(j.created_at).getTime()) / 86400000, 0) / completedReleased.length).toFixed(1)
    : null;
  const reworkRate = completed.length > 0 ? Math.round(completed.reduce((s, j) => s + (j.rework_count || 0), 0) / completed.length * 100) : null;

  const activeHours = open.reduce((s, j) => s + (Date.now() - new Date(j.created_at).getTime()) / 3600000, 0);
  const downtimeHrs = Math.round(activeHours);
  const vehiclesInRepair = new Set(open.map((j) => j.vehicle_id)).size;
  const totalJobs = jobs.length;
  const capacity = totalJobs > 0 ? `${open.length}/${totalJobs}` : `${open.length}`;

  return (
    <div>
      <AppHeader
        title={`Hi, ${profile?.full_name.split(" ")[0] ?? "there"}`}
        subtitle={role ? role.charAt(0).toUpperCase() + role.slice(1) : "Workshop"}
      />

      <div className="px-5">
        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Operations</h2>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Active Jobs" value={String(open.length)} icon={Wrench} accent="bg-primary/10 text-primary" />
            <KpiCard label="Ready for QC" value={String(readyForQc)} icon={ClipboardCheck} accent="bg-purple-500/10 text-purple-500" />
            <KpiCard label="Delayed Jobs" value={String(delayed)} icon={AlertCircle} accent="bg-warning/15 text-warning" />
            <KpiCard label="Released Today" value={String(releasedToday)} icon={CheckCircle} accent="bg-success/15 text-success" />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Performance</h2>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Avg Repair Days" value={avgRepairDays ?? "—"} icon={CalendarClock} accent="bg-blue-500/10 text-blue-500" />
            <KpiCard label="Rework Rate" value={reworkRate !== null ? `${reworkRate}%` : "—"} icon={RotateCcw} accent="bg-orange-500/10 text-orange-500" />
            <KpiCard label="Pending Advances" value={String(pending.length)} icon={HandCoins} accent="bg-warning/15 text-warning" />
            <KpiCard label="Approved Advances" value={fmtMYR(approvedTotal)} icon={Wallet} accent="bg-success/15 text-success" />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Fleet Impact</h2>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Downtime Hrs" value={String(downtimeHrs)} icon={Gauge} accent="bg-destructive/10 text-destructive" />
            <KpiCard label="Vehicles In Repair" value={String(vehiclesInRepair)} icon={Car} accent="bg-primary/10 text-primary" />
            <KpiCard label="Capacity" value={capacity} icon={Users} accent="bg-secondary text-foreground" />
          </div>
        </section>
      </div>

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight">Active Jobs</h2>
          <Link to="/jobs" className="flex items-center gap-1 text-xs font-medium text-primary">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="mt-3 space-y-2.5">
          {open.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-sm text-muted-foreground">
              No active jobs.
            </li>
          )}
          {open.slice(0, 5).map((job) => (
            <li key={job.id}>
              <Link
                to="/jobs/$id"
                params={{ id: job.id }}
                className="block rounded-2xl border border-border bg-card p-3.5 active:bg-secondary"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{job.vehicle?.plate_number ?? "—"}</p>
                    <p className="truncate text-sm font-semibold">
                      {[job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    {job.status.replace("_", " ")}
                  </span>
                </div>
                {job.description && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{job.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  linkTo,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  accent: string;
  linkTo?: "/team" | "/jobs" | "/salary" | "/advance";
}) {
  const inner = (
    <div className="rounded-2xl bg-card p-4 shadow-sm border border-border">
      <div className={`grid h-9 w-9 place-items-center rounded-xl ${accent}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return linkTo ? <Link to={linkTo}>{inner}</Link> : inner;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
      {status.replace("_", " ")}
    </span>
  );
}
