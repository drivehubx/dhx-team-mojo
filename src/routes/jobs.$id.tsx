import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useJob, useUpdateJobStatus } from "@/lib/jobs";
import type { JobStatus } from "@/integrations/supabase/shared-schema";

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

function JobDetailPage() {
  const { id } = Route.useParams();
  const { workspaceId, isStaff } = useWorkspace();
  const q = useJob(workspaceId, id);
  const update = useUpdateJobStatus(workspaceId);

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!q.data) throw notFound();
  const job = q.data;

  const setStatus = async (s: JobStatus) => {
    try {
      await update.mutateAsync({ id: job.id, status: s });
      toast.success(`Status: ${statusLabel[s]}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

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
          <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
            {statusLabel[job.status]}
          </span>
        </div>
      </header>

      <section className="px-5 mt-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
          <p className="mt-2 text-sm whitespace-pre-wrap">
            {job.description || <span className="text-muted-foreground">No description.</span>}
          </p>
        </div>
      </section>

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
    </div>
  );
}

// keep AppHeader import alive (used elsewhere in tree)
export const _h = AppHeader;
