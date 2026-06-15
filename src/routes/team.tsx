import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  employees,
  jobs,
  employeeSkills,
  type SkillCategory,
} from "@/lib/mock-data";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Hammer,
  Paintbrush,
  ShieldCheck,
  PackageCheck,
  Search,
  Coffee,
  CalendarOff,
  Lightbulb,
  BookOpen,
  FileText,
} from "lucide-react";

type RoleView = "worker" | "manager" | "owner";

export const Route = createFileRoute("/team")({
  validateSearch: (s: Record<string, unknown>): { role?: RoleView } => ({
    role:
      s.role === "manager" || s.role === "owner" || s.role === "worker"
        ? s.role
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Team — DHX Team Ops" },
      { name: "description", content: "Workforce control center: attendance, assignments, workload, skills." },
    ],
  }),
  component: TeamPage,
});

type Stage = "Panel" | "Paint" | "QC" | "Completed";
type Attendance = "Ready" | "Late" | "Break" | "Off Duty" | "Leave";

const stageIcon = {
  Panel: Hammer,
  Paint: Paintbrush,
  QC: ShieldCheck,
  Completed: PackageCheck,
} as const;

const stageColor: Record<Stage, string> = {
  Panel: "bg-amber-500/15 text-amber-300",
  Paint: "bg-indigo-500/15 text-indigo-300",
  QC: "bg-sky-500/15 text-sky-300",
  Completed: "bg-emerald-500/15 text-emerald-300",
};

const attendanceMeta: Record<Attendance, { dot: string; pill: string; icon: typeof CheckCircle2 }> = {
  Ready:    { dot: "bg-emerald-400",  pill: "bg-emerald-500/15 text-emerald-300", icon: CheckCircle2 },
  Late:     { dot: "bg-amber-400",    pill: "bg-amber-500/15 text-amber-300",     icon: Clock },
  Break:    { dot: "bg-sky-400",      pill: "bg-sky-500/15 text-sky-300",         icon: Coffee },
  "Off Duty": { dot: "bg-rose-400",   pill: "bg-rose-500/15 text-rose-300",       icon: XCircle },
  Leave:    { dot: "bg-zinc-400",     pill: "bg-zinc-500/15 text-zinc-300",       icon: CalendarOff },
};

type WorkerMeta = {
  attendance: Attendance;
  stage: Stage;
  score: number;
  training: number;
  checkIn: string;
  hours: string;
  utilization: number; // 0..120
  nextFree: string; // free-form: "Free now" | "Available in 2h" | "Tomorrow"
};

const workerMeta: Record<string, WorkerMeta> = {
  e1: { attendance: "Ready",    stage: "QC",        score: 95, training: 100, checkIn: "08:02", hours: "8h 12m", utilization: 40,  nextFree: "Free now" },
  e2: { attendance: "Ready",    stage: "Paint",     score: 88, training: 75,  checkIn: "07:58", hours: "8h 30m", utilization: 110, nextFree: "Tomorrow" },
  e3: { attendance: "Ready",    stage: "Paint",     score: 82, training: 60,  checkIn: "08:10", hours: "8h 04m", utilization: 85,  nextFree: "Available in 3h" },
  e4: { attendance: "Late",     stage: "Panel",     score: 90, training: 80,  checkIn: "09:14", hours: "6h 52m", utilization: 70,  nextFree: "Available in 2h" },
  e5: { attendance: "Leave",    stage: "Completed", score: 78, training: 40,  checkIn: "—",     hours: "—",      utilization: 0,   nextFree: "Tomorrow" },
  e6: { attendance: "Break",    stage: "Panel",     score: 72, training: 30,  checkIn: "08:20", hours: "7h 40m", utilization: 35,  nextFree: "Free now" },
};

function workerActiveJobs(empId: string) {
  return jobs.filter((j) => j.assignedIds.includes(empId) && j.status !== "Completed");
}

function utilBand(u: number) {
  if (u >= 101) return { label: "Overloaded", bar: "bg-rose-500", text: "text-rose-300", chip: "bg-rose-500/15 text-rose-300" };
  if (u >= 81)  return { label: "Busy",       bar: "bg-orange-500", text: "text-orange-300", chip: "bg-orange-500/15 text-orange-300" };
  if (u >= 51)  return { label: "Normal",     bar: "bg-sky-500", text: "text-sky-300", chip: "bg-sky-500/15 text-sky-300" };
  return          { label: "Available",  bar: "bg-emerald-500", text: "text-emerald-300", chip: "bg-emerald-500/15 text-emerald-300" };
}

function suggestHelper(forId: string): string | null {
  // pick lowest-utilization worker (not Owner, not on leave, not self)
  const pool = employees
    .filter((e) => e.id !== forId && e.role !== "Owner")
    .map((e) => ({ e, m: workerMeta[e.id] }))
    .filter((x) => x.m && x.m.attendance !== "Leave" && x.m.attendance !== "Off Duty")
    .sort((a, b) => a.m.utilization - b.m.utilization);
  return pool[0]?.e.name ?? null;
}

const SKILL_KEYS: SkillCategory[] = ["Panel", "Paint", "QC", "SOP"];

type FilterKey = "All" | "Available" | "Busy" | "Leave" | "Managers" | "Workers";

function TeamPage() {
  const { tr } = useT();
  const { role: roleParam } = Route.useSearch();
  const role: RoleView = roleParam ?? "worker";
  const isManager = role === "manager" || role === "owner";
  const isOwner = role === "owner";

  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");

  // Summary stats
  const stats = useMemo(() => {
    const total = employees.length;
    let onDuty = 0, busy = 0, idle = 0, leave = 0, utilSum = 0, utilCount = 0;
    for (const e of employees) {
      const m = workerMeta[e.id];
      if (!m) continue;
      if (m.attendance === "Leave") leave++;
      else if (m.attendance === "Off Duty") { /* off */ }
      else {
        onDuty++;
        utilSum += m.utilization;
        utilCount++;
        if (m.utilization >= 81) busy++;
        else if (m.utilization <= 50) idle++;
      }
    }
    const avg = utilCount ? Math.round(utilSum / utilCount) : 0;
    return { total, onDuty, busy, idle, leave, avg };
  }, []);

  const visible = useMemo(() => {
    let list = employees.slice();
    // role-scoping: worker sees only self
    if (!isManager) list = list.filter((e) => e.id === "e1" /* current user placeholder */ || e.id === "e2");
    // filter tabs
    list = list.filter((e) => {
      const m = workerMeta[e.id];
      if (!m) return false;
      switch (filter) {
        case "Available": return m.utilization <= 50 && m.attendance !== "Leave" && m.attendance !== "Off Duty";
        case "Busy":      return m.utilization >= 81 && m.attendance !== "Leave";
        case "Leave":     return m.attendance === "Leave" || m.attendance === "Off Duty";
        case "Managers":  return e.role === "Owner";
        case "Workers":   return e.role !== "Owner";
        default: return true;
      }
    });
    // search
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        if (e.name.toLowerCase().includes(q)) return true;
        const j = workerActiveJobs(e.id)[0];
        if (j && (j.plate.toLowerCase().includes(q) || j.vehicle.toLowerCase().includes(q))) return true;
        return false;
      });
    }
    return list;
  }, [filter, query, isManager]);

  const filterTabs: FilterKey[] = ["All", "Available", "Busy", "Leave", "Managers", "Workers"];

  return (
    <div>
      <AppHeader title={tr("Team")} subtitle={tr("Workforce control center")} />

      <div className="px-5 space-y-4 pb-28">
        {/* 1. Summary */}
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label={tr("Total Staff")} value={stats.total} />
          <MiniStat label={tr("On Duty")} value={stats.onDuty} tone="emerald" />
          <MiniStat label={tr("Busy")} value={stats.busy} tone="orange" />
          <MiniStat label={tr("Idle")} value={stats.idle} tone="sky" />
          <MiniStat label={tr("Leave")} value={stats.leave} tone="zinc" />
          <MiniStat label={tr("Avg Util")} value={`${stats.avg}%`} tone="primary" />
        </div>

        {/* 7. Filters + Search */}
        <Card className="p-3">
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Search name or vehicle")}
              className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto pb-1">
            {filterTabs.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {tr(f)}
              </button>
            ))}
          </div>
        </Card>

        {/* Worker list */}
        <div className="space-y-3">
          {visible.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              {tr("No team members match")}
            </Card>
          )}
          {visible.map((e) => {
            const m = workerMeta[e.id];
            const active = workerActiveJobs(e.id);
            const first = active[0];
            const Icon = stageIcon[m.stage];
            const att = attendanceMeta[m.attendance];
            const AttIcon = att.icon;
            const band = utilBand(m.utilization);
            const overloaded = m.utilization >= 101;
            const helper = overloaded ? suggestHelper(e.id) : null;
            const skills = employeeSkills[e.id];

            // average progress across active jobs
            const avgProgress = active.length
              ? Math.round(active.reduce((s, j) => s + j.progress, 0) / active.length)
              : 0;

            return (
              <Card key={e.id} className="p-4">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {e.initials}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card ${att.dot}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{e.name}</p>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${att.pill}`}>
                        <AttIcon className="h-3 w-3" />
                        {tr(m.attendance)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{tr(e.role)}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>{tr("Check in")}: <span className="text-foreground">{m.checkIn}</span></span>
                      <span>{tr("Hours")}: <span className="text-foreground">{m.hours}</span></span>
                    </div>
                  </div>
                </div>

                {/* Assignment */}
                <div className="mt-3 rounded-lg bg-muted/40 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Current vehicle")}</p>
                      <p className="truncate font-medium">
                        {first ? `${first.vehicle} · ${first.plate}` : tr("No active job")}
                      </p>
                    </div>
                    {first && (
                      <div className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${stageColor[m.stage]}`}>
                        <Icon className="h-3 w-3" />
                        {tr(m.stage)}
                      </div>
                    )}
                  </div>
                  {first && (
                    <>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">
                          {tr("Jobs")}: <span className="text-foreground">{active.length}</span>
                          {" · "}
                          {tr("ETA")}: <span className="text-foreground">{first.due}</span>
                        </span>
                        <span className="font-medium">{avgProgress}%</span>
                      </div>
                      <Progress value={avgProgress} className="mt-1 h-1.5" />
                    </>
                  )}
                </div>

                {/* Workload */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{tr("Workload")}</span>
                    <span className={`font-semibold ${band.text}`}>
                      {m.utilization}% · {tr(band.label)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${band.bar}`}
                      style={{ width: `${Math.min(100, m.utilization)}%` }}
                    />
                  </div>
                  {helper && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
                      <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        {tr("Overloaded — suggest")}: <span className="font-semibold">{helper}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {skills && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Skills")}</p>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {SKILL_KEYS.map((k) => {
                        const s = skills[k];
                        const gap = s.required - s.current;
                        const ok = gap <= 0;
                        return (
                          <div
                            key={k}
                            className={`rounded-md border px-1.5 py-1 text-center ${
                              ok
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : "border-amber-500/30 bg-amber-500/5"
                            }`}
                          >
                            <p className="text-[10px] font-semibold leading-none">{tr(k)}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {s.current}/{s.required}
                            </p>
                            <p className={`text-[9px] font-medium ${ok ? "text-emerald-300" : "text-amber-300"}`}>
                              {ok ? tr("OK") : `−${gap}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]">
                        <BookOpen className="mr-1 h-3 w-3" />
                        {tr("View Training")}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]">
                        <FileText className="mr-1 h-3 w-3" />
                        {tr("View SOP")}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Capacity */}
                <div className="mt-3 flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-[11px]">
                  <span className="text-muted-foreground">{tr("Next available")}</span>
                  <span className="font-medium">{tr(m.nextFree)}</span>
                </div>

                {/* Actions (manager/owner only) */}
                {isManager && m.attendance !== "Leave" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="h-7 flex-1 text-[11px]">
                      {tr("Assign")}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]">
                      {tr("Swap")}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]">
                      {tr("Remove")}
                    </Button>
                    {isOwner && (
                      <Button variant="destructive" size="sm" className="h-7 flex-1 text-[11px]">
                        {tr("Override")}
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "emerald" | "orange" | "sky" | "zinc" | "primary";
}) {
  const toneCls: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-300",
    orange: "text-orange-300",
    sky: "text-sky-300",
    zinc: "text-zinc-300",
    primary: "text-primary",
  };
  return (
    <Card className="p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold leading-tight ${toneCls[tone]}`}>{value}</p>
    </Card>
  );
}
