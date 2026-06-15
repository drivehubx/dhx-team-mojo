import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Circle,
  User,
  Wallet,
  Clock,
  PlayCircle,
  FileText,
  GraduationCap,
  History,
  MessageSquare,
  Play,
  Pause,
  Camera,
  CheckCheck,
  UserPlus,
  Shuffle,
  ShieldCheck,
  AlertTriangle,
  Package,
  Undo2,
  ChevronDown,
} from "lucide-react";
import {
  employees,
  getEmployee,
  fmtMYR,
  employeeSkills,
  trainingSuggestions,
  type Job,
  type JobStatus,
  type SkillCategory,
} from "@/lib/mock-data";
import { useJobs } from "@/lib/jobs-store";
import { StatusBadge } from "./index";
import { useT } from "@/lib/i18n";
import { Pencil, X } from "lucide-react";

export const Route = createFileRoute("/jobs/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.id} — DHX Team Ops` },
      { name: "description", content: "Job detail with workflow, checklist, photos, labour, learning and skills." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    role: (typeof s.role === "string" && ["worker", "manager", "owner"].includes(s.role) ? s.role : "worker") as
      | "worker"
      | "manager"
      | "owner",
  }),
  component: JobDetailPage,
  notFoundComponent: () => <NotFound />,
});

function NotFound() {
  const { tr } = useT();
  return <div className="p-8 text-center text-sm text-muted-foreground">{tr("Job not found.")}</div>;
}

type Stage = "Received" | "Panel" | "Paint" | "QC" | "Ready" | "Delivered";
const WORKFLOW: Stage[] = ["Received", "Panel", "Paint", "QC", "Ready", "Delivered"];

function currentStep(job: Job): number {
  if (job.status === "Completed") return 4;
  if (job.status === "Pending QC") return 3;
  if (job.status === "Waiting Parts") return 1;
  if (job.progress >= 70) return 3;
  if (job.progress >= 50) return 2;
  if (job.progress >= 25) return 1;
  return 0;
}

function checklistFor(job: Job) {
  const step = currentStep(job);
  return [
    { key: "Panel", done: step >= 1 },
    { key: "Paint", done: step >= 2 },
    { key: "Parts", done: job.status !== "Waiting Parts" && step >= 2 },
    { key: "QC", done: step >= 4 },
  ];
}

function jobSkillFocus(job: Job): SkillCategory {
  const n = (job.notes || "").toLowerCase();
  if (n.includes("paint") || n.includes("respray") || n.includes("polish") || n.includes("colour")) return "Paint";
  if (n.includes("qc") || n.includes("inspect")) return "QC";
  return "Panel";
}

function JobDetailPage() {
  const { tr } = useT();
  const { id } = Route.useParams();
  const { role } = Route.useSearch();
  const { getJob, updateJob } = useJobs();
  const job = getJob(id);
  const [editOpen, setEditOpen] = useState(false);
  if (!job) throw notFound();

  // Persistence: stage override + extra photos + running state
  const storeKey = `dhx:job:${id}`;
  const [stageOverride, setStageOverride] = useState<number | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.stageOverride === "number") setStageOverride(s.stageOverride);
        if (Array.isArray(s.extraPhotos)) setExtraPhotos(s.extraPhotos);
        if (typeof s.running === "boolean") setRunning(s.running);
      }
    } catch {}
    setHydrated(true);
  }, [storeKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify({ stageOverride, extraPhotos, running }));
    } catch {}
  }, [storeKey, stageOverride, extraPhotos, running, hydrated]);

  const owner = (() => {
    const part = job.plate.split(" ")[1];
    return part ? `Customer ${part}` : "Walk-in";
  })();
  const ownerPhone = "+60 1" + (job.id.charCodeAt(1) % 9) + " " + "234 5678";

  const all = [...job.photos, ...extraPhotos];
  const beforePhotos = all.slice(0, Math.max(1, Math.ceil(all.length / 3)));
  const duringPhotos = all.slice(beforePhotos.length, beforePhotos.length + Math.max(1, Math.floor(all.length / 3)));
  const afterPhotos = job.status === "Completed" || job.progress >= 90 ? all.slice(-1) : [];

  const computedStep = currentStep(job);
  const step = stageOverride ?? computedStep;
  const checklist = checklistFor(job);

  const costs = {
    parts: Math.round(job.progress * 8 + 200),
    labour: Math.round(job.progress * 12 + 150),
    paint: Math.round(job.progress * 5 + 100),
  };
  const totalCost = costs.parts + costs.labour + costs.paint;

  const estHours = 8 + (job.id.charCodeAt(1) % 5) * 4;
  const actualHours = Math.round((estHours * job.progress) / 100);
  const hourPct = Math.min(100, Math.round((actualHours / estHours) * 100));

  const actualCompletion = job.status === "Completed" ? job.due : "—";

  const managerNote =
    job.status === "Waiting Parts"
      ? tr("Parts ordered — follow up with supplier daily.")
      : job.status === "Pending QC"
        ? tr("Run final QC checklist, photograph before release.")
        : tr("Keep customer updated every 24h. Photograph each stage.");

  const timeline = [
    { key: "Created", date: job.startedAt, done: true },
    { key: "Assigned", date: job.startedAt, done: true },
    { key: "Started", date: job.startedAt, done: true },
    { key: "Updated", date: tr("Today"), done: true },
    { key: "QC", date: step >= 3 ? tr("Today") : tr("Pending"), done: step >= 3 },
    { key: "Completed", date: job.status === "Completed" ? job.due : tr("Pending"), done: job.status === "Completed" },
  ];

  const isFleet = ["BMW", "PNG", "MEX"].some((p) => job.plate.startsWith(p));
  const channel = isFleet ? tr("Fleet") : tr("Walk-in");
  const assignedManager = "Ron Tan";

  // Current stage details
  const stageOwnerEmp = getEmployee(job.assignedIds[0]);
  const stageStarted = job.startedAt;
  const stageDuration = Math.max(1, Math.round((actualHours / Math.max(1, step + 1)) * 10) / 10);
  const blockReason =
    job.status === "Waiting Parts"
      ? tr("Waiting on supplier parts delivery")
      : job.status === "Pending QC" && step < 3
        ? tr("Awaiting QC slot")
        : null;

  const parts = [
    { name: tr("Front Bumper"), status: job.status === "Waiting Parts" ? "waiting" : "installed" },
    { name: tr("Headlamp Assembly"), status: job.progress >= 50 ? "installed" : "waiting" },
    { name: tr("Paint — Base Coat"), status: job.progress >= 40 ? "installed" : "waiting" },
    { name: tr("Clip Set"), status: "returned" },
  ] as const;

  const focus = jobSkillFocus(job);
  const suggestion = trainingSuggestions[focus];

  return (
    <div className="pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Link
            to="/jobs"
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{job.plate}</p>
            <h1 className="text-base font-semibold tracking-tight truncate">{job.vehicle}</h1>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            aria-label={tr("Edit")}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <StatusBadge status={job.status} />
        </div>
      </header>

      {editOpen && (
        <EditJobSheet
          job={job}
          onClose={() => setEditOpen(false)}
          onSave={(patch) => {
            updateJob(job.id, patch);
            setEditOpen(false);
            toast.success(tr("Job updated"));
          }}
        />
      )}

      {/* Compact Vehicle Info */}
      <section className="px-5 mt-4">
        <div className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{job.plate}</p>
              <p className="text-sm font-semibold truncate">{job.vehicle}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <CalendarClock className="inline h-3 w-3 mr-1" />
                {tr("ETA")} {job.due} · {tr("Manager")} {assignedManager}
              </p>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip>{channel}</Chip>
            <Chip>
              <Calendar className="h-3 w-3 mr-1" />
              {job.startedAt}
            </Chip>
            {owner !== "Walk-in" && <Chip>{owner}</Chip>}
            <Chip muted>{ownerPhone}</Chip>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums w-9 text-right">{job.progress}%</span>
          </div>
        </div>
      </section>

      {/* Repair Workflow */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Repair Workflow")}</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <ol className="flex items-center justify-between gap-1">
            {WORKFLOW.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={`grid place-items-center rounded-full text-[10px] font-semibold transition-all ${
                      done
                        ? "h-7 w-7 bg-[--color-success] text-white"
                        : active
                          ? "h-9 w-9 bg-primary text-primary-foreground ring-4 ring-primary/15 text-xs"
                          : "h-7 w-7 bg-secondary text-muted-foreground/60"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] truncate w-full text-center ${
                      active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground/60"
                    }`}
                  >
                    {tr(label)}
                  </span>
                </li>
              );
            })}
          </ol>

          {/* Active stage details */}
          <div className="mt-4 rounded-xl bg-primary/5 border border-primary/15 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                {tr("Current Stage")}: {tr(WORKFLOW[step])}
              </p>
              <span className="text-[10px] text-muted-foreground">
                {tr("Updated")} · {tr("Today")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <p className="text-muted-foreground">{tr("Owner")}</p>
                <p className="font-medium text-foreground truncate">{stageOwnerEmp.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{tr("Started")}</p>
                <p className="font-medium text-foreground">{stageStarted}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{tr("Duration")}</p>
                <p className="font-medium text-foreground tabular-nums">{stageDuration}h</p>
              </div>
            </div>
            {blockReason && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-[--color-warning]/10 p-2 text-[11px] text-[--color-warning]">
                <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  <span className="font-semibold">{tr("Blocked")}:</span> {blockReason}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <button className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-foreground active:scale-95">
              <Undo2 className="h-3 w-3" /> {tr("Rollback")}
            </button>
          </div>
        </div>
      </section>

      {/* Team Assignment */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Team Assignment")}</h2>
        <ul className="space-y-2">
          {job.assignedIds.map((eid, idx) => {
            const e = getEmployee(eid);
            const memberProgress = Math.min(100, Math.max(10, job.progress + (idx === 0 ? 5 : -10)));
            const currentTask =
              idx === 0 ? tr(WORKFLOW[Math.min(step, 4)]) + " — " + tr("in progress") : tr("Assist & prep");
            return (
              <li key={eid} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {e.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{tr(e.role)}</p>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums">{memberProgress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${memberProgress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {tr("Task")}: <span className="text-foreground">{currentTask}</span>
                  </span>
                  <span>
                    {tr("ETA")} {job.due}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        {role !== "worker" && (
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <button className="rounded-xl border border-border bg-card py-2 text-[11px] font-medium active:scale-95 inline-flex items-center justify-center gap-1">
              <UserPlus className="h-3.5 w-3.5" /> {tr("Assign")}
            </button>
            <button className="rounded-xl border border-border bg-card py-2 text-[11px] font-medium active:scale-95 inline-flex items-center justify-center gap-1">
              <Shuffle className="h-3.5 w-3.5" /> {tr("Reassign")}
            </button>
            <button className="rounded-xl border border-border bg-card py-2 text-[11px] font-medium active:scale-95 inline-flex items-center justify-center gap-1">
              <UserPlus className="h-3.5 w-3.5" /> {tr("Add Helper")}
            </button>
          </div>
        )}

        <div className="mt-2.5 space-y-2">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Internal Notes")}</p>
            </div>
            <p className="text-sm leading-relaxed">{managerNote}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Customer Notes")}</p>
            </div>
            <p className="text-sm leading-relaxed">{tr("Customer prefers OEM parts. Update via WhatsApp.")}</p>
          </div>
          {(job.status === "Waiting Parts" || job.progress < 30) && (
            <div className="rounded-2xl border border-[--color-warning]/40 bg-[--color-warning]/10 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[--color-warning]" />
                <p className="text-[11px] uppercase tracking-wider text-[--color-warning] font-semibold">
                  {tr("Risk Alert")}
                </p>
              </div>
              <p className="text-sm leading-relaxed">
                {job.status === "Waiting Parts"
                  ? tr("Parts ordered — follow up with supplier daily.")
                  : tr("Progress below schedule. Escalate if not improving by tomorrow.")}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Photo Timeline (collapsible) */}
      <CollapsibleSection title={tr("Photos")} defaultOpen={all.length > 0}>
        <PhotoGroup tKey="Before Photos" photos={beforePhotos} />
        <PhotoGroup tKey="During Photos" photos={duringPhotos} />
        <PhotoGroup tKey="After Photos" photos={afterPhotos} emptyKey="Pending — job not complete" />
      </CollapsibleSection>

      {/* Workshop Checklist */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Workshop Checklist")}</h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-center gap-3 p-3.5">
              {c.done ? (
                <CheckCircle2 className="h-5 w-5 text-[--color-success]" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50" />
              )}
              <span className={`text-sm ${c.done ? "font-medium" : "text-muted-foreground"}`}>
                {tr(c.key === "Parts" ? "Parts" : c.key)}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">{c.done ? tr("Done") : tr("Pending")}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Labour Tracking */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> {tr("Labour Tracking")}
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">{tr("Estimated Hours")}</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{estHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Actual Hours")}</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{actualHours}h</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${actualHours > estHours ? "bg-[--color-warning]" : "bg-primary"}`}
              style={{ width: `${hourPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {actualHours > estHours
                ? tr("Over budget")
                : tr("{n}h remaining", { n: Math.max(0, estHours - actualHours) })}
            </span>
            <span>
              {tr("Variance")}:{" "}
              <span
                className={`font-semibold ${actualHours > estHours ? "text-[--color-warning]" : "text-foreground"}`}
              >
                {actualHours - estHours}h
              </span>
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-1.5">{tr("Staff involved")}</p>
            <div className="flex flex-wrap gap-1.5">
              {job.assignedIds.map((eid) => {
                const e = getEmployee(eid);
                return (
                  <span key={eid} className="text-[11px] rounded-full bg-secondary px-2 py-1">
                    {e.name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Parts Tracking */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> {tr("Parts Tracking")}
        </h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {parts.map((p) => (
            <li key={p.name} className="flex items-center gap-3 p-3.5">
              <span className="text-sm flex-1 truncate">{p.name}</span>
              <span
                className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${
                  p.status === "installed"
                    ? "bg-[--color-success]/15 text-[--color-success]"
                    : p.status === "waiting"
                      ? "bg-[--color-warning]/15 text-[--color-warning]"
                      : "bg-secondary text-muted-foreground"
                }`}
              >
                {p.status === "installed" ? tr("Installed") : p.status === "waiting" ? tr("Waiting") : tr("Returned")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Completion */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Completion")}</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] text-muted-foreground">{tr("Estimated")}</p>
            <p className="mt-1 text-sm font-semibold">{job.due}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] text-muted-foreground">{tr("Actual")}</p>
            <p className="mt-1 text-sm font-semibold">{actualCompletion}</p>
          </div>
        </div>
      </section>

      {/* Learning Integration (collapsible) */}
      <CollapsibleSection
        title={tr("Learning Integration")}
        icon={<GraduationCap className="h-4 w-4 text-primary" />}
        defaultOpen={all.length > 0}
      >
        <div className="px-5">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">
              {tr("Focus area for this job: ")}
              <span className="font-medium text-foreground">{tr(focus)}</span>
            </p>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <PlayCircle className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Related Videos")}</p>
              </div>
              <ul className="space-y-1">
                {suggestion.videos.map((v) => (
                  <li key={v} className="text-sm">
                    • {tr(v)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Related SOP")}</p>
              </div>
              <ul className="space-y-1">
                {suggestion.sops.map((s) => (
                  <li key={s} className="text-sm">
                    • {tr(s)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Skills Integration */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Skills Integration")}</h2>
        <ul className="space-y-2">
          {job.assignedIds.map((eid) => {
            const e = getEmployee(eid);
            const sk = employeeSkills[eid]?.[focus];
            if (!sk) return null;
            const gap = Math.max(0, sk.required - sk.current);
            return (
              <li key={eid} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground text-xs font-semibold">
                    {e.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{tr(e.role)}</p>
                  </div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-1 ${
                      gap === 0
                        ? "bg-[--color-success]/15 text-[--color-success]"
                        : "bg-[--color-warning]/15 text-[--color-warning]"
                    }`}
                  >
                    {gap === 0 ? tr("On par") : tr("Gap {n}", { n: gap })}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">{tr("Current")}</p>
                    <p className="font-semibold tabular-nums text-sm">{sk.current}/5</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{tr("Required")}</p>
                    <p className="font-semibold tabular-nums text-sm">{sk.required}/5</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{tr("Gap")}</p>
                    <p className="font-semibold tabular-nums text-sm">{gap}</p>
                  </div>
                </div>
                {gap > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {tr("Suggested: ")}
                    <span className="text-foreground">{tr(suggestion.videos[0])}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Job Timeline (collapsible) */}
      <CollapsibleSection
        title={tr("Job Timeline")}
        icon={<History className="h-4 w-4 text-primary" />}
        defaultOpen={all.length > 0}
      >
        <div className="px-5">
          <ol className="rounded-2xl border border-border bg-card p-4">
            {timeline.map((tl, i) => (
              <li key={tl.key} className="flex gap-3 last:pb-0 pb-3.5">
                <div className="flex flex-col items-center">
                  <div
                    className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                      tl.done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {tl.done ? "✓" : i + 1}
                  </div>
                  {i < timeline.length - 1 && (
                    <div
                      className={`w-px flex-1 mt-1 ${tl.done ? "bg-primary/40" : "bg-border"}`}
                      style={{ minHeight: 14 }}
                    />
                  )}
                </div>
                <div>
                  <p className={`text-sm ${tl.done ? "font-medium" : "text-muted-foreground"}`}>{tr(tl.key)}</p>
                  <p className="text-[11px] text-muted-foreground">{tl.date}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </CollapsibleSection>

      {/* Cost tracking — role-gated */}
      {role !== "worker" && (
        <CollapsibleSection
          title={tr("Cost tracking")}
          icon={<Wallet className="h-4 w-4 text-primary" />}
          defaultOpen={all.length > 0}
        >
          <div className="px-5">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
              {role === "owner" ? (
                <>
                  <CostRow label={tr("Parts")} value={costs.parts} />
                  <CostRow label={tr("Labour")} value={costs.labour} />
                  <CostRow label={tr("Paint & Materials")} value={costs.paint} />
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {tr("Summary view — full breakdown for Owner only.")}
                </p>
              )}
              <div className="pt-2.5 mt-1 border-t border-border flex items-center justify-between">
                <span className="text-sm font-semibold">{tr("Total")}</span>
                <span className="text-base font-semibold tabular-nums">{fmtMYR(totalCost)}</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{tr("Estimated — not yet invoiced.")}</p>
          </div>
        </CollapsibleSection>
      )}

      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2">{tr("Notes")}</h2>
        <p className="rounded-2xl border border-border bg-card p-3.5 text-sm leading-relaxed">{job.notes}</p>
      </section>

      {/* Spacer for sticky actions */}
      <div className="h-40" />

      {/* Hidden file input for photo capture */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          const readers = files.map(
            (f) =>
              new Promise<string>((resolve, reject) => {
                if (f.size > 8 * 1024 * 1024) {
                  reject(new Error("too-large"));
                  return;
                }
                const r = new FileReader();
                r.onload = () => resolve(String(r.result));
                r.onerror = () => reject(r.error ?? new Error("read"));
                r.readAsDataURL(f);
              }),
          );
          Promise.allSettled(readers).then((results) => {
            const ok = results
              .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
              .map((r) => r.value);
            const failed = results.length - ok.length;
            if (ok.length) {
              setExtraPhotos((p) => [...p, ...ok]);
              updateJob(job.id, (j) => ({ photos: [...ok, ...j.photos] }));
            }
            if (ok.length) toast.success(tr("{n} photo(s) added", { n: ok.length }));
            if (failed) toast.error(tr("{n} photo(s) failed (max 8MB)", { n: failed }));
          });
          if (fileRef.current) fileRef.current.value = "";
        }}
      />

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md space-y-2">
          <div className="grid grid-cols-4 gap-1.5">
            <StickyBtn
              icon={<Play className="h-4 w-4" />}
              label={running ? tr("Running") : tr("Start")}
              onClick={() => {
                setRunning(true);
                toast.success(tr("Job started"));
              }}
            />
            <StickyBtn
              icon={<Pause className="h-4 w-4" />}
              label={tr("Pause")}
              onClick={() => {
                setRunning(false);
                toast(tr("Job paused"));
              }}
            />
            <StickyBtn
              icon={<Camera className="h-4 w-4" />}
              label={tr("Photo")}
              onClick={() => fileRef.current?.click()}
            />
            <StickyBtn
              icon={<CheckCheck className="h-4 w-4" />}
              label={step >= WORKFLOW.length - 1 ? tr("Done") : tr("Complete")}
              primary
              onClick={() => {
                const next = Math.min(WORKFLOW.length - 1, step + 1);
                if (next === step) {
                  toast(tr("Already at final stage"));
                  return;
                }
                setStageOverride(next);
                const stageProgress = [10, 30, 50, 75, 95, 100][next] ?? job.progress;
                const newStatus: JobStatus =
                  next >= 5 ? "Completed" : next >= 3 ? "Pending QC" : "In Progress";
                updateJob(job.id, {
                  progress: Math.max(job.progress, stageProgress),
                  status: newStatus,
                });
                toast.success(tr("Moved to {s}", { s: tr(WORKFLOW[next]) }));
              }}
            />
          </div>
          {role !== "worker" && (
            <div className="grid grid-cols-3 gap-1.5">
              <StickyBtn
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label={tr("Approve")}
                small
                onClick={() => toast.success(tr("Stage approved"))}
              />
              <StickyBtn
                icon={<Shuffle className="h-3.5 w-3.5" />}
                label={tr("Reassign")}
                small
                onClick={() => toast(tr("Open reassign panel"))}
              />
              {role === "owner" && (
                <StickyBtn
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label={tr("Final Approve")}
                  small
                  onClick={() => toast.success(tr("Final approval recorded"))}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ${
        muted ? "bg-secondary/60 text-muted-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen,
  children,
}: {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="px-5 mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between mb-2.5 active:scale-[0.99] transition-transform"
      >
        <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {open ? tr("Show less") : tr("Show more")}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && <div className="-mx-5">{children}</div>}
    </section>
  );
}

function StickyBtn({
  icon,
  label,
  primary,
  small,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  primary?: boolean;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex flex-col items-center justify-center gap-0.5 rounded-xl active:scale-95 transition-transform ${
        small ? "py-1.5 text-[10px]" : "py-2 text-[11px]"
      } ${primary ? "bg-primary text-primary-foreground font-semibold" : "bg-secondary text-foreground"}`}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{fmtMYR(value)}</span>
    </div>
  );
}

function PhotoGroup({ tKey, photos, emptyKey }: { tKey: string; photos: string[]; emptyKey?: string }) {
  const { tr } = useT();
  return (
    <section className="px-5 mt-4 first:mt-0">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold tracking-tight text-muted-foreground uppercase">{tr(tKey)}</h3>
        <span className="text-[11px] text-muted-foreground">
          {tr(photos.length === 1 ? "{n} photo" : "{n} photos", { n: photos.length })}
        </span>
      </div>
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {emptyKey ? tr(emptyKey) : tr("No photos yet")}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="aspect-square w-full rounded-xl object-cover bg-secondary"
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EditJobSheet({
  job,
  onClose,
  onSave,
}: {
  job: Job;
  onClose: () => void;
  onSave: (patch: Partial<Job>) => void;
}) {
  const { tr } = useT();
  const [plate, setPlate] = useState(job.plate);
  const [vehicle, setVehicle] = useState(job.vehicle);
  const [customerName, setCustomerName] = useState(job.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(job.customerPhone ?? "");
  const [notes, setNotes] = useState(job.notes);
  const [assignedIds, setAssignedIds] = useState<string[]>(job.assignedIds);

  const toggle = (id: string) =>
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-background p-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{tr("Edit Job")}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label={tr("Plate")}>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} className="inp" />
          </Field>
          <Field label={tr("Vehicle")}>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="inp" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("Customer")}>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="inp" />
            </Field>
            <Field label={tr("Phone")}>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="inp" />
            </Field>
          </div>

          <Field label={tr("Assigned Workers")}>
            <div className="flex flex-wrap gap-1.5">
              {employees
                .filter((e) => e.active && e.role !== "Owner")
                .map((e) => {
                  const on = assignedIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggle(e.id)}
                      className={`rounded-full px-3 py-1.5 text-xs ${
                        on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {e.name}
                    </button>
                  );
                })}
            </div>
          </Field>

          <Field label={tr("Notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="inp resize-none"
            />
          </Field>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium"
          >
            {tr("Cancel")}
          </button>
          <button
            onClick={() =>
              onSave({
                plate: plate.trim(),
                vehicle: vehicle.trim(),
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                notes,
                assignedIds,
              })
            }
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {tr("Save")}
          </button>
        </div>

        <style>{`.inp{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:0.75rem;padding:0.6rem 0.75rem;font-size:0.875rem;outline:none}.inp:focus{box-shadow:0 0 0 2px hsl(var(--primary)/0.25)}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

