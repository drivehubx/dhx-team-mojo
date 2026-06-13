import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
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
  Camera,
  Upload,
  Play,
  Pause,
  CheckCheck,
  UserPlus,
  ShieldCheck,
  AlertTriangle,
  Package,
  Wrench,
} from "lucide-react";
import {
  jobs,
  getEmployee,
  employees,
  fmtMYR,
  employeeSkills,
  trainingSuggestions,
  type Job,
  type SkillCategory,
} from "@/lib/mock-data";
import { StatusBadge } from "./index";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/jobs/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.id} — DHX Team Ops` },
      { name: "description", content: "Operational center for a job: workflow, team, photos, checklist, parts, labour, skills." },
    ],
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
  if (job.status === "Completed") return job.progress >= 100 ? 5 : 4;
  if (job.status === "Pending QC") return 3;
  if (job.status === "Waiting Parts") return 1;
  if (job.progress >= 90) return 4;
  if (job.progress >= 70) return 3;
  if (job.progress >= 50) return 2;
  if (job.progress >= 25) return 1;
  return 0;
}

function stageTimestamps(job: Job): string[] {
  // Mock timestamps per stage based on startedAt
  const base = job.startedAt;
  return [base, base, base, job.status === "Pending QC" || job.progress >= 70 ? "Today" : "—",
    job.status === "Completed" ? job.due : "—", job.status === "Completed" ? job.due : "—"];
}

function jobSkillFocus(job: Job): SkillCategory {
  const n = (job.notes || "").toLowerCase();
  if (n.includes("paint") || n.includes("respray") || n.includes("polish") || n.includes("colour")) return "Paint";
  if (n.includes("qc") || n.includes("inspect")) return "QC";
  return "Panel";
}

type RoleView = "Worker" | "Manager" | "Owner";

function JobDetailPage() {
  const { tr } = useT();
  const { id } = Route.useParams();
  const job = jobs.find((j) => j.id === id);
  if (!job) throw notFound();

  const [photoTab, setPhotoTab] = useState<"Before" | "During" | "After">("Before");
  const [roleView, setRoleView] = useState<RoleView>("Worker");
  const [stageOverride, setStageOverride] = useState<number | null>(null);

  const owner = (() => {
    const part = job.plate.split(" ")[1];
    return part ? `Customer ${part}` : "Walk-in";
  })();
  const ownerPhone = "+60 1" + (job.id.charCodeAt(1) % 9) + " " + "234 5678";
  const sourceType: "Walk-in" | "Fleet" = job.id.charCodeAt(1) % 2 === 0 ? "Fleet" : "Walk-in";
  const assignedManager = employees[0]; // Owner doubles as manager in mock

  const all = job.photos;
  const beforePhotos = all.slice(0, Math.max(1, Math.ceil(all.length / 3)));
  const duringPhotos = all.slice(beforePhotos.length, beforePhotos.length + Math.max(1, Math.floor(all.length / 3)));
  const afterPhotos = job.status === "Completed" || job.progress >= 90 ? all.slice(-1) : [];

  const step = stageOverride ?? currentStep(job);
  const stamps = stageTimestamps(job);

  const checklist = [
    { key: "Intake complete", done: step >= 0 },
    { key: "Damage recorded", done: step >= 1 },
    { key: "Parts ordered", done: job.status !== "Waiting Parts" || step >= 2 },
    { key: "Repair complete", done: step >= 2 },
    { key: "Paint complete", done: step >= 3 },
    { key: "QC passed", done: step >= 4 },
    { key: "Customer notified", done: step >= 5 },
  ];

  const costs = {
    labour: Math.round(job.progress * 12 + 150),
    paint: Math.round(job.progress * 5 + 100),
    materials: Math.round(job.progress * 8 + 200),
  };
  const totalCost = costs.labour + costs.paint + costs.materials;

  const estHours = 8 + (job.id.charCodeAt(1) % 5) * 4;
  const actualHours = Math.round((estHours * job.progress) / 100);
  const hourPct = Math.min(100, Math.round((actualHours / estHours) * 100));
  const variance = actualHours - estHours;

  // Parts list mock
  const partsList = [
    { name: "Front Bumper", code: "BMP-CV19-FR", status: job.status === "Waiting Parts" ? "Waiting" : "Installed" },
    { name: "Headlight Clip", code: "CLP-HL-002", status: "Installed" },
    { name: "Paint 2K Clear", code: "PNT-2K-CLR", status: step >= 2 ? "Installed" : "Pending" },
    ...(job.status === "Waiting Parts" ? [{ name: "Rear Quarter Panel", code: "PNL-RQ-MYV", status: "Waiting" }] : []),
  ];

  const focus = jobSkillFocus(job);
  const suggestion = trainingSuggestions[focus];

  const timeline = [
    { key: "Created", date: job.startedAt, done: true },
    { key: "Assigned", date: job.startedAt, done: true },
    { key: "Started", date: job.startedAt, done: true },
    { key: "Updated", date: tr("Today"), done: true },
    { key: "QC", date: job.progress >= 90 ? tr("Today") : tr("Pending"), done: job.progress >= 90 },
    { key: "Completed", date: job.status === "Completed" ? job.due : tr("Pending"), done: job.status === "Completed" },
  ];

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Link to="/jobs" className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95">
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{job.plate}</p>
            <h1 className="text-base font-semibold tracking-tight truncate">{job.vehicle}</h1>
          </div>
          <StatusBadge status={job.status} />
        </div>
        {/* Role view toggle */}
        <div className="flex gap-1 px-5 pb-2.5 text-[11px]">
          {(["Worker", "Manager", "Owner"] as RoleView[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleView(r)}
              className={`px-2.5 py-1 rounded-full ${roleView === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {tr(r)}
            </button>
          ))}
        </div>
      </header>

      {/* Vehicle Info */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Vehicle Info")}</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">{tr("Model")}</p>
              <p className="mt-0.5 font-medium text-sm">{job.vehicle}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Plate Number")}</p>
              <p className="mt-0.5 font-medium text-sm">{job.plate}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Source")}</p>
              <span className={`mt-0.5 inline-block text-[11px] rounded-full px-2 py-0.5 font-medium ${
                sourceType === "Fleet" ? "bg-primary/15 text-primary" : "bg-secondary text-foreground"
              }`}>{tr(sourceType)}</span>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("ETA")}</p>
              <p className="mt-0.5 font-medium text-sm">{job.due}</p>
            </div>
            <div className="col-span-2 flex items-center gap-2.5 pt-2 border-t border-border">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">{tr("Customer (optional)")}</p>
                <p className="text-sm font-medium truncate">{owner === "Walk-in" ? tr("Walk-in") : owner}</p>
                <p className="text-[11px] text-muted-foreground">{ownerPhone}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground text-xs font-semibold">
                {assignedManager.initials}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">{tr("Assigned Manager")}</p>
                <p className="text-sm font-medium truncate">{assignedManager.name}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {tr("Started")} {job.startedAt}
            <span className="mx-1">·</span>
            <CalendarClock className="h-3.5 w-3.5" />
            {tr("ETA")} {job.due}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
            </div>
            <span className="text-xs font-semibold tabular-nums w-9 text-right">{job.progress}%</span>
          </div>
        </div>
      </section>

      {/* Job Status — large stage card */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">{tr("Job Status")}</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Current Stage")}</p>
              <p className="text-xl font-bold tracking-tight">{tr(WORKFLOW[step])}</p>
            </div>
            {roleView !== "Worker" && step > 0 && (
              <button
                onClick={() => setStageOverride(Math.max(0, step - 1))}
                className="text-[11px] rounded-full bg-secondary px-2.5 py-1 text-muted-foreground"
              >
                {tr("Rollback")}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(step / (WORKFLOW.length - 1)) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
              {step + 1}/{WORKFLOW.length}
            </span>
          </div>

          <ol className="space-y-2">
            {WORKFLOW.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex items-center gap-3">
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                      done
                        ? "bg-[--color-success] text-white"
                        : active
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${active ? "font-semibold" : done ? "font-medium" : "text-muted-foreground"}`}>
                      {tr(label)}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{done || active ? stamps[i] : "—"}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Team Assignment */}
      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold tracking-tight">{tr("Team Assignment")}</h2>
          <div className="flex gap-1.5">
            <button className="text-[11px] rounded-full bg-primary/10 text-primary px-2.5 py-1 flex items-center gap-1">
              <UserPlus className="h-3 w-3" /> {tr("Add helper")}
            </button>
            <button className="text-[11px] rounded-full bg-secondary text-muted-foreground px-2.5 py-1">{tr("Reassign")}</button>
          </div>
        </div>
        <ul className="space-y-2">
          {job.assignedIds.map((eid, idx) => {
            const e = getEmployee(eid);
            const memberProgress = Math.max(10, Math.min(100, job.progress + (idx === 0 ? 5 : -10)));
            const currentTask = idx === 0
              ? (step >= 3 ? "QC walk-through" : step >= 2 ? "Paint blending" : "Panel alignment")
              : "Support / prep";
            return (
              <li key={eid} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {e.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{tr(e.role)}</p>
                  </div>
                  <span className="text-[11px] tabular-nums font-semibold">{memberProgress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${memberProgress}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{tr("Current task")}: <span className="text-foreground font-medium">{tr(currentTask)}</span></span>
                  <span>{tr("ETA")} {job.due}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Photos with tabs */}
      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-sm font-semibold tracking-tight">{tr("Photos")}</h2>
          <button className="text-[11px] rounded-full bg-primary/10 text-primary px-2.5 py-1 flex items-center gap-1">
            <Upload className="h-3 w-3" /> {tr("Upload")}
          </button>
        </div>
        <div className="flex gap-1 mb-3 rounded-full bg-secondary p-1">
          {(["Before", "During", "After"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPhotoTab(t)}
              className={`flex-1 text-[11px] py-1.5 rounded-full ${photoTab === t ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              {tr(t)}
            </button>
          ))}
        </div>
        <PhotoGrid
          photos={photoTab === "Before" ? beforePhotos : photoTab === "During" ? duringPhotos : afterPhotos}
          empty={photoTab === "After" && afterPhotos.length === 0 ? tr("Pending — job not complete") : tr("No photos yet")}
        />
      </section>

      {/* Manager Notes */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> {tr("Manager Notes")}
        </h2>
        <div className="space-y-2">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{tr("Internal notes")}</p>
            <p className="text-sm leading-relaxed">{job.notes}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{tr("Customer notes")}</p>
            <p className="text-sm leading-relaxed">{tr("Keep customer updated every 24h. Photograph each stage.")}</p>
          </div>
          {job.status === "Waiting Parts" && (
            <div className="rounded-2xl border border-[--color-warning]/40 bg-[--color-warning]/10 p-3.5">
              <p className="text-[11px] uppercase tracking-wider text-[--color-warning] mb-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {tr("Risk alerts")}
              </p>
              <p className="text-sm leading-relaxed">{tr("Parts ordered — follow up with supplier daily.")}</p>
            </div>
          )}
        </div>
      </section>

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
              <span className={`text-sm ${c.done ? "font-medium" : "text-muted-foreground"}`}>{tr(c.key)}</span>
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
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">{tr("Estimated Hours")}</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{estHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Actual Hours")}</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{actualHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">{tr("Variance")}</p>
              <p className={`mt-0.5 font-semibold text-sm tabular-nums ${variance > 0 ? "text-[--color-warning]" : "text-[--color-success]"}`}>
                {variance > 0 ? `+${variance}h` : `${variance}h`}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${actualHours > estHours ? "bg-[--color-warning]" : "bg-primary"}`}
              style={{ width: `${hourPct}%` }}
            />
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">{tr("Staff involved")}</p>
            <div className="flex flex-wrap gap-1.5">
              {job.assignedIds.map((eid) => {
                const e = getEmployee(eid);
                return (
                  <span key={eid} className="text-[11px] rounded-full bg-secondary px-2 py-0.5">{e.name}</span>
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
          {partsList.map((p) => (
            <li key={p.code} className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{tr(p.name)}</p>
                <p className="text-[11px] text-muted-foreground">{p.code}</p>
              </div>
              <span className={`text-[11px] rounded-full px-2 py-0.5 ${
                p.status === "Installed"
                  ? "bg-[--color-success]/15 text-[--color-success]"
                  : p.status === "Waiting"
                  ? "bg-[--color-warning]/15 text-[--color-warning]"
                  : "bg-secondary text-muted-foreground"
              }`}>{tr(p.status)}</span>
            </li>
          ))}
        </ul>
      </section>

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
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground text-xs font-semibold">
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
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Link to="/learning" className="text-[11px] rounded-full bg-primary/10 text-primary px-2.5 py-1 flex items-center gap-1">
                      <PlayCircle className="h-3 w-3" /> {tr("View Training")}
                    </Link>
                    <Link to="/learning" className="text-[11px] rounded-full bg-secondary text-foreground px-2.5 py-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {tr("View SOP")}
                    </Link>
                    <button className="text-[11px] rounded-full bg-secondary text-foreground px-2.5 py-1 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> {tr("Request Support")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Learning Integration */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> {tr("Learning Integration")}
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {tr("Focus area for this job: ")}<span className="font-medium text-foreground">{tr(focus)}</span>
          </p>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <PlayCircle className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Related Videos")}</p>
            </div>
            <ul className="space-y-1">
              {suggestion.videos.map((v) => (
                <li key={v} className="text-sm">• {tr(v)}</li>
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
                <li key={s} className="text-sm">• {tr(s)}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Wrench className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{tr("Repair Notes")}</p>
            </div>
            <ul className="space-y-1">
              {suggestion.jobs.map((s) => (
                <li key={s} className="text-sm">• {tr(s)}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Cost tracking */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> {tr("Cost tracking")}
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <CostRow label={tr("Labour")} value={costs.labour} />
          <CostRow label={tr("Paint")} value={costs.paint} />
          <CostRow label={tr("Materials")} value={costs.materials} />
          <div className="pt-2.5 mt-1 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold">{tr("Total")}</span>
            <span className="text-base font-semibold tabular-nums">{fmtMYR(totalCost)}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{tr("Estimated — not yet invoiced.")}</p>
      </section>

      {/* Job Timeline */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> {tr("Job Timeline")}
        </h2>
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
                  <div className={`w-px flex-1 mt-1 ${tl.done ? "bg-primary/40" : "bg-border"}`} style={{ minHeight: 14 }} />
                )}
              </div>
              <div>
                <p className={`text-sm ${tl.done ? "font-medium" : "text-muted-foreground"}`}>{tr(tl.key)}</p>
                <p className="text-[11px] text-muted-foreground">{tl.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-16 left-0 right-0 z-20 mx-auto max-w-md px-3">
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-2 flex items-center gap-1.5">
          {roleView === "Worker" && (
            <>
              <ActionBtn icon={<Play className="h-3.5 w-3.5" />} label={tr("Start")} />
              <ActionBtn icon={<Pause className="h-3.5 w-3.5" />} label={tr("Pause")} variant="ghost" />
              <ActionBtn icon={<Camera className="h-3.5 w-3.5" />} label={tr("Photo")} variant="ghost" />
              <ActionBtn icon={<CheckCheck className="h-3.5 w-3.5" />} label={tr("Complete")} variant="primary" />
            </>
          )}
          {roleView === "Manager" && (
            <>
              <ActionBtn icon={<CheckCircle2 className="h-3.5 w-3.5" />} label={tr("Approve")} variant="primary" />
              <ActionBtn icon={<UserPlus className="h-3.5 w-3.5" />} label={tr("Reassign")} variant="ghost" />
              <ActionBtn
                icon={<History className="h-3.5 w-3.5" />}
                label={tr("Move Stage")}
                variant="ghost"
                onClick={() => setStageOverride(Math.min(WORKFLOW.length - 1, step + 1))}
              />
            </>
          )}
          {roleView === "Owner" && (
            <>
              <ActionBtn icon={<ShieldCheck className="h-3.5 w-3.5" />} label={tr("Override")} variant="ghost" />
              <ActionBtn icon={<CheckCheck className="h-3.5 w-3.5" />} label={tr("Approve Final")} variant="primary" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, variant = "secondary", onClick,
}: { icon: React.ReactNode; label: string; variant?: "primary" | "secondary" | "ghost"; onClick?: () => void }) {
  const cls =
    variant === "primary"
      ? "bg-primary text-primary-foreground"
      : variant === "ghost"
      ? "bg-secondary text-foreground"
      : "bg-secondary text-foreground";
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-medium active:scale-95 ${cls}`}
    >
      {icon}
      <span className="truncate">{label}</span>
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

function PhotoGrid({ photos, empty }: { photos: string[]; empty: string }) {
  if (photos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
        {empty}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((src, i) => (
        <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover bg-secondary" loading="lazy" />
      ))}
    </div>
  );
}
