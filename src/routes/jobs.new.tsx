import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useCreateJobIntake, useVehicles } from "@/lib/jobs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeChecklist } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/jobs/new")({
  head: () => ({
    meta: [
      { title: "New Job — DHX Body & Paint" },
      { name: "description", content: "Vehicle intake & damage assessment." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <NewJobPage />
    </WorkspaceGate>
  ),
});

type AreaKey = "front" | "rear" | "left" | "right" | "roof" | "interior";
const AREAS: { key: AreaKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "rear", label: "Rear" },
  { key: "left", label: "Left Side" },
  { key: "right", label: "Right Side" },
  { key: "roof", label: "Roof" },
  { key: "interior", label: "Interior" },
];

const MAX_PHOTOS = 5;

function NewJobPage() {
  const { workspaceId, isStaff } = useWorkspace();
  const navigate = useNavigate({ from: "/jobs/new" });

  const vehiclesQ = useVehicles(workspaceId);
  const createJob = useCreateJobIntake(workspaceId);

  const [vehicleId, setVehicleId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [checklist, setChecklist] = useState<IntakeChecklist>({});
  const [damageDescription, setDamageDescription] = useState("");
  const [estimate, setEstimate] = useState("");

  const previews = useMemo(
    () => photos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [photos]
  );

  const vehicles = vehiclesQ.data ?? [];
  const canSubmit =
    isStaff && !!vehicleId && !createJob.isPending && !vehiclesQ.isLoading;

  const onPickPhotos = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setPhotos((prev) => [...prev, ...incoming].slice(0, MAX_PHOTOS));
  };
  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const setArea = (key: AreaKey, patch: Partial<{ checked: boolean; note: string }>) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: {
        checked: prev[key]?.checked ?? false,
        note: prev[key]?.note ?? "",
        ...patch,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const amount = estimate.trim() ? Number(estimate) : null;
    if (amount !== null && !Number.isFinite(amount)) {
      toast.error("Estimate must be a number");
      return;
    }

    createJob.mutate(
      {
        vehicle_id: vehicleId,
        damage_description: damageDescription.trim(),
        estimate_amount: amount,
        intake_checklist: checklist,
        photos,
      },
      {
        onSuccess: (job) => {
          toast.success("Job created");
          navigate({ to: "/jobs/$id", params: { id: job.id } });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create job");
        },
      }
    );
  };

  return (
    <div className="pb-12">
      <header className="sticky top-0 z-40 mb-4 bg-[--color-navy] text-[--color-navy-foreground] pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">
              DHX Body & Paint
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Vehicle Intake</h1>
          </div>
        </div>
      </header>

      <div className="px-5">
        {!isStaff ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Only managers can create jobs.
          </div>
        ) : vehiclesQ.isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1 — Vehicle */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step 1
              </p>
              <label className="mt-1 block text-sm font-semibold" htmlFor="vehicle">
                Vehicle
              </label>
              {vehicles.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No vehicles found. Add a vehicle first.
                </p>
              ) : (
                <select
                  id="vehicle"
                  required
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="" disabled>
                    Select a vehicle
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_number} — {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                    </option>
                  ))}
                </select>
              )}
            </section>

            {/* Step 2 — Photos */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step 2
              </p>
              <h2 className="mt-1 text-sm font-semibold">Damage Photos</h2>
              <p className="text-xs text-muted-foreground">
                Up to {MAX_PHOTOS} photos. {photos.length}/{MAX_PHOTOS} added.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {previews.map((p, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary">
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      aria-label="Remove photo"
                      className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
                    <Camera className="h-5 w-5" />
                    <span className="text-[11px]">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => onPickPhotos(e.target.files)}
                    />
                  </label>
                )}
              </div>
            </section>

            {/* Step 3 — Checklist */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step 3
              </p>
              <h2 className="mt-1 text-sm font-semibold">Condition Checklist</h2>
              <div className="mt-3 space-y-3">
                {AREAS.map((a) => {
                  const v = checklist[a.key] ?? { checked: false, note: "" };
                  return (
                    <div key={a.key} className="rounded-xl border border-border p-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={v.checked}
                          onCheckedChange={(c) => setArea(a.key, { checked: !!c })}
                        />
                        <span className="text-sm font-medium">{a.label}</span>
                      </label>
                      <input
                        type="text"
                        value={v.note}
                        onChange={(e) => setArea(a.key, { note: e.target.value })}
                        placeholder="Notes…"
                        className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Step 4 — Description & estimate */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Step 4
              </p>
              <label className="mt-1 block text-sm font-semibold" htmlFor="damage">
                Damage Description
              </label>
              <Textarea
                id="damage"
                value={damageDescription}
                onChange={(e) => setDamageDescription(e.target.value)}
                placeholder="Describe the overall damage…"
                className="mt-2 min-h-[100px] resize-none"
              />

              <label className="mt-4 block text-sm font-semibold" htmlFor="estimate">
                Estimate (MYR)
              </label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">RM</span>
                <input
                  id="estimate"
                  inputMode="decimal"
                  value={estimate}
                  onChange={(e) => setEstimate(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </section>

            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createJob.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Job
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
