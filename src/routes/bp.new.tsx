import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Camera, X, AlertTriangle, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceGate, useWorkspace } from "@/lib/workspace";
import { useCreateBPJob, BP_SOURCE_OPTIONS, findDuplicateJobs, roRef, BP_STAGE_LABEL, type BPSource, type DuplicateCandidate, type BPRepairStage } from "@/lib/bp";

export const Route = createFileRoute("/bp/new")({
  head: () => ({
    meta: [
      { title: "New Repair Order — DHX Body & Paint" },
      { name: "description", content: "Create a body & paint repair order." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <BPNewPage />
    </WorkspaceGate>
  ),
});

const MAX_PHOTOS = 10;

function BPNewPage() {
  const { workspaceId, isAdmin } = useWorkspace();
  const navigate = useNavigate({ from: "/bp/new" });
  const createJob = useCreateBPJob(workspaceId);

  const [customer_name, setCustomerName] = useState("");
  const [customer_phone, setCustomerPhone] = useState("");
  const [plate_number, setPlate] = useState("");
  const [car_make, setMake] = useState("");
  const [car_model, setModel] = useState("");
  const [source, setSource] = useState<BPSource>("walk_in");
  const [damage_description, setDamage] = useState("");
  const [estimate, setEstimate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const previews = useMemo(
    () => photos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [photos],
  );

  const onPick = (fl: FileList | null) => {
    if (!fl) return;
    setPhotos((p) => [...p, ...Array.from(fl)].slice(0, MAX_PHOTOS));
  };
  const remove = (i: number) => setPhotos((p) => p.filter((_, k) => k !== i));

  const doCreate = (dupOverrideReason?: string) => {
    let amount: number | null = null;
    if (isAdmin && estimate.trim()) {
      amount = Number(estimate);
      if (!Number.isFinite(amount)) {
        toast.error("Estimate must be a number");
        return;
      }
    }
    createJob.mutate(
      {
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
        plate_number: plate_number.trim().toUpperCase(),
        car_make: car_make.trim(),
        car_model: car_model.trim(),
        source,
        damage_description: damage_description.trim(),
        ...(isAdmin ? { estimate_amount: amount } : {}),
        asDraft: !isAdmin,
        before_photos: photos,
        ...(dupOverrideReason ? { duplicate_override_reason: dupOverrideReason } : {}),
      },
      {
        onSuccess: (job) => {
          toast.success("Repair order created");
          navigate({ to: "/bp/$id", params: { id: job.id } });
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to create"),
      },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer_name.trim() || !plate_number.trim()) {
      toast.error("Customer name and plate number are required");
      return;
    }
    setChecking(true);
    try {
      const dups = await findDuplicateJobs(null, plate_number.trim().toUpperCase());
      if (dups.length > 0) {
        setDuplicates(dups);
        setChecking(false);
        return;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Duplicate check failed");
    }
    setChecking(false);
    doCreate();
  };

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
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">
              DHX Body & Paint
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Repair Order</h1>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="px-5 space-y-5">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">Customer & Vehicle</h2>
          <Field label="Customer name *">
            <input
              value={customer_name}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Phone">
            <input
              value={customer_phone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
              className={inputCls}
            />
          </Field>
          <Field label="Plate number *">
            <input
              value={plate_number}
              onChange={(e) => setPlate(e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make">
              <input value={car_make} onChange={(e) => setMake(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Model">
              <input value={car_model} onChange={(e) => setModel(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as BPSource)}
              className={inputCls}
            >
              {BP_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Before Photos</h2>
          <p className="text-xs text-muted-foreground">
            {photos.length}/{MAX_PHOTOS} added
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {previews.map((p, i) => (
              <div
                key={i}
                className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary"
              >
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
                  <Camera className="h-5 w-5" />
                  <span className="text-[11px]">Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={(e) => onPick(e.target.files)}
                  />
                </label>
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
                  <Plus className="h-5 w-5" />
                  <span className="text-[11px]">Gallery</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onPick(e.target.files)}
                  />
                </label>
              </>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">{isAdmin ? "Damage & Quote" : "Damage"}</h2>
          <Field label="Damage description">
            <Textarea
              value={damage_description}
              onChange={(e) => setDamage(e.target.value)}
              className="min-h-[100px] resize-none"
              placeholder="Describe the damage…"
            />
          </Field>
          {isAdmin && (
            <Field label="Estimate (RM)">
              <input
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                inputMode="decimal"
                className={inputCls}
                placeholder="0.00"
              />
            </Field>
          )}
        </section>

        <button
          type="submit"
          disabled={createJob.isPending || checking}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
        >
          {createJob.isPending || checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {checking ? "Checking for duplicates…" : "Create Repair Order"}
        </button>
      </form>

      {duplicates && (
        <DuplicateWarningSheet
          candidates={duplicates}
          reason={overrideReason}
          setReason={setOverrideReason}
          onContinueExisting={(id) => {
            setDuplicates(null);
            setOverrideReason("");
            navigate({ to: "/bp/$id", params: { id } });
          }}
          onCreateSeparate={() => {
            const r = overrideReason.trim();
            if (!r) {
              toast.error("Please provide a reason for creating a separate job");
              return;
            }
            setDuplicates(null);
            doCreate(r);
          }}
          onCancel={() => {
            setDuplicates(null);
            setOverrideReason("");
          }}
          creating={createJob.isPending}
        />
      )}
    </div>
  );
}

function DuplicateWarningSheet({
  candidates,
  reason,
  setReason,
  onContinueExisting,
  onCreateSeparate,
  onCancel,
  creating,
}: {
  candidates: DuplicateCandidate[];
  reason: string;
  setReason: (v: string) => void;
  onContinueExisting: (id: string) => void;
  onCreateSeparate: () => void;
  onCancel: () => void;
  creating: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-card border border-border p-5 shadow-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold">Possible existing job for this vehicle</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {candidates.length} active repair order{candidates.length > 1 ? "s" : ""} found for the same plate. Continue an existing job, or record a reason to create a separate one.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {candidates.map((c) => {
            const stageLabel = c.repair_stage
              ? (BP_STAGE_LABEL as Record<string, string>)[c.repair_stage] ?? c.repair_stage
              : "—";
            return (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground">{roRef(c.id)}</p>
                    <p className="text-sm font-semibold truncate">
                      {c.plate_number ?? "—"} · {c.customer_name ?? "No customer"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      {c.status ?? "—"}
                    </span>
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                      {stageLabel}
                    </span>
                    {c.has_ai && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 text-[10px] font-semibold">
                        <Sparkles className="h-3 w-3" /> AI done
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {c.photo_count} photo{c.photo_count === 1 ? "" : "s"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onContinueExisting(c.id)}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  Continue Existing Job
                </button>
              </div>
            );
          })}
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs font-semibold">Create a separate job instead</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Reason (e.g. Separate accident, Different repair scope, Previous job already completed)"
            className="text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onCreateSeparate}
              disabled={creating || !reason.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Separate Job
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
