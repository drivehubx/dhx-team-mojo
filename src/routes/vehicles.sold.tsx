import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ChevronRight, ArchiveX } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { WorkspaceGate, useWorkspace } from "@/lib/workspace";
import { useSoldVehicles } from "@/lib/jobs";
import type { CoreVehicle } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/vehicles/sold")({
  head: () => ({
    meta: [
      { title: "Sold Vehicles — DHX Body & Paint" },
      { name: "description", content: "Archive of vehicles marked as sold." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <SoldPage />
    </WorkspaceGate>
  ),
});

function SoldPage() {
  const { workspaceId } = useWorkspace();
  const q = useSoldVehicles(workspaceId);
  const list = q.data ?? [];

  return (
    <div className="pb-24">
      <AppHeader title="Sold Vehicles" subtitle={`${list.length} archived`} />

      <ul className="px-5 space-y-2">
        {q.isLoading && (
          <li className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </li>
        )}
        {!q.isLoading && list.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <ArchiveX className="mx-auto mb-2 h-5 w-5 opacity-60" />
            No sold vehicles.
          </li>
        )}
        {list.map((v) => (
          <SoldCard key={v.id} v={v} />
        ))}
      </ul>
    </div>
  );
}

function SoldCard({ v }: { v: CoreVehicle }) {
  const soldOn = v.updated_at ? new Date(v.updated_at).toLocaleDateString() : "—";
  return (
    <li className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {v.plate_number}
          </p>
          <p className="text-[15px] font-semibold leading-tight truncate">
            {[v.make, v.model].filter(Boolean).join(" ") || "—"}
            {v.year ? ` · ${v.year}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Sold on {soldOn}</p>
        </div>
        <span className="shrink-0 inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-1 text-[10px] font-semibold uppercase">
          Sold
        </span>
      </div>
      <div className="mt-2 flex items-center justify-end">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary"
        >
          Back to jobs <ChevronRight className="h-3.5 w-3.5" />
        </Link>

      </div>
    </li>
  );
}
