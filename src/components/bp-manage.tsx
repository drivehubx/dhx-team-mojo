import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Archive, RotateCcw, Trash2, ShieldAlert, Loader2, X, Copy, Sparkles } from "lucide-react";
import {
  useJobDeleteBlockReason,
  useArchiveBPJob,
  useRestoreBPJob,
  useHardDeleteBPJob,
  useAdminOverride,
  useFindDuplicateJobs,
  useMarkJobDuplicate,
  roRef,
  BP_STAGE_LABEL,
  type BPJob,
} from "@/lib/bp";
import { useWorkspace } from "@/lib/workspace";
import { useT } from "@/lib/i18n";
import { useNavigate } from "@tanstack/react-router";

type ConfirmKind = "archive" | "restore" | "delete" | "override" | "duplicate" | null;

export function BPManageSection({ job }: { job: BPJob }) {
  const { workspaceId, isAdmin, isOwner } = useWorkspace();
  const { tr } = useT();
  const navigate = useNavigate();
  const blockQ = useJobDeleteBlockReason(workspaceId, job.id);
  const archive = useArchiveBPJob(workspaceId);
  const restore = useRestoreBPJob(workspaceId);
  const hardDelete = useHardDeleteBPJob(workspaceId);
  const override = useAdminOverride();
  const markDup = useMarkJobDuplicate(workspaceId);

  const [dialog, setDialog] = useState<ConfirmKind>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [retainedId, setRetainedId] = useState<string | null>(null);

  const dupQ = useFindDuplicateJobs(
    workspaceId,
    job.vehicle_id,
    job.plate_number,
    { enabled: dialog === "duplicate" },
  );

  if (!isAdmin) return null;

  const archived = !!job.archived_at;
  const deleteBlocked = blockQ.data ?? null;

  const close = () => {
    setDialog(null);
    setReason("");
    setConfirmation("");
    setRetainedId(null);
  };

  const onMarkDuplicate = () => {
    if (!retainedId) {
      toast.error(tr("Select the job to keep"));
      return;
    }
    if (!reason.trim()) {
      toast.error(tr("Reason is required"));
      return;
    }
    markDup.mutate(
      { jobId: job.id, retainedJobId: retainedId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(tr("Marked as duplicate"));
          close();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      },
    );
  };

  const onArchive = () =>
    archive.mutate(
      { jobId: job.id, reason },
      {
        onSuccess: () => {
          toast.success(tr("Repair order archived"));
          close();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      },
    );

  const onRestore = () =>
    restore.mutate(job.id, {
      onSuccess: () => {
        toast.success(tr("Repair order restored"));
        close();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    });

  const onDelete = () =>
    hardDelete.mutate(
      { jobId: job.id, confirmation, reason },
      {
        onSuccess: () => {
          toast.success(tr("Repair order permanently deleted"));
          close();
          navigate({ to: "/bp" });
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      },
    );

  const onOverride = () =>
    override.mutate(
      {
        entityType: "workshop.jobs",
        entityId: job.id,
        action: "admin_override",
        reason,
        confirmation,
      },
      {
        onSuccess: () => {
          toast.success(tr("Override recorded in audit log"));
          close();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      },
    );

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{tr("Manage")}</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {tr("Administrative actions. All changes are recorded in the audit log.")}
        </p>

        {archived && (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <p className="font-semibold">{tr("This repair order is archived.")}</p>
            {job.archive_reason && (
              <p className="mt-1 text-muted-foreground">
                {tr("Reason")}: {job.archive_reason}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {archived ? (
            <button
              onClick={() => setDialog("restore")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" /> {tr("Restore")}
            </button>
          ) : (
            <button
              onClick={() => setDialog("archive")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              <Archive className="h-4 w-4" /> {tr("Archive")}
            </button>
          )}
        </div>

        {!archived && job.duplicate_status !== "archived_duplicate" && (
          <button
            onClick={() => setDialog("duplicate")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            <Copy className="h-4 w-4" /> {tr("Mark as duplicate")}
          </button>
        )}

        {isOwner && (
          <>
            <div className="pt-2 border-t border-border">
              {blockQ.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> {tr("Checking…")}
                </p>
              ) : deleteBlocked ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 rounded-xl bg-muted/50 border border-border p-3 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-semibold">{tr("Delete not allowed")}</p>
                      <p className="mt-1 text-muted-foreground">{deleteBlocked}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground opacity-50 cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" /> {tr("Delete")}
                    </button>
                    {!archived && (
                      <button
                        onClick={() => setDialog("archive")}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
                      >
                        <Archive className="h-4 w-4" /> {tr("Archive instead")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setDialog("delete")}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> {tr("Delete permanently")}
                </button>
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-dashed border-destructive/30">
              <p className="text-[11px] font-semibold text-destructive mb-2 uppercase tracking-wider">
                {tr("Danger zone")}
              </p>
              <button
                onClick={() => setDialog("override")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/20"
              >
                <ShieldAlert className="h-4 w-4" /> {tr("Administrative Override")}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                {tr(
                  "Records the override in the permanent audit log. Does not grant the ability to edit or delete protected history — assessment versions, audit records and quotation revisions remain immutable.",
                )}
              </p>
            </div>
          </>
        )}
      </section>

      {dialog === "archive" && (
        <ConfirmModal
          title={tr("Archive repair order")}
          onClose={close}
          onConfirm={onArchive}
          pending={archive.isPending}
          confirmLabel={tr("Archive")}
          tone="neutral"
        >
          <p className="text-sm text-muted-foreground">
            {tr(
              "Archiving hides this order from the active list and keeps all data. You can restore it at any time.",
            )}
          </p>
          <label className="block text-xs">
            <span className="text-muted-foreground">{tr("Reason (optional)")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </ConfirmModal>
      )}

      {dialog === "restore" && (
        <ConfirmModal
          title={tr("Restore repair order")}
          onClose={close}
          onConfirm={onRestore}
          pending={restore.isPending}
          confirmLabel={tr("Restore")}
          tone="neutral"
        >
          <p className="text-sm text-muted-foreground">
            {tr("Restore this repair order back to the active list.")}
          </p>
        </ConfirmModal>
      )}

      {dialog === "delete" && (
        <ConfirmModal
          title={tr("Permanently delete repair order")}
          onClose={close}
          onConfirm={onDelete}
          pending={hardDelete.isPending}
          confirmLabel={tr("Delete permanently")}
          tone="destructive"
          disabled={confirmation !== "DELETE" || reason.trim().length === 0}
        >
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            {tr("This is permanent. All linked data will be removed and cannot be recovered.")}
          </div>
          <label className="block text-xs">
            <span className="text-muted-foreground">
              {tr("Type DELETE to confirm")}
            </span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="DELETE"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">{tr("Reason (required)")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </ConfirmModal>
      )}

      {dialog === "override" && (
        <ConfirmModal
          title={tr("Administrative Override")}
          onClose={close}
          onConfirm={onOverride}
          pending={override.isPending}
          confirmLabel={tr("Record override")}
          tone="destructive"
          disabled={confirmation !== "DELETE" || reason.trim().length === 0}
        >
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs text-destructive">
            {tr(
              "This records an override in the permanent audit log. It does not bypass protected history.",
            )}
          </div>
          <label className="block text-xs">
            <span className="text-muted-foreground">{tr("Type DELETE to confirm")}</span>
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono"
              placeholder="DELETE"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">{tr("Reason (required)")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </ConfirmModal>
      )}

      {dialog === "duplicate" && (
        <ConfirmModal
          title={tr("Mark as duplicate")}
          onClose={close}
          onConfirm={onMarkDuplicate}
          pending={markDup.isPending}
          confirmLabel={tr("Mark as duplicate")}
          tone="destructive"
          disabled={!retainedId || reason.trim().length === 0}
        >
          <p className="text-sm text-muted-foreground">
            {tr(
              "This job will be flagged as a duplicate and become read-only. Pick the real job to keep.",
            )}
          </p>
          {dupQ.isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> {tr("Searching…")}
            </div>
          ) : (dupQ.data ?? []).filter((c) => c.id !== job.id).length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {tr("No possible duplicates found for this vehicle.")}
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(dupQ.data ?? [])
                .filter((c) => c.id !== job.id)
                .map((c) => {
                  const stageLabel = c.repair_stage
                    ? (BP_STAGE_LABEL as Record<string, string>)[c.repair_stage] ?? c.repair_stage
                    : "—";
                  const picked = retainedId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setRetainedId(c.id)}
                      className={`w-full text-left rounded-xl border p-3 text-xs ${
                        picked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{roRef(c.id)}</span>
                        {c.has_ai && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold">
                            <Sparkles className="h-3 w-3" /> {tr("AI done")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-semibold truncate">
                        {c.plate_number ?? "—"} · {c.customer_name ?? tr("No customer")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {stageLabel} · {c.status ?? "—"} · {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  );
                })}
            </div>
          )}
          <label className="block text-xs">
            <span className="text-muted-foreground">{tr("Reason (required)")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </ConfirmModal>
      )}
    </>
  );
}

function ConfirmModal({
  title,
  children,
  onClose,
  onConfirm,
  pending,
  confirmLabel,
  tone,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  confirmLabel: string;
  tone: "neutral" | "destructive";
  disabled?: boolean;
}) {
  const { tr } = useT();
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            {tr("Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={pending || disabled}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
              tone === "destructive"
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
