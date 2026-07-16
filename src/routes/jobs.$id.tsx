import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
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
  useRepairParts,
  useAddPart,
  useUpdatePartStatus,
  useAddFoundPart,
  useApprovePartRevision,
  useQcRecord,
  useSubmitQc,
  useReleaseJob,
  PART_STATUS_ORDER,
  type RepairPartStatus,
  type RepairPart,
  type PartDiscoveryStage,
  type PartRecommendedAction,
} from "@/lib/jobs";
import { analyzeRepairPart } from "@/lib/ai-damage.functions";
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

      {/* Work Order (staff only) */}
      {isStaff && (
        <section className="px-5 mt-4">
          <h2 className="text-sm font-semibold tracking-tight mb-2.5">Work Order</h2>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Crew Lead</label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="">— Unassigned —</option>
                {(profilesQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Labor Estimate (hours)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                placeholder="e.g. 8"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              />
            </div>
            <button
              onClick={handleSaveWO}
              disabled={updateWO.isPending}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {updateWO.isPending ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Save Work Order"
              )}
            </button>
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

      {/* Parts Tracking */}
      <PartsSection jobId={job.id} isStaff={isStaff} repairStage={stage} />

      {/* Quality Control */}
      <QcSection
        jobId={job.id}
        stage={stage}
        isStaff={isStaff}
        profileId={profile?.id ?? null}
        reworkCount={job.rework_count ?? 0}
      />

      {/* Release */}
      <ReleaseSection
        jobId={job.id}
        stage={stage}
        isStaff={isStaff}
        profileId={profile?.id ?? null}
        releasedAt={job.released_at ?? null}
        releasedBy={job.released_by ?? null}
      />

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

// ============ Parts Tracking ============

const partStatusStyle: Record<RepairPartStatus, string> = {
  required: "bg-gray-200 text-gray-800",
  ordered: "bg-yellow-200 text-yellow-900",
  received: "bg-blue-200 text-blue-900",
  installed: "bg-green-200 text-green-900",
};

function nextPartStatus(s: RepairPartStatus): RepairPartStatus {
  const i = PART_STATUS_ORDER.indexOf(s);
  return PART_STATUS_ORDER[(i + 1) % PART_STATUS_ORDER.length];
}

const ACTIVE_STAGES_FOR_ADD: RepairStage[] = [
  "disassembly",
  "panel_repair",
  "putty",
  "primer",
  "paint",
  "polish",
  "qc",
];

function stageToDiscovery(s: RepairStage): PartDiscoveryStage {
  if (s === "disassembly") return "dismantling";
  if (s === "qc") return "qc";
  return "repair";
}

function PartsSection({
  jobId,
  isStaff,
  repairStage,
}: {
  jobId: string;
  isStaff: boolean;
  repairStage: RepairStage;
}) {
  const { workspaceId } = useWorkspace();
  const partsQ = useRepairParts(workspaceId, jobId);
  const add = useAddPart(workspaceId);
  const upd = useUpdatePartStatus(workspaceId);
  const approveRev = useApprovePartRevision(workspaceId);

  const [showForm, setShowForm] = useState(false);
  const [showFoundSheet, setShowFoundSheet] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Part name required");
      return;
    }
    try {
      await add.mutateAsync({
        job_id: jobId,
        part_name: name.trim(),
        quantity: Math.max(1, Number(qty) || 1),
        unit_cost: cost.trim() === "" ? null : Number(cost),
        supplier: supplier.trim() || null,
      });
      toast.success("Part added");
      setName("");
      setQty("1");
      setCost("");
      setSupplier("");
      setShowForm(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const cycle = async (p: RepairPart) => {
    try {
      await upd.mutateAsync({ id: p.id, jobId, status: nextPartStatus(p.status) });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const parts = partsQ.data ?? [];
  const pendingRevisions = parts.filter((p) => p.revision_status === "draft_revision");
  const canAddFound = isStaff && ACTIVE_STAGES_FOR_ADD.includes(repairStage);

  return (
    <section className="px-5 mt-4">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-sm font-semibold tracking-tight">Parts</h2>
        {isStaff && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Manual
          </button>
        )}
      </div>

      {canAddFound && (
        <button
          onClick={() => setShowFoundSheet(true)}
          className="w-full mb-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-sm active:scale-[.98]"
        >
          <Camera className="h-5 w-5" />
          Add Part (photo · AI-assisted)
        </button>
      )}

      {pendingRevisions.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">
            Quotation revision pending — {pendingRevisions.length} additional part
            {pendingRevisions.length === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-amber-800">
            Original approved quotation is unchanged until management approves.
          </p>
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 mb-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Part (manual)</p>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Part name *"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Unit cost (RM)"
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </div>
          <input
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Supplier (optional)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
          <button
            onClick={submit}
            disabled={add.isPending}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {add.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save Part"}
          </button>
        </div>
      )}

      {partsQ.isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        </div>
      ) : parts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          No parts yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {parts.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.part_name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {p.provenance === "found_during_repair" ? (
                      <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Found during {p.discovery_stage ?? "repair"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Initial
                      </span>
                    )}
                    {p.revision_status === "draft_revision" && (
                      <span className="rounded-full bg-amber-500/20 text-amber-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Revision draft
                      </span>
                    )}
                    {p.recommended_action && (
                      <span className="rounded-full bg-secondary text-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        {p.recommended_action}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.quantity}x
                    {p.unit_cost != null ? ` @ RM ${Number(p.unit_cost).toFixed(2)}` : ""}
                  </p>
                  {p.reason_required && (
                    <p className="text-[11px] text-muted-foreground mt-1">{p.reason_required}</p>
                  )}
                  {p.related_damage && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      ↳ Related: {p.related_damage}
                    </p>
                  )}
                  {p.supplier && (
                    <p className="text-[11px] text-muted-foreground mt-1">Supplier: {p.supplier}</p>
                  )}
                  {isStaff && p.revision_status === "draft_revision" && (
                    <button
                      onClick={() =>
                        approveRev
                          .mutateAsync({ id: p.id, jobId })
                          .then(() => toast.success("Revision approved"))
                          .catch((e) => toast.error(e?.message ?? "Failed"))
                      }
                      disabled={approveRev.isPending}
                      className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[--color-success] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                    >
                      <Check className="h-3 w-3" /> Approve revision
                    </button>
                  )}
                </div>
                <button
                  onClick={() => cycle(p)}
                  disabled={upd.isPending}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${partStatusStyle[p.status]} disabled:opacity-60`}
                >
                  {p.status}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showFoundSheet && (
        <FoundPartSheet
          jobId={jobId}
          repairStage={repairStage}
          onClose={() => setShowFoundSheet(false)}
        />
      )}
    </section>
  );
}

function FoundPartSheet({
  jobId,
  repairStage,
  onClose,
}: {
  jobId: string;
  repairStage: RepairStage;
  onClose: () => void;
}) {
  const { workspaceId } = useWorkspace();
  const addFound = useAddFoundPart(workspaceId);
  const analyze = useServerFn(analyzeRepairPart);

  const [step, setStep] = useState<"capture" | "analyzing" | "review">("capture");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiRaw, setAiRaw] = useState<unknown>(null);
  const [aiConfidence, setAiConfidence] = useState<number>(0);

  const [partName, setPartName] = useState("");
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<PartDiscoveryStage>(stageToDiscovery(repairStage));
  const [qty, setQty] = useState("1");
  const [action, setAction] = useState<PartRecommendedAction>("replace");
  const [related, setRelated] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onPick = async (fl: FileList | null) => {
    const f = fl?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStep("analyzing");

    // Upload photo to a temp path first so AI can see it, THEN save.
    // Simpler: upload to a scratch path, analyze, then reuse on confirm.
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
      const uuid =
        (globalThis.crypto as any)?.randomUUID?.() ??
        Math.random().toString(36).slice(2);
      const scratchPath = `${workspaceId}/${jobId}/found-scratch/${uuid}.${ext}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { error: upErr } = await supabase.storage
        .from("job-photos")
        .upload(scratchPath, f, { contentType: f.type || undefined });
      if (upErr) throw upErr;

      const result = await analyze({
        data: { jobId, photoPath: scratchPath, currentRepairStage: repairStage },
      });
      setPartName(result.detectedPart);
      setReason(result.reasonRequired);
      setStage(result.discoveryStage);
      setQty(String(result.quantity));
      setAction(result.recommendedAction);
      setRelated(result.relatedOriginalDamage);
      setAiConfidence(result.confidence);
      try {
        setAiRaw(JSON.parse(result.rawJson));
      } catch {
        setAiRaw(null);
      }
      setStep("review");
    } catch (e: any) {
      toast.error(e?.message ?? "AI analysis failed — you can still fill manually");
      setStep("review");
    }
  };

  const confirm = async () => {
    if (!file) {
      toast.error("Photo required");
      return;
    }
    if (!partName.trim()) {
      toast.error("Part name required");
      return;
    }
    try {
      await addFound.mutateAsync({
        jobId,
        photoFile: file,
        partName: partName.trim(),
        reasonRequired: reason.trim(),
        discoveryStage: stage,
        quantity: Math.max(1, Number(qty) || 1),
        recommendedAction: action,
        relatedDamage: related.trim(),
        aiSuggestion: aiRaw,
      });
      toast.success("Part request added — pending revision approval");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="w-full max-w-lg bg-card rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between bg-card px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold">Add Part Found During Repair</h3>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "capture" && (
            <>
              <p className="text-sm text-muted-foreground">
                Take a photo of the damaged part. AI will pre-fill the request using this job's context.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background py-10 cursor-pointer active:bg-secondary/40">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-semibold">Open camera</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files)}
                />
              </label>
              <label className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 cursor-pointer">
                <Plus className="h-4 w-4" />
                <span className="text-sm">Choose from gallery</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPick(e.target.files)}
                />
              </label>
            </>
          )}

          {step === "analyzing" && (
            <div className="py-10 flex flex-col items-center gap-3">
              {previewUrl && (
                <img src={previewUrl} alt="" className="h-40 w-40 rounded-2xl object-cover" />
              )}
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI is analyzing with case context…</span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Vehicle, original damage and existing parts are loaded automatically.
              </p>
            </div>
          )}

          {step === "review" && (
            <>
              {previewUrl && (
                <img src={previewUrl} alt="" className="w-full max-h-56 rounded-2xl object-cover" />
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                AI draft — review and confirm
                {aiConfidence > 0 && ` · confidence ${(aiConfidence * 100).toFixed(0)}%`}
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Detected Part *</span>
                <input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Reason Required</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Discovery Stage</span>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as PartDiscoveryStage)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                  >
                    <option value="dismantling">Dismantling</option>
                    <option value="repair">Repair</option>
                    <option value="qc">QC</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">Quantity</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Recommended Action</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["replace", "repair"] as PartRecommendedAction[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAction(a)}
                      className={`rounded-xl border py-3 text-sm font-semibold capitalize ${
                        action === a
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Related Original Damage</span>
                <input
                  value={related}
                  onChange={(e) => setRelated(e.target.value)}
                  placeholder="e.g. Left front bumper impact"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm"
                />
              </label>

              <button
                onClick={confirm}
                disabled={addFound.isPending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {addFound.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Confirm Part Request
              </button>
              <p className="text-[11px] text-muted-foreground text-center">
                Saved to this repair order as a quotation revision — original quotation unchanged.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ============ Quality Control ============

function QcSection({
  jobId,
  stage,
  isStaff,
  profileId,
  reworkCount,
}: {
  jobId: string;
  stage: RepairStage;
  isStaff: boolean;
  profileId: string | null;
  reworkCount: number;
}) {
  const { workspaceId } = useWorkspace();
  const qcQ = useQcRecord(workspaceId, jobId);
  const submit = useSubmitQc(workspaceId);

  const [passed, setPassed] = useState(true);
  const [notes, setNotes] = useState("");
  const [reworkRequired, setReworkRequired] = useState(false);
  const [reworkNotes, setReworkNotes] = useState("");
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);

  const available = stage === "qc" || stage === "completed";

  if (!available) {
    return (
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Quality Control</h2>
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          QC available when job reaches QC stage.
        </div>
      </section>
    );
  }

  const handleSubmit = async () => {
    if (!profileId) {
      toast.error("Profile not loaded");
      return;
    }
    try {
      await submit.mutateAsync({
        jobId,
        inspectedBy: profileId,
        passed,
        notes,
        reworkRequired,
        reworkNotes,
        beforePhoto,
        afterPhoto,
        currentReworkCount: reworkCount,
      });
      toast.success("QC submitted");
      setNotes("");
      setReworkNotes("");
      setBeforePhoto(null);
      setAfterPhoto(null);
      setReworkRequired(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const rec = qcQ.data?.record ?? null;
  const photos = qcQ.data?.photos ?? [];
  const before = photos.filter((p) => p.kind === "qc_before");
  const after = photos.filter((p) => p.kind === "qc_after");

  return (
    <section className="px-5 mt-4">
      <h2 className="text-sm font-semibold tracking-tight mb-2.5">Quality Control</h2>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {qcQ.isLoading ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
        ) : rec ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  rec.passed
                    ? "bg-[--color-success]/15 text-[--color-success]"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {rec.passed ? "Passed" : "Failed"}
              </span>
              {rec.rework_required && (
                <span className="rounded-full bg-yellow-200 text-yellow-900 px-2.5 py-1 text-xs font-semibold">
                  Rework required
                </span>
              )}
            </div>
            {rec.notes && <p className="text-sm whitespace-pre-wrap">{rec.notes}</p>}
            {rec.rework_required && rec.rework_notes && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                Rework: {rec.rework_notes}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              {new Date(rec.created_at).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">No QC record yet.</p>
        )}

        {(before.length > 0 || after.length > 0) && (
          <div className="space-y-2 border-t border-border pt-3">
            {before.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Before</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {before.map((p) => (
                    <a key={p.id} href={p.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={p.signedUrl ?? ""} alt="QC before" className="h-20 w-20 rounded-xl object-cover border border-border bg-secondary" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {after.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">After</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {after.map((p) => (
                    <a key={p.id} href={p.signedUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img src={p.signedUrl ?? ""} alt="QC after" className="h-20 w-20 rounded-xl object-cover border border-border bg-secondary" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isStaff && (
        <div className="rounded-2xl border border-border bg-card p-4 mt-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New QC Inspection
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Before photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setBeforePhoto(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              After photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAfterPhoto(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-xs"
              />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={passed}
                onChange={() => setPassed(true)}
              />
              Passed
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={!passed}
                onChange={() => setPassed(false)}
              />
              Failed
            </label>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reworkRequired}
              onChange={(e) => setReworkRequired(e.target.checked)}
            />
            Rework required
          </label>
          {reworkRequired && (
            <textarea
              value={reworkNotes}
              onChange={(e) => setReworkNotes(e.target.value)}
              placeholder="Rework notes"
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          )}
          <button
            onClick={handleSubmit}
            disabled={submit.isPending}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {submit.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Submit QC"}
          </button>
        </div>
      )}
    </section>
  );
}

// ============ Release ============

function ReleaseSection({
  jobId,
  stage,
  isStaff,
  profileId,
  releasedAt,
  releasedBy,
}: {
  jobId: string;
  stage: RepairStage;
  isStaff: boolean;
  profileId: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
}) {
  const { workspaceId } = useWorkspace();
  const qcQ = useQcRecord(workspaceId, jobId);
  const release = useReleaseJob(workspaceId);
  const releaserQ = useProfileById(releasedBy);

  if (releasedAt) {
    return (
      <section className="px-5 mt-4">
        <h2 className="text-sm font-semibold tracking-tight mb-2.5">Release</h2>
        <div className="rounded-2xl border border-[--color-success]/40 bg-[--color-success]/10 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[--color-success]" />
            <p className="text-sm font-semibold text-[--color-success]">Released</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {new Date(releasedAt).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            Released by {releaserQ.data?.full_name ?? "…"}
          </p>
        </div>
      </section>
    );
  }

  const rec = qcQ.data?.record ?? null;
  const ready = stage === "qc" && rec?.passed === true;

  const handleRelease = async () => {
    if (!profileId) {
      toast.error("Profile not loaded");
      return;
    }
    try {
      await release.mutateAsync({ jobId, profileId });
      toast.success("Vehicle released");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <section className="px-5 mt-4">
      <h2 className="text-sm font-semibold tracking-tight mb-2.5">Release</h2>
      {!ready ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Job not ready for release.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          {isStaff ? (
            <button
              onClick={handleRelease}
              disabled={release.isPending}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {release.isPending ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                "Release Vehicle"
              )}
            </button>
          ) : (
            <p className="text-sm text-center text-muted-foreground">
              Awaiting staff release.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
