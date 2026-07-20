import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import {
  displayRole,
  useEngagementTypes,
  usePositions,
  useSetMemberActive,
  useSetMemberEngagement,
  useSetMemberPositions,
  useSetMemberRole,
  useTeamMember,
  SYSTEM_ROLE_OPTIONS,
} from "@/lib/team";
import type { AppRole } from "@/integrations/supabase/shared-schema";
import { ArrowLeft, Briefcase, Loader2, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/team/$id")({
  head: () => ({
    meta: [{ title: "Team member — DHX Body & Paint" }],
  }),
  component: () => (
    <WorkspaceGate>
      <TeamMemberDetail />
    </WorkspaceGate>
  ),
});

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function TeamMemberDetail() {
  const { id } = Route.useParams();
  const { isAdmin } = useWorkspace();
  const navigate = useNavigate();
  const q = useTeamMember(id);
  const positionsQ = usePositions();
  const engagementsQ = useEngagementTypes();

  const setRole = useSetMemberRole();
  const setPositions = useSetMemberPositions();
  const setEngagement = useSetMemberEngagement();
  const setActive = useSetMemberActive();

  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
  const [positionsDirty, setPositionsDirty] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);

  useEffect(() => {
    if (q.data) {
      setSelectedPositions(new Set((q.data.positions ?? []).map((p) => p.id)));
      setPositionsDirty(false);
    }
  }, [q.data?.id, q.data?.positions]);

  if (q.isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    );
  }
  const m = q.data;
  if (!m) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Team member not found.{" "}
        <Link to="/team" className="text-primary underline">
          Back to team
        </Link>
      </div>
    );
  }

  const readOnly = !isAdmin;

  const handleRole = async (role: AppRole) => {
    if (role === m.system_role) return;
    try {
      await setRole.mutateAsync({ profileId: m.id, role });
      toast.success("Role updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update role");
    }
  };

  const togglePosition = (pid: string) => {
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
    setPositionsDirty(true);
  };

  const savePositions = async () => {
    try {
      await setPositions.mutateAsync({
        profileId: m.id,
        positionIds: Array.from(selectedPositions),
      });
      setPositionsDirty(false);
      toast.success("Positions updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update positions");
    }
  };

  const handleEngagement = async (eid: string) => {
    if (eid === m.engagement_type_id) return;
    try {
      await setEngagement.mutateAsync({ profileId: m.id, engagementTypeId: eid });
      toast.success("Engagement updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update engagement");
    }
  };

  const handleActive = async (active: boolean) => {
    try {
      await setActive.mutateAsync({ profileId: m.id, active });
      toast.success(active ? "Reactivated" : "Deactivated");
      setShowDeactivate(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update status");
    }
  };

  const lastLogin = m.last_login_at ? new Date(m.last_login_at).toLocaleString() : "Never signed in";

  return (
    <div>
      <AppHeader title="Team member" />
      <div className="px-5 pb-2">
        <button
          onClick={() => navigate({ to: "/team" })}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to team
        </button>
      </div>

      <div className="px-5 pb-24 space-y-4">
        {/* Identity */}
        <section className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          {m.avatar_url ? (
            <img src={m.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
              {initialsOf(m.full_name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold truncate">{m.full_name}</p>
            {m.phone && <p className="text-xs text-muted-foreground truncate">{m.phone}</p>}
            {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  m.is_active
                    ? "bg-[--color-success]/15 text-[--color-success]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {m.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                {m.is_active ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {displayRole(m.system_role)}
              </span>
            </div>
          </div>
        </section>

        {/* System Role */}
        <Section title="System Role" subtitle="Controls what this person can access.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SYSTEM_ROLE_OPTIONS.map((r) => {
              const active = m.system_role === r.value;
              return (
                <button
                  key={r.value}
                  disabled={readOnly || setRole.isPending}
                  onClick={() => handleRole(r.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  } ${readOnly ? "opacity-70" : ""}`}
                >
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{r.hint}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Positions */}
        <Section
          title="Job Positions"
          subtitle="What they actually do. Multiple allowed."
          action={
            !readOnly && positionsDirty ? (
              <Button size="sm" onClick={savePositions} disabled={setPositions.isPending}>
                {setPositions.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Save
              </Button>
            ) : null
          }
        >
          <div className="flex flex-wrap gap-2">
            {(positionsQ.data ?? []).map((p) => {
              const active = selectedPositions.has(p.id);
              return (
                <button
                  key={p.id}
                  disabled={readOnly}
                  onClick={() => togglePosition(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-foreground hover:border-primary/40"
                  } ${readOnly ? "opacity-70" : ""}`}
                >
                  {p.label}
                </button>
              );
            })}
            {(positionsQ.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">No positions available.</p>
            )}
          </div>
        </Section>

        {/* Engagement */}
        <Section title="Engagement Type" subtitle="Working relationship.">
          <div className="grid grid-cols-2 gap-2">
            {(engagementsQ.data ?? []).map((e) => {
              const active = m.engagement_type_id === e.id;
              return (
                <button
                  key={e.id}
                  disabled={readOnly || setEngagement.isPending}
                  onClick={() => handleEngagement(e.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  } ${readOnly ? "opacity-70" : ""}`}
                >
                  <p className="text-sm font-semibold">{e.label}</p>
                  <p className="text-[10px] text-muted-foreground">{e.code}</p>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Activity */}
        <Section title="Activity">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Last login" value={m.last_login_at ? timeAgo(m.last_login_at) : "—"} />
            <Stat
              label="Active jobs"
              value={String(m.active_job_count ?? 0)}
              icon={<Briefcase className="h-3 w-3" />}
            />
            <Stat
              label="Member since"
              value={m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Last login: {lastLogin}</p>
        </Section>

        {/* Status */}
        {!readOnly && (
          <Section title="Status">
            {m.is_active ? (
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowDeactivate(true)}
              >
                Deactivate team member
              </Button>
            ) : (
              <Button className="w-full" onClick={() => handleActive(true)} disabled={setActive.isPending}>
                {setActive.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Reactivate team member
              </Button>
            )}
          </Section>
        )}
      </div>

      <Dialog open={showDeactivate} onOpenChange={setShowDeactivate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Deactivate {m.full_name}?
            </DialogTitle>
            <DialogDescription>
              They will immediately lose all access to DHX Body & Paint. Their history and past jobs
              remain untouched. You can reactivate later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeactivate(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleActive(false)}
              disabled={setActive.isPending}
            >
              {setActive.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold">
        {icon}
        {value}
      </p>
    </div>
  );
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
