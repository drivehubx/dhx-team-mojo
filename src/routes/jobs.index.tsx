import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AppHeader } from "@/components/AppHeader";
import { getEmployee, type JobStatus, type Job } from "@/lib/mock-data";
import { useJobs } from "@/lib/jobs-store";
import { useT } from "@/lib/i18n";
import { Search, AlertTriangle, Clock, UserPlus, ShieldAlert, ChevronRight, Car, Plus } from "lucide-react";

const roleSchema = z.object({
  role: z.enum(["worker", "manager", "owner"]).catch("worker"),
});

export const Route = createFileRoute("/jobs/")({
  validateSearch: roleSchema,
  head: () => ({
    meta: [
      { title: "Jobs — DHX Team Ops" },
      { name: "description", content: "Workshop control board: scan jobs, stages, ETA risk." },
    ],
  }),
  component: JobsPage,
});

// "Today" anchor for the mock data (jobs use "DD Mon" strings around mid-June).
const TODAY_DAY = 14;
const TODAY_MONTH = "Jun";

function parseDay(s: string): { day: number; month: string } | null {
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})$/);
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: m[2] };
}

type Risk = "ok" | "today" | "soon" | "overdue";
function etaRisk(due: string, status: JobStatus): Risk {
  if (status === "Completed") return "ok";
  const p = parseDay(due);
  if (!p || p.month !== TODAY_MONTH) return "ok";
  const diff = p.day - TODAY_DAY;
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 2) return "soon";
  return "ok";
}

// Map status → stage chip styling/dot
const stageStyles: Record<JobStatus, { dot: string; chip: string; label: string }> = {
  "In Progress": { dot: "bg-primary", chip: "bg-primary/10 text-primary", label: "In Progress" },
  "Pending QC": {
    dot: "bg-[--color-warning]",
    chip: "bg-[--color-warning]/15 text-[--color-warning]",
    label: "Pending QC",
  },
  "Waiting Parts": { dot: "bg-orange-500", chip: "bg-orange-500/15 text-orange-600", label: "Waiting Parts" },
  Completed: { dot: "bg-[--color-success]", chip: "bg-[--color-success]/15 text-[--color-success]", label: "Ready" },
};

// Mock "self" id per role (Owner default user has no assignments).
function selfIdFor(role: "worker" | "manager" | "owner") {
  if (role === "worker") return "e4"; // Suresh
  return "e1"; // Ron (manager/owner)
}

type FilterKey = "All" | "Mine" | "Blocked" | "In Progress" | "QC" | "Ready";

function matchesFilter(job: Job, f: FilterKey, selfId: string): boolean {
  switch (f) {
    case "All":
      return true;
    case "Mine":
      return job.assignedIds.includes(selfId);
    case "Blocked":
      return job.status === "Waiting Parts";
    case "In Progress":
      return job.status === "In Progress";
    case "QC":
      return job.status === "Pending QC";
    case "Ready":
      return job.status === "Completed";
  }
}

function JobsPage() {
  const { t, tr } = useT();
  const { role } = Route.useSearch();
  const selfId = selfIdFor(role);
  const { jobs } = useJobs();

  const allFilters: FilterKey[] = ["All", "Mine", "Blocked", "In Progress", "QC", "Ready"];
  const [filter, setFilter] = useState<FilterKey>(role === "worker" ? "Mine" : "All");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (!matchesFilter(j, filter, selfId)) return false;
      if (!q) return true;
      return (
        j.plate.toLowerCase().includes(q) || j.vehicle.toLowerCase().includes(q) || j.notes.toLowerCase().includes(q)
      );
    });
  }, [jobs, filter, query, selfId]);

  return (
    <div className="pb-8">
      <AppHeader
        title={t("page.jobs.title") || tr("Jobs")}
        subtitle={tr("{n} jobs shown").replace("{n}", String(list.length))}
      />


      {/* Sticky search + filters */}
      <div className="sticky top-[88px] z-30 -mt-4 px-5 pb-2 pt-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${tr("Plate")} · ${tr("Vehicle")} · ${tr("Customer")}`}
            className="w-full h-10 rounded-xl border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {allFilters.map((f) => {
            const count = jobs.filter((j) => matchesFilter(j, f, selfId)).length;
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
                }`}
              >
                {tr(f)}
                <span
                  className={`text-[10px] font-semibold ${active ? "text-primary-foreground/80" : "text-muted-foreground/70"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <ul className="mt-2 space-y-2 px-5">
        {list.map((job) => (
          <JobCard key={job.id} job={job} role={role} selfId={selfId} />
        ))}
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {tr("No requests")}
          </li>
        )}
      </ul>
    </div>
  );
}

function JobCard({ job, role, selfId }: { job: Job; role: "worker" | "manager" | "owner"; selfId: string }) {
  const { tr } = useT();
  const stage = stageStyles[job.status];
  const risk = etaRisk(job.due, job.status);
  const isBlocked = job.status === "Waiting Parts";
  const isMine = job.assignedIds.includes(selfId);
  const owner = getEmployee(job.assignedIds[0]);
  const others = job.assignedIds.length - 1;

  const riskMeta: Record<Risk, { label: string; cls: string }> = {
    ok: { label: tr("Due") + " " + job.due, cls: "text-muted-foreground" },
    soon: { label: tr("ETA") + " " + job.due, cls: "text-[--color-warning]" },
    today: { label: tr("ETA Today"), cls: "text-[--color-warning] font-semibold" },
    overdue: { label: tr("Overdue") + " · " + job.due, cls: "text-destructive font-semibold" },
  };

  return (
    <li>
      <Link
        to="/jobs/$id"
        params={{ id: job.id }}
        search={{ role }}
        className="block rounded-2xl border border-border bg-card px-4 py-3 active:bg-secondary"
      >
        {/* PHOTO */}
        <div className="mb-3 overflow-hidden rounded-xl bg-secondary">
          {job.photos[0] ? (
            <img
              src={job.photos[0]}
              alt={job.vehicle}
              loading="lazy"
              className="h-36 w-full object-cover"
              onError={(e) => {
                const img = e.currentTarget;
                img.style.display = "none";
                img.parentElement?.classList.add("job-photo-fallback");
              }}
            />
          ) : (
            <div className="h-36 w-full grid place-items-center text-muted-foreground">
              <Car className="h-8 w-8" />
            </div>
          )}
        </div>

        {/* Row 1 */}
        {/* Row 1: plate + vehicle + stage */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{job.plate}</p>
              {isMine && (
                <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {tr("Mine")}
                </span>
              )}
            </div>
            <p className="text-[15px] font-semibold leading-tight truncate">{job.vehicle}</p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${stage.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${stage.dot}`} />
            {tr(stage.label)}
          </span>
        </div>

        {/* Row 2: assignment + progress */}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5">
              {job.assignedIds.slice(0, 3).map((id) => {
                const e = getEmployee(id);
                return (
                  <span
                    key={id}
                    className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card text-[9px] font-bold"
                    title={e.name}
                  >
                    {e.initials}
                  </span>
                );
              })}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {owner.initials}
              {others > 0 && ` +${others}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[55%]">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full ${stage.dot}`} style={{ width: `${job.progress}%` }} />
            </div>
            <span className="text-[11px] font-semibold tabular-nums w-8 text-right text-muted-foreground">
              {job.progress}%
            </span>
          </div>
        </div>

        {/* Row 3: status footer (blocked / ETA + actions) */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isBlocked ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                <AlertTriangle className="h-3 w-3" /> {tr("Blocked")}
              </span>
            ) : (
              <span className={`inline-flex items-center gap-1 text-[11px] ${riskMeta[risk].cls}`}>
                <Clock className="h-3 w-3" /> {riskMeta[risk].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {role === "manager" && <QuickAction icon={UserPlus} label={tr("Assign")} />}
            {role === "owner" && <QuickAction icon={ShieldAlert} label={tr("Override")} />}
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
              {tr("Open")} <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function QuickAction({ icon: Icon, label }: { icon: typeof UserPlus; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:bg-secondary"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
