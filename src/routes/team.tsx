import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useWorkspaceProfiles } from "@/lib/jobs";
import { Loader2, UserCheck, UserX } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — DHX Body & Paint" },
      { name: "description", content: "Workshop team members." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <TeamPage />
    </WorkspaceGate>
  ),
});

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function TeamPage() {
  const { workspaceId } = useWorkspace();
  const q = useWorkspaceProfiles(workspaceId);
  const list = q.data ?? [];

  return (
    <div>
      <AppHeader title="Team" subtitle={`${list.length} members`} />

      <div className="px-5 space-y-3 pb-12">
        {q.isLoading && (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        )}
        {!q.isLoading && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No team members yet.
          </div>
        )}
        {list.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {initialsOf(p.full_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.full_name}</p>
              {p.phone && <p className="text-[11px] text-muted-foreground truncate">{p.phone}</p>}
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                p.is_active
                  ? "bg-[--color-success]/15 text-[--color-success]"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {p.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
              {p.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
