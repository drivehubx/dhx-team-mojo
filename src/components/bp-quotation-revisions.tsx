import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2, Check, X, Plus, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { dhxWorkshop } from "@/lib/dhx";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { useWorkspace, canSupervise } from "@/lib/workspace";

type RevisionRow = {
  id: string;
  workspace_id: string;
  job_id: string;
  revision_number: number;
  previous_total: number | null;
  additional_amount: number | null;
  new_total: number | null;
  reason: string | null;
  related_part_ids: string[] | null;
  status: "pending" | "approved" | "rejected" | "superseded";
  approval_method: string | null;
  created_at: string;
  decided_at: string | null;
};

type PartOption = {
  id: string;
  part_name: string;
  quantity: number;
  unit_cost: number | null;
  revision_status: string | null;
};

function useRevisions(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["bp-revisions", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const { data, error } = await dhxWorkshop()
        .from("quotation_revisions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("job_id", jobId)
        .order("revision_number", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RevisionRow[];
    },
  });
}

function usePendingCostedParts(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["bp-pending-costed-parts", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const { data, error } = await dhxWorkshop()
        .from("repair_parts")
        .select("id, part_name, quantity, unit_cost, revision_status, quotation_revision_id")
        .eq("workspace_id", workspaceId!)
        .eq("job_id", jobId)
        .eq("revision_status", "pending")
        .is("quotation_revision_id", null);
      if (error) throw error;
      const rows = (data ?? []) as (PartOption & {
        quotation_revision_id: string | null;
      })[];
      return rows.filter((p) => (p.unit_cost ?? 0) > 0);
    },
  });
}

export function BPQuotationRevisions({ jobId }: { jobId: string }) {
  const { tr } = useT();
  const { workspaceId, role, isAdmin } = useWorkspace();
  const canSee = canSupervise(role);
  const revisionsQ = useRevisions(workspaceId, jobId);
  const pendingPartsQ = usePendingCostedParts(workspaceId, jobId);
  const [createOpen, setCreateOpen] = useState(false);

  if (!canSee) return null;

  const revisions = revisionsQ.data ?? [];
  const pendingParts = pendingPartsQ.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{tr("Quotation Revisions")}</h2>
          <p className="text-xs text-muted-foreground">
            {tr("Previous approved total stays in force until a revision is approved.")}
          </p>
        </div>
      </div>

      {revisionsQ.isLoading ? (
        <div className="py-3 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : revisions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {tr("No revisions yet.")}
        </p>
      ) : (
        <ul className="space-y-3">
          {revisions.map((r) => (
            <RevisionCard key={r.id} rev={r} isAdmin={isAdmin} jobId={jobId} />
          ))}
        </ul>
      )}

      {pendingParts.length > 0 && (
        <button
          onClick={() => setCreateOpen((v) => !v)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary"
        >
          <Plus className="h-4 w-4" />
          {tr("Create Quotation Revision")}
          <span className="text-xs opacity-70">
            ({pendingParts.length} {tr("pending parts")})
          </span>
        </button>
      )}

      {createOpen && (
        <CreateRevisionForm
          jobId={jobId}
          parts={pendingParts}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </section>
  );
}

function CreateRevisionForm({
  jobId,
  parts,
  onClose,
}: {
  jobId: string;
  parts: PartOption[];
  onClose: () => void;
}) {
  const { tr } = useT();
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    parts.forEach((p) => (m[p.id] = true));
    return m;
  });
  const [reason, setReason] = useState("");

  const additional = useMemo(
    () =>
      parts.reduce(
        (sum, p) =>
          selected[p.id]
            ? sum + (Number(p.unit_cost) || 0) * (Number(p.quantity) || 0)
            : sum,
        0,
      ),
    [parts, selected],
  );

  const create = useMutation({
    mutationFn: async () => {
      const partIds = parts.filter((p) => selected[p.id]).map((p) => p.id);
      if (!partIds.length) throw new Error("Select at least one part");
      const { error } = await dhxWorkshop().rpc("create_quotation_revision", {
        p_job_id: jobId,
        p_additional: additional,
        p_reason: reason || null,
        p_part_ids: partIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp-revisions", workspaceId, jobId] });
      qc.invalidateQueries({ queryKey: ["bp-pending-costed-parts", workspaceId, jobId] });
      qc.invalidateQueries({ queryKey: ["bp-parts", workspaceId, jobId] });
      toast.success(tr("Revision created"));
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-xl border border-border bg-background p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {tr("Select parts to include")}
      </p>
      <ul className="space-y-1.5">
        {parts.map((p) => {
          const line = (Number(p.unit_cost) || 0) * (Number(p.quantity) || 0);
          return (
            <li key={p.id}>
              <label className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={!!selected[p.id]}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [p.id]: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                <span className="flex-1 truncate">
                  {p.part_name} × {p.quantity}
                </span>
                <span className="tabular-nums">RM {line.toFixed(2)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div>
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          {tr("Reason")}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={tr("e.g. Hidden damage found during dismantling")}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{tr("Additional amount")}</span>
        <span className="text-lg font-semibold text-[--color-success]">
          + RM {additional.toFixed(2)}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
        >
          {tr("Cancel")}
        </button>
        <button
          disabled={create.isPending || additional <= 0}
          onClick={() => create.mutate()}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {tr("Submit for approval")}
        </button>
      </div>
    </div>
  );
}

function RevisionCard({
  rev,
  isAdmin,
  jobId,
}: {
  rev: RevisionRow;
  isAdmin: boolean;
  jobId: string;
}) {
  const { tr } = useT();
  const qc = useQueryClient();
  const { workspaceId } = useWorkspace();

  const statusLabel: Record<RevisionRow["status"], string> = {
    pending: "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    superseded: "Superseded",
  };
  const statusTone: Record<RevisionRow["status"], string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    approved: "bg-[--color-success]/15 text-[--color-success]",
    rejected: "bg-destructive/15 text-destructive",
    superseded: "bg-secondary text-muted-foreground",
  };

  const decide = useMutation({
    mutationFn: async (approve: boolean) => {
      const { data: userRes } = await supabase.auth.getUser();
      const method = userRes.user ? "in_app" : "in_app";
      const { error } = await dhxWorkshop().rpc("decide_quotation_revision", {
        p_revision_id: rev.id,
        p_approve: approve,
        p_method: method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp-revisions", workspaceId, jobId] });
      qc.invalidateQueries({ queryKey: ["bp-pending-costed-parts", workspaceId, jobId] });
      qc.invalidateQueries({ queryKey: ["bp-parts", workspaceId, jobId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, jobId] });
      toast.success(tr("Revision updated"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <li className="rounded-xl border border-border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          {tr("Revision")} #{rev.revision_number}
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[rev.status]}`}
        >
          {tr(statusLabel[rev.status])}
        </span>
      </div>

      <div className="rounded-lg bg-secondary/40 p-3 space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{tr("Original")}</span>
          <span className="tabular-nums font-medium">
            RM {Number(rev.previous_total ?? 0).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[--color-success]">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3" /> {tr("Revision")} +
            {rev.revision_number}
          </span>
          <span className="tabular-nums font-semibold">
            + RM {Number(rev.additional_amount ?? 0).toFixed(2)}
          </span>
        </div>
        <div className="mt-1 border-t border-border pt-1 flex items-center justify-between">
          <span className="font-semibold">{tr("New Total")}</span>
          <span className="text-xl font-bold tabular-nums">
            RM {Number(rev.new_total ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      {rev.reason && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
          {rev.reason}
        </p>
      )}

      {rev.status === "pending" && isAdmin && (
        <div className="flex gap-2">
          <button
            disabled={decide.isPending}
            onClick={() => decide.mutate(false)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> {tr("Reject")}
          </button>
          <button
            disabled={decide.isPending}
            onClick={() => decide.mutate(true)}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> {tr("Approve")}
          </button>
        </div>
      )}
    </li>
  );
}
