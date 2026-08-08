import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { WorkspaceGate } from "@/lib/workspace";
import { MechanicJobForm } from "@/components/mechanic-job-form";
import { useCreateMechanicJob } from "@/lib/mechanic-jobs";

export const Route = createFileRoute("/mechanic-jobs/new")({
  head: () => ({
    meta: [
      { title: "New Mechanic Job — DHX Body & Paint" },
      {
        name: "description",
        content: "Create a mechanic job: vehicle, mechanic, helper, status and amounts.",
      },
      { property: "og:title", content: "New Mechanic Job — DHX Body & Paint" },
      {
        property: "og:description",
        content: "Create a mechanic job in a single quick form.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <NewMechanicJobPage />
    </WorkspaceGate>
  ),
});

function NewMechanicJobPage() {
  const navigate = useNavigate();
  const create = useCreateMechanicJob();

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
        <h1 className="text-lg font-semibold tracking-tight">New Mechanic Job</h1>
      </header>

      <MechanicJobForm
        submitLabel="Create Job"
        saving={create.isPending}
        onSubmit={(values) => {
          create.mutate(values, {
            onSuccess: (job) => {
              toast.success("Job created");
              void navigate({ to: "/mechanic-jobs/$id", params: { id: job.id } });
            },
            onError: (e: any) => toast.error(e?.message ?? "Could not create job"),
          });
        }}
      />
    </div>
  );
}
