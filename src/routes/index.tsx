import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, Wallet, HandCoins, Users, ArrowRight } from "lucide-react";
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
  const advances = advancesQ.data ?? [];
  const pending = advances.filter((a) => a.status === "pending");
  const approvedTotal = advances
    .filter((a) => a.status === "approved")
    .reduce((s, a) => s + Number(a.amount), 0);

  return (
    <div>
      <AppHeader
        title={`Hi, ${profile?.full_name.split(" ")[0] ?? "there"}`}
        subtitle={role ? role.charAt(0).toUpperCase() + role.slice(1) : "Workshop"}
      />

      <div className="px-5">
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Active Jobs" value={String(open.length)} icon={Wrench} accent="bg-primary/10 text-primary" />
          <KpiCard label="Pending Advances" value={String(pending.length)} icon={HandCoins} accent="bg-[--color-warning]/15 text-[--color-warning]" />
          <KpiCard label="Approved Advances" value={fmtMYR(approvedTotal)} icon={Wallet} accent="bg-[--color-success]/15 text-[--color-success]" />
          <KpiCard label="Team" value="—" icon={Users} accent="bg-secondary text-foreground" linkTo="/team" />
        </div>
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
