import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import {
  useJob,
  useUpdateJobStatus,
  useJobPhotos,
  useApproveEstimate,
  useProfileById,
  useAdvanceStage,
  useUpdateWorkOrder,
  useWorkspaceProfiles,
  REPAIR_STAGES,
} from "@/lib/jobs";
import type {
  JobStatus,
  RepairStage,
  IntakeChecklist,
} from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/jobs/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.id.slice(0, 8)} — DHX Body & Paint` },
      { name: "description", content: "Job detail." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <JobDetailPage />
    </WorkspaceGate>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Job not found.</div>
  ),
});

const statusOrder: JobStatus[] = ["open", "in_progress", "completed", "cancelled"];
const statusLabel: Record<JobStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const stageStyle: Record<RepairStage, { bg: string; label: string }> = {
  queued: { bg: "bg-gray-200 text-gray-800", label: "Queued" },
  disassembly: { bg: "bg-orange-200 text-orange-900", label: "Disassembly" },
  panel_repair: { bg: "bg-yellow-200 text-yellow-900", label: "Panel Repair" },
  putty: { bg: "bg-yellow-200 text-yellow-900", label: "Putty" },
  primer: { bg: "bg-blue-200 text-blue-900", label: "Primer" },
  paint: { bg: "bg-blue-200 text-blue-900", label: "Paint" },
  polish: { bg: "bg-teal-200 text-teal-900", label: "Polish" },
  qc: { bg: "bg-purple-200 text-purple-900", label: "QC" },
  completed: { bg: "bg-green-200 text-green-900", label: "Completed" },
};

const AREA_LABELS: Record<string, string> = {
  front: "Front",
  rear: "Rear",
  left: "Left Side",
  right: "Right Side",
  roof: "Roof",
  interior: "Interior",
};

function formatMyr(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(n));
}

function JobDetailPage() {
  const { id } = Route.useParams();
  const { workspaceId, profile, isStaff } = useWorkspace();
  const q = useJob(workspaceId, id);
  const photosQ = useJobPhotos(workspaceId, id);
  const update = useUpdateJobStatus(workspaceId);
  const approve = useApproveEstimate(workspaceId);
  const advance = useAdvanceStage(workspaceId);
  const updateWO = useUpdateWorkOrder(workspaceId);
  const profilesQ = useWorkspaceProfiles(workspaceId);

  const approverQ = useProfileById(q.data?.estimate_approved_by ?? null);

  // Work order local state
  const [leadId, setLeadId] = useState<string>("");
  const [laborHours, setLaborHours] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  useEffect(() => {
    if (q.data) {
      setLeadId(q.data.assigned_lead_id ?? "");
      setLaborHours(
        q.data.labor_hours_estimate != null ? String(q.data.labor_hours_estimate) : "",
      );
      setDueDate(q.data.due_date ?? "");
    }
  }, [q.data?.id, q.data?.assigned_lead_id, q.data?.labor_hours_estimate, q.data?.due_date]);


  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!q.data) throw notFound();
  const job = q.data;
  const stage = (job.repair_stage ?? "queued") as RepairStage;
  const stageMeta = stageStyle[stage];
  const checklist = (job.intake_checklist ?? {}) as IntakeChecklist;

  const setStatus = async (s: JobStatus) => {
    try {
      await update.mutateAsync({ id: job.id, status: s });
      toast.success(`Status: ${statusLabel[s]}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const handleApprove = async () => {
    if (!profile?.id) return;
    try {
      await approve.mutateAsync({ jobId: job.id, profileId: profile.id });
      toast.success("Estimate approved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const handleAdvance = async () => {
    try {
      const res = await advance.mutateAsync({
        jobId: job.id,
        currentStage: stage,
        startedAt: job.started_at ?? null,
      });
      toast.success(`Stage: ${stageStyle[res.next].label}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const handleSaveWO = async () => {
    try {
      await updateWO.mutateAsync({
        jobId: job.id,
        assigned_lead_id: leadId || null,
        labor_hours_estimate: laborHours.trim() === "" ? null : Number(laborHours),
        due_date: dueDate || null,
      });
      toast.success("Work order saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const stageIndex = REPAIR_STAGES.indexOf(stage);
  const isFinalStage = stage === "completed";
  const photos = photosQ.data ?? [];


  return (
    <div className="pb-12">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Link
            to="/jobs"
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {job.vehicle?.plate_number ?? "—"}
            </p>
            <h1 className="text-base font-semibold tracking-tight truncate">
              {[job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || "Vehicle"}
            </h1>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${stageMeta.bg}`}>
            {stageMeta.label}
          </span>
        </div>
      </header>

      {/* Intake Photos */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Intake Photos</h2>
        {photosQ.isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No photos uploaded.
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.signedUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <img
                  src={p.signedUrl ?? ""}
                  alt="Intake"
                  className="h-24 w-24 rounded-xl object-cover border border-border bg-secondary"
                />
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Damage Info */}
      <section className="px-5 mt-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Damage</p>
          <p className="mt-2 text-sm whitespace-pre-wrap">
            {job.damage_description || (
              <span className="text-muted-foreground">No description.</span>
            )}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Estimate</span>
            <span className="text-sm font-semibold">{formatMyr(job.estimate_amount)}</span>
          </div>
        </div>
      </section>

      {/* Repair Stage Tracker */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Repair Stage</h2>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1">
          {REPAIR_STAGES.map((s, i) => {
            const meta = stageStyle[s];
            const isCurrent = i === stageIndex;
            const isDone = i < stageIndex;
            return (
              <span
                key={s}
                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider border ${
                  isCurrent
                    ? "bg-primary text-primary-foreground border-primary"
                    : isDone
                      ? "bg-muted text-muted-foreground border-border opacity-70"
                      : "bg-card text-muted-foreground border-border"
                }`}
              >
                {isDone && <Check className="h-3 w-3" />}
                {meta.label}
              </span>
            );
          })}
        </div>
        {isStaff && !isFinalStage && (
          <button
            onClick={handleAdvance}
            disabled={advance.isPending}
            className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {advance.isPending ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Advance Stage"
            )}
          </button>
        )}
      </section>

      {/* Assessment (staff only) */}

      {isStaff && (
        <section className="px-5 mt-4">
          <h2 className="text-sm font-semibold tracking-tight mb-2.5">Assessment</h2>
          <div className="rounded-2xl border border-border bg-card p-4">
            {job.estimate_approved ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[--color-success]/15 text-[--color-success] px-2.5 py-1 text-xs font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Estimate Approved
                </span>
                <span className="text-muted-foreground text-xs">
                  by {approverQ.data?.full_name ?? "…"}
                </span>
              </div>
            ) : (
              <button
                onClick={handleApprove}
                disabled={approve.isPending}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {approve.isPending ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : (
                  "Approve Estimate"
                )}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Intake checklist */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Intake Checklist</h2>
        <ul className="space-y-2">
          {Object.entries(AREA_LABELS).map(([key, label]) => {
            const v = checklist[key as keyof IntakeChecklist];
            return (
              <li key={key} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{label}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                      v?.checked
                        ? "bg-[--color-success]/15 text-[--color-success]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {v?.checked ? "Checked" : "Not checked"}
                  </span>
                </div>
                {v?.note && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{v.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Team assignment */}
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Team Assignment</h2>
        {job.workers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            No crew assigned.
          </div>
        ) : (
          <ul className="space-y-2">
            {job.workers.map((w) => (
              <li key={w.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {(w.profile?.full_name ?? "??").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{w.profile?.full_name ?? "—"}</p>
                  {w.role_on_job && (
                    <p className="text-[11px] text-muted-foreground">{w.role_on_job}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isStaff && (
        <section className="px-5 mt-6">
          <h2 className="text-sm font-semibold tracking-tight mb-2.5">Update Status</h2>
          <div className="grid grid-cols-2 gap-2">
            {statusOrder.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                disabled={update.isPending || job.status === s}
                className={`rounded-xl py-3 text-sm font-semibold border ${
                  job.status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border"
                } disabled:opacity-60`}
              >
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </section>
      )}

      {!isStaff && (
        <section className="px-5 mt-6">
          {job.status === "open" && (
            <button
              onClick={() => setStatus("in_progress")}
              disabled={update.isPending}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {update.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Start Job"}
            </button>
          )}
          {job.status === "in_progress" && (
            <button
              onClick={() => setStatus("completed")}
              disabled={update.isPending}
              className="w-full rounded-xl bg-[--color-success] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {update.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Mark Complete"}
            </button>
          )}
          {(job.status === "completed" || job.status === "cancelled") && (
            <p className="text-center text-sm text-muted-foreground">
              This job is {job.status}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
