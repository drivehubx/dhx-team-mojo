import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, Loader2, Camera, Plus, Check, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceGate, useWorkspace } from "@/lib/workspace";
import {
  useBPJob,
  useBPPhotos,
  useUploadBPPhotos,
  useUpdateBPCosts,
  useApproveBPQuote,
  useAdvanceBPStage,
  useCreateBPInvoice,
  BP_STAGES,
  BP_STAGE_LABEL,
  type BPRepairStage,
} from "@/lib/bp";
import { BPAssignedMembers } from "@/components/bp-assigned-members";
import { BPParts } from "@/components/bp-parts";
import { BPQuotationRevisions } from "@/components/bp-quotation-revisions";
import { BPAssessmentHistory } from "@/components/bp-assessment-history";
import { BPManageSection } from "@/components/bp-manage";
import { roRef } from "@/lib/bp";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/bp/$id")({
  head: () => ({
    meta: [
      { title: "Repair Order — DHX Body & Paint" },
      { name: "description", content: "Repair order internal view." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <BPDetailPage />
    </WorkspaceGate>
  ),
});

function BPDetailPage() {
  const { id } = Route.useParams();
  const { workspaceId, isAdmin } = useWorkspace();
  const jobQ = useBPJob(workspaceId, id);
  const photosQ = useBPPhotos(workspaceId, id);

  const advance = useAdvanceBPStage(workspaceId);
  const approve = useApproveBPQuote(workspaceId);
  const invoice = useCreateBPInvoice(workspaceId);

  const [showInvoice, setShowInvoice] = useState(false);

  if (jobQ.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const job = jobQ.data;
  if (!job) {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Repair order not found.
      </div>
    );
  }

  const before = (photosQ.data ?? []).filter((p) => p.doc_type === "before");
  const after = (photosQ.data ?? []).filter((p) => p.doc_type === "after");

  const stageIdx = BP_STAGES.indexOf(job.repair_stage);

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-40 mb-4 bg-navy text-navy-foreground pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <Link
            to="/bp"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-white/60 truncate">
              {job.plate_number ?? "—"} · {[job.car_make, job.car_model].filter(Boolean).join(" ")}
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-white/50">{roRef(job.id)}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight truncate">
              {job.customer_name || "No customer"}
            </h1>
            {job.customer_phone && (
              <p className="mt-0.5 text-xs text-white/70">{job.customer_phone}</p>
            )}
          </div>
        </div>
      </header>

      <div className="px-5 space-y-5">
        {job.archived_at && (
          <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm flex items-start gap-2">
            <Archive className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-semibold">This repair order is archived.</p>
              {job.archive_reason && (
                <p className="mt-1 text-xs text-muted-foreground">Reason: {job.archive_reason}</p>
              )}
            </div>
          </div>
        )}
        {/* Stage stepper */}
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold mb-3">Repair Stage</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {BP_STAGES.map((s, i) => {
              const done = i < stageIdx;
              const current = i === stageIdx;
              return (
                <span
                  key={s}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {BP_STAGE_LABEL[s]}
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            {BP_STAGES.filter((s) => s !== job.repair_stage).map((s) => (
              <button
                key={s}
                onClick={() =>
                  advance.mutate(
                    { jobId: job.id, nextStage: s as BPRepairStage },
                    { onError: (e) => toast.error(e instanceof Error ? e.message : "Failed") },
                  )
                }
                className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] hover:bg-secondary"
              >
                → {BP_STAGE_LABEL[s]}
              </button>
            ))}
          </div>
        </section>

        {/* Assigned Team Members */}
        <BPAssignedMembers jobId={job.id} />

        {/* Parts */}
        <BPParts jobId={job.id} repairStage={job.repair_stage ?? null} />

        {/* Quotation Revisions */}
        <BPQuotationRevisions jobId={job.id} />

        {/* Assessment History */}
        <BPAssessmentHistory jobId={job.id} />





        {job.damage_description && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold mb-1">Damage</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{job.damage_description}</p>
          </section>
        )}

        {/* Before photos */}
        <PhotoSection
          title="Before Photos (evidence)"
          jobId={job.id}
          docType="before"
          photos={before}
        />

        {/* Costs */}
        {isAdmin && <CostsCard job={job} />}

        {/* Quote approval */}
        {isAdmin && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Quote</h2>
                <p className="text-xs text-muted-foreground">
                  Estimate: RM {fmt(job.estimate_amount)}
                </p>
              </div>
              {job.estimate_approved ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2.5 py-1 text-[11px] font-semibold">
                  <Check className="h-3.5 w-3.5" /> Approved
                </span>
              ) : (
                <button
                  onClick={() =>
                    approve.mutate(job.id, {
                      onSuccess: () => toast.success("Quote approved"),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                    })
                  }
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Approve quote
                </button>
              )}
            </div>
          </section>
        )}

        {/* After photos */}
        <PhotoSection
          title="After Photos (evidence)"
          jobId={job.id}
          docType="after"
          photos={after}
        />

        {/* Invoice */}
        {isAdmin && (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold">Invoice</h2>
            {job.invoice_no ? (
              <div className="text-sm">
                <p>
                  <span className="text-muted-foreground">No:</span>{" "}
                  <span className="font-mono">{job.invoice_no}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Issued:</span>{" "}
                  {job.invoiced_at ? new Date(job.invoiced_at).toLocaleString() : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Ready date:</span>{" "}
                  {job.ready_date ?? "—"}
                </p>
                <button
                  onClick={() => setShowInvoice(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  <Printer className="h-3.5 w-3.5" /> View / Print
                </button>
              </div>
            ) : (
              <CreateInvoiceForm
                onSubmit={(ready_date) =>
                  invoice.mutate(
                    { jobId: job.id, ready_date },
                    {
                      onSuccess: () => toast.success("Invoice created"),
                      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
                    },
                  )
                }
                pending={invoice.isPending}
              />
            )}
          </section>
        )}

        {/* Manage (admin/owner only) */}
        <BPManageSection job={job} />
      </div>

      {showInvoice && job.invoice_no && (
        <InvoiceModal job={job} onClose={() => setShowInvoice(false)} />
      )}
    </div>
  );
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return Number(n).toFixed(2);
}

function CostsCard({ job }: { job: NonNullable<ReturnType<typeof useBPJob>["data"]> }) {
  const { workspaceId } = useWorkspace();
  const updateCosts = useUpdateBPCosts(workspaceId);

  const [paint, setPaint] = useState(job.paint_cost?.toString() ?? "");
  const [labour, setLabour] = useState(job.labour_cost?.toString() ?? "");
  const [parts, setParts] = useState(job.parts_cost?.toString() ?? "");
  const [other, setOther] = useState(job.other_cost?.toString() ?? "");
  const [sell, setSell] = useState(job.sell_price?.toString() ?? "");

  // Refresh local state when server data changes.
  useEffect(() => {
    setPaint(job.paint_cost?.toString() ?? "");
    setLabour(job.labour_cost?.toString() ?? "");
    setParts(job.parts_cost?.toString() ?? "");
    setOther(job.other_cost?.toString() ?? "");
    setSell(job.sell_price?.toString() ?? "");
  }, [job.id, job.paint_cost, job.labour_cost, job.parts_cost, job.other_cost, job.sell_price]);

  const toNum = (v: string): number | null => {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const preview = useMemo(() => {
    const tp = (toNum(paint) ?? 0) + (toNum(labour) ?? 0) + (toNum(parts) ?? 0) + (toNum(other) ?? 0);
    const sp = toNum(sell) ?? 0;
    return { total: tp, profit: sp - tp };
  }, [paint, labour, parts, other, sell]);

  const save = () => {
    updateCosts.mutate(
      {
        jobId: job.id,
        paint_cost: toNum(paint),
        labour_cost: toNum(labour),
        parts_cost: toNum(parts),
        other_cost: toNum(other),
        sell_price: toNum(sell),
      },
      {
        onSuccess: () => toast.success("Costs saved"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
      },
    );
  };

  const money = "rounded-xl border border-border bg-background px-3 py-2 text-sm";

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold mb-3">Costs (internal)</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">
          <span className="text-muted-foreground">Paint</span>
          <input value={paint} onChange={(e) => setPaint(e.target.value)} inputMode="decimal" className={`mt-1 w-full ${money}`} />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Labour</span>
          <input value={labour} onChange={(e) => setLabour(e.target.value)} inputMode="decimal" className={`mt-1 w-full ${money}`} />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Parts</span>
          <input value={parts} onChange={(e) => setParts(e.target.value)} inputMode="decimal" className={`mt-1 w-full ${money}`} />
        </label>
        <label className="text-xs">
          <span className="text-muted-foreground">Other</span>
          <input value={other} onChange={(e) => setOther(e.target.value)} inputMode="decimal" className={`mt-1 w-full ${money}`} />
        </label>
        <label className="text-xs col-span-2">
          <span className="text-muted-foreground">Sell price</span>
          <input value={sell} onChange={(e) => setSell(e.target.value)} inputMode="decimal" className={`mt-1 w-full ${money}`} />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total cost</span>
        <span className="font-semibold">RM {preview.total.toFixed(2)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Profit</span>
        <span className={`font-semibold ${preview.profit > 0 ? "text-success" : preview.profit < 0 ? "text-destructive" : ""}`}>
          RM {preview.profit.toFixed(2)}
        </span>
      </div>
      <button
        onClick={save}
        disabled={updateCosts.isPending}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {updateCosts.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save costs
      </button>
      {(job.total_cost !== null || job.profit !== null) && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Server-computed total: RM {fmt(job.total_cost)} · profit: RM {fmt(job.profit)}
        </p>
      )}
    </section>
  );
}

function PhotoSection({
  title,
  jobId,
  docType,
  photos,
}: {
  title: string;
  jobId: string;
  docType: "before" | "after";
  photos: Array<{ id: string; signedUrl: string | null }>;
}) {
  const { workspaceId } = useWorkspace();
  const upload = useUploadBPPhotos(workspaceId);
  const [busy, setBusy] = useState(false);

  const onPick = async (fl: FileList | null) => {
    if (!fl || !fl.length) return;
    setBusy(true);
    try {
      await upload.mutateAsync({ jobId, docType, files: Array.from(fl) });
      toast.success("Photos uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) =>
          p.signedUrl ? (
            <img
              key={p.id}
              src={p.signedUrl}
              alt=""
              className="aspect-square w-full rounded-xl object-cover border border-border"
            />
          ) : (
            <div key={p.id} className="aspect-square rounded-xl bg-secondary" />
          ),
        )}
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
          <Camera className="h-5 w-5" />
          <span className="text-[11px]">Camera</span>
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        </label>
        <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
          <Plus className="h-5 w-5" />
          <span className="text-[11px]">Gallery</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPick(e.target.files)} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Evidence — no AI editing.</p>
    </section>
  );
}

function CreateInvoiceForm({
  onSubmit,
  pending,
}: {
  onSubmit: (ready_date: string | null) => void;
  pending: boolean;
}) {
  const [date, setDate] = useState("");
  return (
    <div className="space-y-2">
      <label className="block text-xs">
        <span className="text-muted-foreground">Ready date</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <button
        disabled={pending}
        onClick={() => onSubmit(date || null)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        Create invoice
      </button>
    </div>
  );
}

function InvoiceModal({
  job,
  onClose,
}: {
  job: NonNullable<ReturnType<typeof useBPJob>["data"]>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 print:static print:bg-white print:p-0">
      <div className="w-full max-w-md rounded-2xl bg-white text-black p-6 shadow-xl print:rounded-none print:shadow-none print:max-w-full">
        <div className="flex items-center justify-between print:hidden mb-4">
          <h3 className="text-base font-semibold">Invoice</h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-black text-white px-3 py-1.5 text-xs font-semibold"
            >
              Print
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full bg-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">DHX Body & Paint</p>
            <p className="mt-1 font-mono text-lg">{job.invoice_no}</p>
            <p className="text-xs text-neutral-500">
              {job.invoiced_at ? new Date(job.invoiced_at).toLocaleString() : ""}
            </p>
          </div>
          <hr />
          <div>
            <p className="text-xs text-neutral-500">Customer</p>
            <p className="font-medium">{job.customer_name ?? "—"}</p>
            {job.customer_phone && <p className="text-xs">{job.customer_phone}</p>}
          </div>
          <div>
            <p className="text-xs text-neutral-500">Vehicle</p>
            <p className="font-medium">
              {job.plate_number ?? "—"} · {[job.car_make, job.car_model].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          {job.ready_date && (
            <div>
              <p className="text-xs text-neutral-500">Ready date</p>
              <p className="font-medium">{job.ready_date}</p>
            </div>
          )}
          <hr />
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">Amount</span>
            <span className="text-lg font-semibold">RM {fmt(job.sell_price)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
