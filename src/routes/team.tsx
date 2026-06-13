import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { employees, jobs, getEmployee } from "@/lib/mock-data";
import { CheckCircle2, Clock, XCircle, Hammer, Paintbrush, ShieldCheck, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — DHX Team Ops" },
      { name: "description", content: "Today's attendance, worker load, and team performance." },
    ],
  }),
  component: TeamPage,
});

type Stage = "Panel" | "Paint" | "QC" | "Completed";
type Attendance = "Present" | "Late" | "Off";

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

const workerMeta: Record<string, { attendance: Attendance; stage: Stage; score: number; training: number }> = {
  e1: { attendance: "Present", stage: "QC", score: 95, training: 100 },
  e2: { attendance: "Present", stage: "Paint", score: 88, training: 75 },
  e3: { attendance: "Present", stage: "Paint", score: 82, training: 60 },
  e4: { attendance: "Late", stage: "Panel", score: 90, training: 80 },
  e5: { attendance: "Off", stage: "Completed", score: 78, training: 40 },
  e6: { attendance: "Present", stage: "Panel", score: 72, training: 30 },
};

function workerCurrentJob(empId: string) {
  return jobs.find((j) => j.assignedIds.includes(empId) && j.status !== "Completed");
}

function TeamPage() {
  const { tr } = useT();
  const active = employees.filter((e) => workerMeta[e.id]?.attendance !== "Off");
  const present = employees.filter((e) => workerMeta[e.id]?.attendance === "Present").length;
  const late = employees.filter((e) => workerMeta[e.id]?.attendance === "Late").length;
  const off = employees.filter((e) => workerMeta[e.id]?.attendance === "Off").length;

  const currentJobs = jobs.filter((j) => j.status !== "Completed").length;
  const load = active.length ? Math.round((currentJobs / active.length) * 100) : 0;
  const teamScore = Math.round(
    employees.reduce((s, e) => s + (workerMeta[e.id]?.score ?? 0), 0) / employees.length,
  );
  const training = Math.round(
    employees.reduce((s, e) => s + (workerMeta[e.id]?.training ?? 0), 0) / employees.length,
  );

  return (
    <div>
      <AppHeader title={tr("Team")} subtitle={tr("Today's overview")} />

      <div className="px-5 -mt-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{tr("Today Attendance")}</p>
            <span className="text-xs text-muted-foreground">{tr("{n} staff", { n: employees.length })}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-3">
              <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-400" />
              <p className="mt-1 text-lg font-semibold text-emerald-300">{present}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Present")}</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3">
              <Clock className="mx-auto h-4 w-4 text-amber-400" />
              <p className="mt-1 text-lg font-semibold text-amber-300">{late}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Late")}</p>
            </div>
            <div className="rounded-lg bg-rose-500/10 p-3">
              <XCircle className="mx-auto h-4 w-4 text-rose-400" />
              <p className="mt-1 text-lg font-semibold text-rose-300">{off}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Off")}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label={tr("Current Jobs")} value={currentJobs} />
          <StatCard label={tr("Worker Load")} value={`${load}%`} />
          <StatCard label={tr("Team Score")} value={teamScore} />
        </div>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{tr("Training Progress")}</p>
            <span className="text-xs font-medium text-primary">{training}%</span>
          </div>
          <Progress value={training} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {tr("Average completion across all team members.")}
          </p>
        </Card>

        <div>
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {tr("Workers")}
          </p>
          <div className="space-y-3">
            {employees.map((e) => {
              const meta = workerMeta[e.id];
              const job = workerCurrentJob(e.id);
              const Icon = stageIcon[meta.stage];
              return (
                <Card key={e.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {e.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{e.name}</p>
                        <AttendancePill state={meta.attendance} />
                      </div>
                      <p className="text-xs text-muted-foreground">{tr(e.role)}</p>

                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-muted-foreground">{tr("Vehicle")}</p>
                          <p className="truncate font-medium">
                            {job ? `${job.vehicle} · ${job.plate}` : "—"}
                          </p>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${stageColor[meta.stage]}`}
                        >
                          <Icon className="h-3 w-3" />
                          {tr(meta.stage)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{tr("Score")} {meta.score}</span>
                        <span>·</span>
                        <span>{tr("Training")} {meta.training}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Card>
  );
}

function AttendancePill({ state }: { state: Attendance }) {
  const { tr } = useT();
  const map: Record<Attendance, string> = {
    Present: "bg-emerald-500/15 text-emerald-300",
    Late: "bg-amber-500/15 text-amber-300",
    Off: "bg-rose-500/15 text-rose-300",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[state]}`}>
      {tr(state)}
    </span>
  );
}

void getEmployee;
