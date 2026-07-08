import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Loader2, ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkspaceGate, useWorkspace } from "@/lib/workspace";
import { useBPJobs, BP_STAGE_LABEL, type BPJob } from "@/lib/bp";

export const Route = createFileRoute("/bp/")({
  head: () => ({
    meta: [
      { title: "Repair Orders — DHX Body & Paint" },
      { name: "description", content: "Internal body & paint repair orders." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <BPListPage />
    </WorkspaceGate>
  ),
});

function BPListPage() {
  const { workspaceId } = useWorkspace();
  const q = useBPJobs(workspaceId);
  const list = q.data ?? [];

  return (
    <div className="pb-24">
      <AppHeader title="Body & Paint" subtitle={`${list.length} repair orders`} />

      <ul className="px-5 space-y-2">
        {q.isLoading && (
          <li className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </li>
        )}
        {!q.isLoading && list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No repair orders yet. Tap "+ New" to create the first one.
          </li>
        )}
        {list.map((j) => (
          <BPCard key={j.id} job={j} />
        ))}
      </ul>

      <Link
        to="/bp/new"
        aria-label="New Repair Order"
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
      >
        <Plus className="h-4 w-4" /> New
      </Link>
    </div>
  );
}

function BPCard({ job }: { job: BPJob }) {
  return (
    <li>
      <Link
        to="/bp/$id"
        params={{ id: job.id }}
        className="block rounded-2xl border border-border bg-card px-4 py-3 active:bg-secondary"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight truncate">
              {job.customer_name || <span className="text-muted-foreground">No customer</span>}
            </p>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {job.plate_number ?? "—"}
              {" · "}
              {[job.car_make, job.car_model].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-1 text-[10px] font-semibold">
            {BP_STAGE_LABEL[job.repair_stage]}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
            Open <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}
