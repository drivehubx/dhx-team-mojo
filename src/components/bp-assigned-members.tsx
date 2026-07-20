import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { sbCore } from "@/integrations/supabase/shared-schema";
import { dhxWorkshop } from "@/lib/dhx";
import { useTeamDirectory } from "@/lib/team";
import { useWorkspace } from "@/lib/workspace";
import type { TeamDirectoryRow, UUID } from "@/integrations/supabase/shared-schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

// ---------- types ----------
type JobMemberRow = {
  assignment_id: UUID;
  job_id: UUID;
  role_on_job: string | null;
  profile_id: UUID;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  system_role: string | null;
};

type CoreTeamRow = { id: UUID; name: string };

// ---------- hooks ----------
function useJobMembers(jobId: string) {
  return useQuery({
    queryKey: ["job-members", jobId],
    queryFn: async () => {
      const { data, error } = await dhxWorkshop()
        .from("job_member_directory")
        .select("*")
        .eq("job_id", jobId)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as JobMemberRow[];
    },
  });
}

function useCoreTeams() {
  return useQuery({
    queryKey: ["core-teams"],
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("teams")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CoreTeamRow[];
    },
  });
}

function useSetJobMembers(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: Array<{ profile_id: string; role_on_job: string | null }>) => {
      const { error } = await dhxWorkshop().rpc("set_job_members", {
        p_job_id: jobId,
        p_assignments: assignments,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-members", jobId] }),
  });
}

function useAddTeamToJob(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await dhxWorkshop().rpc("add_team_to_job", {
        p_job_id: jobId,
        p_team_id: teamId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-members", jobId] }),
  });
}

// ---------- helpers ----------
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function primaryPosition(m: TeamDirectoryRow): string {
  return m.positions?.[0]?.label ?? "";
}

// ---------- main component ----------
export function BPAssignedMembers({ jobId }: { jobId: string }) {
  const { canSupervise } = useWorkspace();
  const membersQ = useJobMembers(jobId);
  const [open, setOpen] = useState(false);
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);

  const assigned = membersQ.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Assigned Team Members</h2>
          <p className="text-xs text-muted-foreground">
            {assigned.length} assigned
          </p>
        </div>
        {canSupervise && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTeamPickerOpen(true)}
              className="h-9"
            >
              <Users className="mr-1 h-4 w-4" /> Add a Team
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="h-9">
              <UserPlus className="mr-1 h-4 w-4" /> Assign
            </Button>
          </div>
        )}
      </div>

      {membersQ.isLoading ? (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : assigned.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No one assigned yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {assigned.map((m) => (
            <div
              key={m.assignment_id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initialsOf(m.full_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.full_name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {m.role_on_job || "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canSupervise && (
        <>
          <AssignSheet
            open={open}
            onOpenChange={setOpen}
            jobId={jobId}
            currentAssignments={assigned}
          />
          <TeamPickerSheet
            open={teamPickerOpen}
            onOpenChange={setTeamPickerOpen}
            jobId={jobId}
          />
        </>
      )}
    </section>
  );
}

// ---------- Assign sheet ----------
type Draft = { profile_id: string; role_on_job: string };

function AssignSheet({
  open,
  onOpenChange,
  jobId,
  currentAssignments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  currentAssignments: JobMemberRow[];
}) {
  const dirQ = useTeamDirectory();
  const save = useSetJobMembers(jobId);
  const active = useMemo(
    () => (dirQ.data ?? []).filter((m) => m.is_active),
    [dirQ.data],
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  // Seed local draft from server state whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    const seed: Record<string, Draft> = {};
    for (const a of currentAssignments) {
      seed[a.profile_id] = {
        profile_id: a.profile_id,
        role_on_job: a.role_on_job ?? "",
      };
    }
    setDraft(seed);
    setSearch("");
  }, [open, currentAssignments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q),
    );
  }, [active, search]);

  const toggle = (m: TeamDirectoryRow) => {
    setDraft((d) => {
      const next = { ...d };
      if (next[m.id]) {
        delete next[m.id];
      } else {
        next[m.id] = { profile_id: m.id, role_on_job: primaryPosition(m) };
      }
      return next;
    });
  };

  const setRole = (profileId: string, role: string) => {
    setDraft((d) => ({
      ...d,
      [profileId]: { profile_id: profileId, role_on_job: role },
    }));
  };

  const handleSave = () => {
    const payload = Object.values(draft).map((d) => ({
      profile_id: d.profile_id,
      role_on_job: d.role_on_job.trim() || null,
    }));
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(`Assigned ${payload.length} team member${payload.length === 1 ? "" : "s"}`);
        onOpenChange(false);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle>Assign Team Members</SheetTitle>
        </SheetHeader>
        <div className="px-5 pb-3">
          <Input
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
          {dirQ.isLoading && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!dirQ.isLoading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No active team members match.
            </p>
          )}
          {filtered.map((m) => {
            const selected = !!draft[m.id];
            return (
              <div
                key={m.id}
                className={`rounded-2xl border p-3 transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggle(m)}
                    className="h-5 w-5"
                  />
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {initialsOf(m.full_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.full_name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {primaryPosition(m) || "No position set"}
                      {m.phone ? ` · ${m.phone}` : ""}
                    </p>
                  </div>
                </label>
                {selected && (
                  <div className="mt-2 pl-8">
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Role on this job
                    </label>
                    <Input
                      value={draft[m.id]?.role_on_job ?? ""}
                      onChange={(e) => setRole(m.id, e.target.value)}
                      placeholder="e.g. Painter"
                      className="mt-1 h-10"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <SheetFooter className="border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {Object.keys(draft).length} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Save assignments
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------- Team picker sheet ----------
function TeamPickerSheet({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
}) {
  const teamsQ = useCoreTeams();
  const add = useAddTeamToJob(jobId);

  const handleAdd = (teamId: string, name: string) => {
    add.mutate(teamId, {
      onSuccess: () => {
        toast.success(`Added team "${name}"`);
        onOpenChange(false);
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="p-0 max-h-[70vh] flex flex-col">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Add a Team</SheetTitle>
        </SheetHeader>
        <div className="px-5 pt-2 pb-3">
          <p className="text-xs text-muted-foreground">
            Adds every active member of the team as an individual assignment. You can adjust each
            person afterwards.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
          {teamsQ.isLoading && (
            <div className="py-6 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!teamsQ.isLoading && (teamsQ.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No teams defined.</p>
          )}
          {(teamsQ.data ?? []).map((t) => (
            <button
              key={t.id}
              disabled={add.isPending}
              onClick={() => handleAdd(t.id, t.name)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/50 disabled:opacity-60"
            >
              <span className="text-sm font-semibold">{t.name}</span>
              {add.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
        <SheetFooter className="border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            <X className="mr-1 h-4 w-4" /> Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
