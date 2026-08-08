import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkspaceGate } from "@/lib/workspace";
import {
  MECHANIC_JOB_STATUS_LABELS,
  formatMYR,
  useMechanicJobs,
  type MechanicJobStatus,
  type MechanicJobWithWorkers,
} from "@/lib/mechanic-jobs";

export const Route = createFileRoute("/mechanic-jobs/")({
  head: () => ({
    meta: [
      { title: "Mechanic Jobs — DHX Body & Paint" },
      {
        name: "description",
        content: "Simple mechanic job records: vehicle, crew, status and labour.",
      },
      { property: "og:title", content: "Mechanic Jobs — DHX Body & Paint" },
      {
        property: "og:description",
        content: "Simple mechanic job records: vehicle, crew, status and labour.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <MechanicJobsPage />
    </WorkspaceGate>
  ),
});

const statusChip: Record<MechanicJobStatus, string> = {
  checking: "bg-secondary text-foreground",
  repairing: "bg-primary/10 text-primary",
  waiting_parts: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
};

function MechanicJobsPage() {
  const q = useMechanicJobs();
  const jobs = q.data ?? [];

  return (
    <div className="pb-28">
      <AppHeader title="Mechanic Jobs" subtitle={`${jobs.length} jobs`} />

      <ul className="mt-2 space-y-2 px-5">
        {q.isLoading && (
          <li className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </li>
        )}
        {!q.isLoading && jobs.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No mechanic jobs yet.
          </li>
        )}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ul>

      <Link
        to="/mechanic-jobs/new"
        aria-label="New Job"
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
      >
        <Plus className="h-4 w-4" /> New Job
      </Link>
    </div>
  );
}

function JobCard({ job }: { job: MechanicJobWithWorkers }) {
  return (
    <li>
      <Link
        to="/mechanic-jobs/$id"
        params={{ id: job.id }}
        className="block rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{job.job_date}</p>
            <p className="mt-0.5 text-base font-semibold tracking-tight">
              {job.registration_number}
            </p>
            <p className="text-xs text-muted-foreground">
              {[job.vehicle_make, job.vehicle_model].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${statusChip[job.status]}`}
          >
            {MECHANIC_JOB_STATUS_LABELS[job.status]}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <p>
              <span className="text-muted-foreground/70">Mechanic:</span>{" "}
              <span className="font-medium text-foreground">{job.mechanic?.name ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground/70">Helper:</span>{" "}
              <span className="font-medium text-foreground">
                {job.helper?.name ?? "No helper"}
              </span>
            </p>
          </div>
          <p className="text-sm font-semibold">{formatMYR(job.labour_amount)}</p>
        </div>
      </Link>
    </li>
  );
}
