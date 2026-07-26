import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Loader2, ChevronRight, Archive } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkspaceGate, useWorkspace } from "@/lib/workspace";
import { useBPJobs, BP_STAGE_LABEL, roRef, type BPJob, type BPListFilter } from "@/lib/bp";
import { dhxWorkshop } from "@/lib/dhx";
import { useT } from "@/lib/i18n";

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

type ListFilter = BPListFilter | "needs_review";

function useNeedsReviewJobIds(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["bp-needs-review", workspaceId],
    enabled: enabled && !!workspaceId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await dhxWorkshop()
        .from("repair_parts")
        .select("job_id")
        .eq("workspace_id", workspaceId!)
        .eq("revision_status", "pending");
      if (error) throw error;
      const ids = new Set<string>();
      for (const r of (data ?? []) as { job_id: string }[]) ids.add(r.job_id);
      return Array.from(ids);
    },
  });
}

function BPListPage() {
  const { workspaceId, canSupervise } = useWorkspace();
  const { tr } = useT();
  const [filter, setFilter] = useState<ListFilter>("active");
  const reviewQ = useNeedsReviewJobIds(workspaceId, canSupervise);
  const reviewIds = reviewQ.data ?? [];
  // Fetch active jobs to intersect with review ids when filter === needs_review.
  const baseFilter: BPListFilter = filter === "needs_review" ? "active" : filter;
  const q = useBPJobs(workspaceId, baseFilter);
  const allList = q.data ?? [];
  const reviewIdSet = new Set(reviewIds);
  const list =
    filter === "needs_review"
      ? allList.filter((j) => reviewIdSet.has(j.id))
      : allList;
  const needsReviewCount = allList.filter((j) => reviewIdSet.has(j.id)).length;

  const chips: { key: ListFilter; label: string; badge?: number }[] = [
    { key: "active", label: tr("Active") },
    { key: "archived", label: tr("Archived") },
    { key: "cancelled", label: tr("Cancelled") },
  ];
  if (canSupervise) {
    chips.push({
      key: "needs_review",
      label: tr("Needs Review"),
      badge: needsReviewCount,
    });
  }

  return (
    <div className="pb-24">
      <AppHeader title="Body & Paint" subtitle={`${list.length} ${tr("repair orders")}`} />

      <div className="sticky top-[88px] z-30 px-5 pb-2 pt-3 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {chips.map((c) => {
            const active = filter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border"
                }`}
              >
                {c.label}
                {typeof c.badge === "number" && c.badge > 0 && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {c.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <ul className="px-5 space-y-2 mt-2">
        {q.isLoading && (
          <li className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </li>
        )}
        {!q.isLoading && list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {filter === "active"
              ? tr('No repair orders yet. Tap "+ New" to create the first one.')
              : filter === "archived"
                ? tr("No archived repair orders.")
                : filter === "cancelled"
                  ? tr("No cancelled repair orders.")
                  : tr("No repair orders awaiting review.")}
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
        <Plus className="h-4 w-4" /> {tr("New")}
      </Link>
    </div>
  );
}

function BPCard({ job }: { job: BPJob }) {
  const { tr } = useT();
  const archived = !!job.archived_at;
  const cancelled = job.status === "cancelled";
  return (
    <li>
      <Link
        to="/bp/$id"
        params={{ id: job.id }}
        className={`block rounded-2xl border border-border bg-card px-4 py-3 active:bg-secondary ${
          archived ? "opacity-60" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-tight truncate">
              {job.customer_name || <span className="text-muted-foreground">{tr("No customer")}</span>}
            </p>
            <p className="mt-0.5 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {job.plate_number ?? "—"}
              {" · "}
              {[job.car_make, job.car_model].filter(Boolean).join(" ") || "—"}
            </p>
            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/80">{roRef(job.id)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {archived && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-1 text-[10px] font-semibold">
                <Archive className="h-3 w-3" /> {tr("Archived")}
              </span>
            )}
            {cancelled && !archived && (
              <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-1 text-[10px] font-semibold">
                {tr("Cancelled")}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-1 text-[10px] font-semibold">
              {tr(BP_STAGE_LABEL[job.repair_stage])}
            </span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end">
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
            {tr("Open")} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}
