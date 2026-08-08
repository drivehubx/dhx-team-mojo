import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/Avatar";
import { WorkspaceGate } from "@/lib/workspace";
import { MechanicJobForm } from "@/components/mechanic-job-form";
import {
  useMechanicJob,
  useSetMechanicJobWorkers,
  useUpdateMechanicJob,
} from "@/lib/mechanic-jobs";

export const Route = createFileRoute("/mechanic-jobs/$id")({
  head: () => ({
    meta: [
      { title: "Mechanic Job — DHX Body & Paint" },
      {
        name: "description",
        content: "View and edit a mechanic job, its assigned mechanic and helper.",
      },
      { property: "og:title", content: "Mechanic Job — DHX Body & Paint" },
      {
        property: "og:description",
        content: "View and edit a mechanic job, its assigned mechanic and helper.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <MechanicJobDetailPage />
    </WorkspaceGate>
  ),
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function MechanicJobDetailPage() {
  const { id } = Route.useParams();
  const q = useMechanicJob(id);
  const update = useUpdateMechanicJob();
  const setWorkers = useSetMechanicJobWorkers();

  const job = q.data;
  const saving = update.isPending || setWorkers.isPending;

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-40 mb-4 flex items-center gap-2 bg-navy px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] text-navy-foreground shadow-md">
        <Link
          to="/mechanic-jobs"
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full bg-navy-foreground/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {job?.registration_number ?? "Mechanic Job"}
          </h1>
          {job && (
            <p className="text-xs text-navy-foreground/70">Job #{job.job_no}</p>
          )}
        </div>
      </header>

      {q.isLoading && (
        <div className="py-16 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </div>
      )}

      {!q.isLoading && !job && (
        <div className="mx-5 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Job not found.
        </div>
      )}

      {job && (
        <>
          <section className="mx-5 mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Mechanic &amp; Helper
            </p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <InitialsAvatar initials={job.mechanic ? initials(job.mechanic.name) : "?"} />
                <div>
                  <p className="text-xs text-muted-foreground">Mechanic</p>
                  <p className="text-sm font-semibold">
                    {job.mechanic?.name ?? "Not assigned"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <InitialsAvatar initials={job.helper ? initials(job.helper.name) : "—"} />
                <div>
                  <p className="text-xs text-muted-foreground">Helper</p>
                  <p className="text-sm font-semibold">
                    {job.helper?.name ?? "No helper assigned"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <MechanicJobForm
            key={job.id}
            submitLabel="Save Changes"
            saving={saving}
            defaults={{
              job_date: job.job_date,
              vehicleId: job.vehicle_external_id,
              registration_number: job.registration_number,
              vehicle_make: job.vehicle_make,
              vehicle_model: job.vehicle_model,
              mechanicId: job.mechanic?.id ?? null,
              helperId: job.helper?.id ?? null,
              work_description: job.work_description,
              status: job.status,
              labour_amount: Number(job.labour_amount),
              parts_amount: Number(job.parts_amount),
              notes: job.notes,
            }}
            onSubmit={async (values) => {
              try {
                await update.mutateAsync({
                  id: job.id,
                  job_date: values.job_date,
                  work_description: values.work_description,
                  status: values.status,
                  labour_amount: values.labour_amount,
                  parts_amount: values.parts_amount,
                  notes: values.notes,
                  vehicle_external_id: values.vehicle.id,
                  registration_number: values.vehicle.plate_number,
                  vehicle_make: values.vehicle.make,
                  vehicle_model: values.vehicle.model,
                });
                const changed =
                  values.mechanicId !== (job.mechanic?.id ?? null) ||
                  values.helperId !== (job.helper?.id ?? null);
                if (changed) {
                  await setWorkers.mutateAsync({
                    jobId: job.id,
                    mechanicId: values.mechanicId,
                    helperId: values.helperId,
                  });
                }
                toast.success("Changes saved");
              } catch (e: any) {
                toast.error(e?.message ?? "Could not save changes");
              }
            }}
          />
        </>
      )}
    </div>
  );
}
