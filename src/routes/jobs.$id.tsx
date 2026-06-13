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
} from "lucide-react";
import {
  jobs,
  getEmployee,
  fmtMYR,
  employeeSkills,
  trainingSuggestions,
  type Job,
  type SkillCategory,
} from "@/lib/mock-data";
import { TranslatedText } from "@/components/TranslatedText";
import { StatusBadge } from "./index";

export const Route = createFileRoute("/jobs/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.id} — DHX Team Ops` },
      { name: "description", content: "Job detail with workflow, checklist, photos, labour, learning and skills." },
    ],
  }),
  component: JobDetailPage,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Job not found.</div>
  ),
});

type Stage = "Received" | "Panel" | "Paint" | "QC" | "Ready";
const WORKFLOW: Stage[] = ["Received", "Panel", "Paint", "QC", "Ready"];

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
    { label: "Panel", done: step >= 1 },
    { label: "Paint", done: step >= 2 },
    { label: "Parts", done: job.status !== "Waiting Parts" && step >= 2 },
    { label: "QC", done: step >= 4 },
  ];
}

// Best-effort guess of which skill category a job primarily needs.
function jobSkillFocus(job: Job): SkillCategory {
  const n = (job.notes || "").toLowerCase();
  if (n.includes("paint") || n.includes("respray") || n.includes("polish") || n.includes("colour")) return "Paint";
  if (n.includes("qc") || n.includes("inspect")) return "QC";
  return "Panel";
}

function JobDetailPage() {
  const { id } = Route.useParams();
  const job = jobs.find((j) => j.id === id);
  if (!job) throw notFound();

  const owner = `Customer ${job.plate.split(" ")[1] ?? ""}`.trim() || "Walk-in";
  const ownerPhone = "+60 1" + (job.id.charCodeAt(1) % 9) + " " + "234 5678";

  const all = job.photos;
  const beforePhotos = all.slice(0, Math.max(1, Math.ceil(all.length / 3)));
  const duringPhotos = all.slice(beforePhotos.length, beforePhotos.length + Math.max(1, Math.floor(all.length / 3)));
  const afterPhotos = job.status === "Completed" || job.progress >= 90 ? all.slice(-1) : [];

  const step = currentStep(job);
  const checklist = checklistFor(job);

  const costs = {
    parts: Math.round(job.progress * 8 + 200),
    labour: Math.round(job.progress * 12 + 150),
    paint: Math.round(job.progress * 5 + 100),
  };
  const totalCost = costs.parts + costs.labour + costs.paint;

  // Labour tracking — deterministic from job
  const estHours = 8 + (job.id.charCodeAt(1) % 5) * 4; // 8..24
  const actualHours = Math.round((estHours * job.progress) / 100);
  const hourPct = Math.min(100, Math.round((actualHours / estHours) * 100));

  // Completion dates
  const actualCompletion = job.status === "Completed" ? job.due : "—";

  // Manager notes (mock) — written by different team members in their own language
  const managerNote =
    job.status === "Waiting Parts"
      ? "Waiting for parts. Tomorrow paint."
      : job.status === "Pending QC"
      ? "Panel completed. QC passed."
      : "板金完成。明天喷漆。";

  // Job timeline
  const timeline = [
    { label: "Created", date: job.startedAt, done: true },
    { label: "Started", date: job.startedAt, done: true },
    { label: "Updated", date: "Today", done: true },
    { label: "Completed", date: job.status === "Completed" ? job.due : "Pending", done: job.status === "Completed" },
  ];

  // Learning + Skills integration
  const focus = jobSkillFocus(job);
  const suggestion = trainingSuggestions[focus];

  return (
    <div className="pb-6">
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
      </header>

      {/* Vehicle Info */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Vehicle Info</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Model</p>
              <p className="mt-0.5 font-medium text-sm">{job.vehicle}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Plate Number</p>
              <p className="mt-0.5 font-medium text-sm">{job.plate}</p>
            </div>
            <div className="col-span-2 flex items-center gap-2.5 pt-2 border-t border-border">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Customer (optional)</p>
                <p className="text-sm font-medium truncate">{owner}</p>
                <p className="text-[11px] text-muted-foreground">{ownerPhone}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Started {job.startedAt}
            <span className="mx-1">·</span>
            <CalendarClock className="h-3.5 w-3.5" />
            ETA {job.due}
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
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Repair Workflow</h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(step / (WORKFLOW.length - 1)) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">
              {WORKFLOW[step]}
            </span>
          </div>

          {/* Stage pills */}
          <ol className="flex items-center justify-between gap-1">
            {WORKFLOW.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={label} className="flex flex-1 flex-col items-center gap-1.5 min-w-0">
                  <div
                    className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold ${
                      done
                        ? "bg-[--color-success] text-white"
                        : active
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] truncate w-full text-center ${
                      active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Team Assignment */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Team Assignment</h2>
        <ul className="space-y-2">
          {job.assignedIds.map((eid) => {
            const e = getEmployee(eid);
            return (
              <li key={eid} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {e.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground">{e.role}</p>
                </div>
                <span className="text-[11px] rounded-full bg-secondary px-2 py-1 text-muted-foreground">{e.phone.slice(-4)}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-2.5 rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Manager Notes</p>
          </div>
          <TranslatedText as="p" className="text-sm leading-relaxed" text={managerNote} showBadge />
        </div>
      </section>

      {/* Photo Timeline */}
      <PhotoGroup title="Before Photos" photos={beforePhotos} />
      <PhotoGroup title="During Photos" photos={duringPhotos} />
      <PhotoGroup title="After Photos" photos={afterPhotos} empty="Pending — job not complete" />

      {/* Workshop Checklist */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Workshop Checklist</h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-3 p-3.5">
              {c.done ? (
                <CheckCircle2 className="h-5 w-5 text-[--color-success]" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/50" />
              )}
              <span className={`text-sm ${c.done ? "font-medium" : "text-muted-foreground"}`}>{c.label}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{c.done ? "Done" : "Pending"}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Labour Tracking */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Labour Tracking
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Estimated Hours</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{estHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Actual Hours</p>
              <p className="mt-0.5 font-semibold text-sm tabular-nums">{actualHours}h</p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full ${actualHours > estHours ? "bg-[--color-warning]" : "bg-primary"}`}
              style={{ width: `${hourPct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {actualHours > estHours ? "Over budget" : `${Math.max(0, estHours - actualHours)}h remaining`}
          </p>
        </div>
      </section>

      {/* Completion */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Completion</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] text-muted-foreground">Estimated</p>
            <p className="mt-1 text-sm font-semibold">{job.due}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-[11px] text-muted-foreground">Actual</p>
            <p className="mt-1 text-sm font-semibold">{actualCompletion}</p>
          </div>
        </div>
      </section>

      {/* Learning Integration */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Learning Integration
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Focus area for this job: <span className="font-medium text-foreground">{focus}</span>
          </p>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <PlayCircle className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Related Videos</p>
            </div>
            <ul className="space-y-1">
              {suggestion.videos.map((v) => (
                <li key={v} className="text-sm">• {v}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Related SOP</p>
            </div>
            <ul className="space-y-1">
              {suggestion.sops.map((s) => (
                <li key={s} className="text-sm">• {s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Skills Integration */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Skills Integration</h2>
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
                    <p className="text-[11px] text-muted-foreground">{e.role}</p>
                  </div>
                  <span
                    className={`text-[11px] rounded-full px-2 py-1 ${
                      gap === 0
                        ? "bg-[--color-success]/15 text-[--color-success]"
                        : "bg-[--color-warning]/15 text-[--color-warning]"
                    }`}
                  >
                    {gap === 0 ? "On par" : `Gap ${gap}`}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-semibold tabular-nums text-sm">{sk.current}/5</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Required</p>
                    <p className="font-semibold tabular-nums text-sm">{sk.required}/5</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gap</p>
                    <p className="font-semibold tabular-nums text-sm">{gap}</p>
                  </div>
                </div>
                {gap > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Suggested: <span className="text-foreground">{suggestion.videos[0]}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Job Timeline */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <History className="h-4 w-4 text-primary" /> Job Timeline
        </h2>
        <ol className="rounded-2xl border border-border bg-card p-4">
          {timeline.map((t, i) => (
            <li key={t.label} className="flex gap-3 last:pb-0 pb-3.5">
              <div className="flex flex-col items-center">
                <div
                  className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                    t.done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t.done ? "✓" : i + 1}
                </div>
                {i < timeline.length - 1 && (
                  <div className={`w-px flex-1 mt-1 ${t.done ? "bg-primary/40" : "bg-border"}`} style={{ minHeight: 14 }} />
                )}
              </div>
              <div>
                <p className={`text-sm ${t.done ? "font-medium" : "text-muted-foreground"}`}>{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{t.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Cost tracking (optional) */}
      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Cost tracking
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <CostRow label="Parts" value={costs.parts} />
          <CostRow label="Labour" value={costs.labour} />
          <CostRow label="Paint & Materials" value={costs.paint} />
          <div className="pt-2.5 mt-1 border-t border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-base font-semibold tabular-nums">{fmtMYR(totalCost)}</span>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Estimated — not yet invoiced.</p>
      </section>

      <section className="px-5 mt-6">
        <h2 className="text-sm font-semibold tracking-tight mb-2">Notes</h2>
        <p className="rounded-2xl border border-border bg-card p-3.5 text-sm leading-relaxed">{job.notes}</p>
      </section>
    </div>
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

function PhotoGroup({ title, photos, empty }: { title: string; photos: string[]; empty?: string }) {
  return (
    <section className="px-5 mt-6">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-[11px] text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
      </div>
      {photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
          {empty ?? "No photos yet"}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover bg-secondary" loading="lazy" />
          ))}
        </div>
      )}
    </section>
  );
}
