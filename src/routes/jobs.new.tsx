import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import {
  useCreateJob,
  useVehicles,
  useWorkspaceProfiles,
} from "@/lib/jobs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

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
  const { workspaceId, isStaff } = useWorkspace();
  const navigate = useNavigate({ from: "/jobs/new" });

  const vehiclesQ = useVehicles(workspaceId);
  const profilesQ = useWorkspaceProfiles(workspaceId);
  const createJob = useCreateJob(workspaceId);

  const [vehicleId, setVehicleId] = useState("");
  const [workerIds, setWorkerIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  const vehicles = vehiclesQ.data ?? [];
  const profiles = profilesQ.data ?? [];

  const isLoading = vehiclesQ.isLoading || profilesQ.isLoading;
  const canSubmit =
    isStaff && !!vehicleId && !createJob.isPending && !isLoading;

  const toggleWorker = (id: string) => {
    setWorkerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createJob.mutate(
      {
        vehicle_id: vehicleId,
        description,
        worker_ids: workerIds,
      },
      {
        onSuccess: () => {
          toast.success("Job created");
          navigate({ to: "/jobs" });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to create job");
        },
      }
    );
  };

  return (
    <div className="pb-8">
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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">New Job</h1>
          </div>
        </div>
      </header>

      <div className="px-5">
        {!isStaff ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Only owners and managers can create jobs.
          </div>
        ) : isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <label className="block text-sm font-medium" htmlFor="vehicle">
                Vehicle <span className="text-destructive">*</span>
              </label>
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
                    {v.plate_number} — {v.make} {v.model}
                  </option>
                ))}
              </select>
              {vehicles.length === 0 && !vehiclesQ.isLoading && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No vehicles in this workspace.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-medium">Assigned Workers</h2>
              <p className="text-xs text-muted-foreground">Optional — select one or more.</p>
              <div className="mt-3 space-y-3">
                {profiles.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3 hover:bg-secondary/50 cursor-pointer"
                  >
                    <Checkbox
                      id={`worker-${p.id}`}
                      checked={workerIds.includes(p.id)}
                      onCheckedChange={() => toggleWorker(p.id)}
                    />
                    <span className="text-sm font-medium">{p.full_name}</span>
                  </label>
                ))}
                {profiles.length === 0 && !profilesQ.isLoading && (
                  <p className="text-sm text-muted-foreground">No team members found.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <label className="block text-sm font-medium" htmlFor="description">
                Description
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes about the job…"
                className="mt-2 min-h-[120px] resize-none"
              />
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
