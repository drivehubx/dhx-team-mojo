import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useJobs, type JobWithRels } from "@/lib/jobs";
import { Search, Plus, Car, ChevronRight, Loader2 } from "lucide-react";
import type { JobStatus } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs — DHX Body & Paint" },
      { name: "description", content: "Workshop jobs board." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <JobsPage />
    </WorkspaceGate>
  ),
});

type FilterKey = "Mine" | "All" | "Open" | "In Progress" | "Completed" | "Cancelled" | "Archived";

const statusOfFilter: Record<"Open" | "In Progress" | "Completed" | "Cancelled", JobStatus> = {
  Open: "open",
  "In Progress": "in_progress",
  Completed: "completed",
  Cancelled: "cancelled",
};

const statusChip: Record<JobStatus, { chip: string; label: string }> = {
  open: { chip: "bg-secondary text-foreground", label: "Open" },
  in_progress: { chip: "bg-primary/10 text-primary", label: "In Progress" },
  completed: { chip: "bg-success/15 text-success", label: "Completed" },
  cancelled: { chip: "bg-muted text-muted-foreground", label: "Cancelled" },
};

function roRef(id: string) {
  return "RO-" + id.slice(0, 8).toUpperCase();
}

function JobsPage() {
  const { workspaceId, profile } = useWorkspace();
  const includeArchived = false; // archived shown only via filter chip below? Kept off — jobs list excludes archived by default.
  const q = useJobs(workspaceId, { includeArchived });
  const qArchived = useJobs(workspaceId, { includeArchived: true, includeCancelled: true });
  const jobs = q.data ?? [];
  const archivedJobs = (qArchived.data ?? []).filter((j) => (j as any).archived_at != null);

  const [filter, setFilter] = useState<FilterKey>("All");
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const txt = query.trim().toLowerCase();
    const source =
      filter === "Archived"
        ? archivedJobs
        : filter === "Cancelled"
          ? jobs.filter((j) => j.status === "cancelled")
          : jobs;
    return source.filter((j) => {
      if (filter === "Mine") {
        if (!j.workers.some((w) => w.profile_id === profile?.id)) return false;
      } else if (filter === "All") {
        if (j.status === "cancelled") return false;
      } else if (filter !== "Archived" && filter !== "Cancelled") {
        if (j.status !== statusOfFilter[filter as keyof typeof statusOfFilter]) return false;
      }
      if (!txt) return true;
      const plate = j.vehicle?.plate_number?.toLowerCase() ?? "";
      const make = j.vehicle?.make?.toLowerCase() ?? "";
      const model = j.vehicle?.model?.toLowerCase() ?? "";
      const desc = j.description?.toLowerCase() ?? "";
      return plate.includes(txt) || make.includes(txt) || model.includes(txt) || desc.includes(txt);
    });
  }, [jobs, archivedJobs, filter, query, profile?.id]);

  const filters: FilterKey[] = ["Mine", "All", "Open", "In Progress", "Completed", "Cancelled", "Archived"];

  return (
    <div className="pb-8">
      <AppHeader title="Jobs" subtitle={`${list.length} jobs shown`} />

      <div className="px-5 pt-1 -mt-2 flex justify-end">
        <Link
          to="/vehicles/sold"
          className="text-[11px] font-medium text-muted-foreground hover:text-primary underline underline-offset-2"
        >
          Sold ›
        </Link>
      </div>


      <div className="sticky top-[88px] z-30 px-5 pb-2 pt-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plate · Make · Model · Notes"
            className="w-full h-10 rounded-xl border border-border bg-card pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-2 space-y-2 px-5">
        {q.isLoading && (
          <li className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </li>
        )}
        {!q.isLoading && list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No jobs.
          </li>
        )}
        {list.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </ul>

      <Link
        to="/jobs/new"
        aria-label="New Job"
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
      >
        <Plus className="h-4 w-4" /> New Job
      </Link>
    </div>
  );
}

function JobCard({ job }: { job: JobWithRels }) {
  const meta = statusChip[job.status];
  const archived = (job as any).archived_at != null;
  return (
    <li>
      <Link
        to="/jobs/$id"
        params={{ id: job.id }}
        className={`block rounded-2xl border border-border bg-card px-4 py-3 active:bg-secondary ${
          archived ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {job.vehicle?.plate_number ?? "—"}
            </p>
            <p className="text-[15px] font-semibold leading-tight truncate">
              {[job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ") || (
                <span className="text-muted-foreground">No vehicle</span>
              )}
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/80">{roRef(job.id)}</p>
            {job.description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{job.description}</p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {archived && (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-1 text-[10px] font-semibold">
                Archived
              </span>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.chip}`}>
              {meta.label}
            </span>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex -space-x-1.5">
              {job.workers.slice(0, 3).map((w) => (
                <span
                  key={w.id}
                  title={w.profile?.full_name ?? ""}
                  className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-card text-[9px] font-bold"
                >
                  {(w.profile?.full_name ?? "??").slice(0, 2).toUpperCase()}
                </span>
              ))}
              {job.workers.length === 0 && (
                <span className="text-[11px] text-muted-foreground">Unassigned</span>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
            Open <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}

// Avoid TS unused
export const _car = Car;
