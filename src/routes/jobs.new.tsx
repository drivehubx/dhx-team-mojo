import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useVehicles, useWorkspaceProfiles, useCreateJob } from "@/lib/jobs";

export const Route = createFileRoute("/jobs/new")({
  head: () => ({
    meta: [
      { title: "New Job — DHX Body & Paint" },
      { name: "description", content: "Create a new workshop job." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <NewJobPage />
    </WorkspaceGate>
  ),
});

function NewJobPage() {
  const { workspaceId } = useWorkspace();
  const navigate = useNavigate();
  const vehiclesQ = useVehicles(workspaceId);
  const profilesQ = useWorkspaceProfiles(workspaceId);
  const create = useCreateJob(workspaceId);

  const [vehicleId, setVehicleId] = useState("");
  const [description, setDescription] = useState("");
  const [workerIds, setWorkerIds] = useState<string[]>([]);

  const toggle = (id: string) =>
    setWorkerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSave = vehicleId.length > 0;

  const onSave = async () => {
    if (!canSave) return;
    try {
      const job = await create.mutateAsync({
        vehicle_id: vehicleId,
        description: description.trim(),
        worker_ids: workerIds,
      });
      toast.success("Job created");
      navigate({ to: "/jobs/$id", params: { id: job.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const vehicles = vehiclesQ.data ?? [];
  const profiles = (profilesQ.data ?? []).filter((p) => p.is_active);

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Link
            to="/jobs"
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight">New Job</h1>
            <p className="text-[11px] text-muted-foreground">Pick a vehicle, assign workers.</p>
          </div>
        </div>
      </header>

      <div className="px-5 mt-4 space-y-3">
        <Field label="Vehicle *">
          {vehiclesQ.isLoading ? (
            <div className="py-3 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            </div>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No vehicles in this workspace. Add one in the main vehicle registry first.
            </p>
          ) : (
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
            >
              <option value="">— Select a vehicle —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number}
                  {v.make || v.model ? ` · ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Damage description, customer requests..."
            rows={4}
            className="w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary resize-none"
          />
        </Field>

        <Field label="Assigned Workers">
          <div className="flex flex-wrap gap-1.5">
            {profiles.length === 0 && (
              <p className="text-xs text-muted-foreground">No active workers.</p>
            )}
            {profiles.map((p) => {
              const on = workerIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs ${
                    on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {p.full_name}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md flex gap-2">
          <Link
            to="/jobs"
            className="flex-1 rounded-xl border border-border bg-card py-3 text-center text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            disabled={!canSave || create.isPending}
            onClick={onSave}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {create.isPending ? "Saving…" : "Save Job"}
          </button>
        </div>
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
