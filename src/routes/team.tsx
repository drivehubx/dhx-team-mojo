import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { sbCore } from "@/integrations/supabase/shared-schema";
import {
  Loader2,
  Plus,
  UserCheck,
  UserX,
  CheckCircle,
  MessageCircle,
  Search,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  displayRole,
  usePositions,
  useTeamDirectory,
} from "@/lib/team";
import type { TeamDirectoryRow } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — DHX Body & Paint" },
      { name: "description", content: "Team members: roles, positions, engagement." },
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

type StatusFilter = "all" | "active" | "inactive";

function TeamPage() {
  const { isAdmin } = useWorkspace();
  const dir = useTeamDirectory();
  const positionsQ = usePositions();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [positionId, setPositionId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const list = dir.data ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((m) => {
      if (status === "active" && !m.is_active) return false;
      if (status === "inactive" && m.is_active) return false;
      if (positionId && !(m.positions ?? []).some((p) => p.id === positionId)) return false;
      if (!needle) return true;
      const hay = `${m.full_name} ${m.phone ?? ""} ${m.email ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [list, q, status, positionId]);

  return (
    <div>
      <AppHeader title="Team" subtitle={`${filtered.length} of ${list.length} team members`} />

      <div className="px-5 pb-24 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or phone…"
            className="pl-9 h-11"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <div className="mx-1 h-6 w-px bg-border shrink-0" />
          <button
            onClick={() => setPositionId(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              positionId === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            All positions
          </button>
          {(positionsQ.data ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => setPositionId(p.id === positionId ? null : p.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                positionId === p.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {dir.isLoading && (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            </div>
          )}
          {!dir.isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No team members match these filters.
            </div>
          )}
          {filtered.map((m) => (
            <MemberCard key={m.id} m={m} clickable={true} />
          ))}
        </div>
      </div>

      {isAdmin && (
        <>
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Team Member
          </button>
          <AddMemberDialog
            open={open}
            onOpenChange={setOpen}
            onSuccess={() => void dir.refetch()}
          />
        </>
      )}
    </div>
  );
}

function MemberCard({ m, clickable }: { m: TeamDirectoryRow; clickable: boolean }) {
  const positions = m.positions ?? [];
  const inner = (
    <div className="w-full rounded-2xl border border-border bg-card p-4 flex items-center gap-3 text-left hover:border-primary/40 transition-colors">
      {m.avatar_url ? (
        <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {initialsOf(m.full_name)}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{m.full_name}</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary shrink-0">
            {displayRole(m.system_role)}
          </span>
        </div>
        {m.phone && <p className="text-[11px] text-muted-foreground truncate">{m.phone}</p>}
        {positions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {positions.slice(0, 3).map((p) => (
              <span key={p.id} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                {p.label}
              </span>
            ))}
            {positions.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{positions.length - 3}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {m.engagement_label && <span>{m.engagement_label}</span>}
          {typeof m.active_job_count === "number" && m.active_job_count > 0 && (
            <span className="inline-flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {m.active_job_count} active
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            m.is_active
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {m.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
          {m.is_active ? "Active" : "Inactive"}
        </span>
        {clickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  );

  if (!clickable) return inner;
  return (
    <Link to="/team/$id" params={{ id: m.id }} className="block">
      {inner}
    </Link>
  );
}

type CompType = "salary" | "task_based" | "commission";
type InviteRole = "member" | "supervisor" | "manager" | "administrator";

function AddMemberDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  const [compensationType, setCompensationType] = useState<CompType>("salary");
  const [submitting, setSubmitting] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteStep, setInviteStep] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setRole("member");
    setCompensationType("salary");
    setSubmitting(false);
    setInviteToken(null);
    setInviteStep(false);
    setCopied(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;
    setSubmitting(true);
    const { data: token, error } = await sbCore().rpc("invite_crew", {
      p_full_name: fullName.trim(),
      p_phone: phone.trim(),
      p_email: email.trim() || null,
      p_role: role,
      p_compensation_type: compensationType,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Team member added — send them the invite link");
    setInviteToken((token as string | null) ?? null);
    setInviteStep(true);
    onSuccess();
  };

  const handleCopyLink = async () => {
    if (!inviteToken) return;
    const link = `https://dhx-workshop.lovable.app/activate?token=${inviteToken}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!inviteToken || !phone.trim()) return;
    const digits = phone.replace(/\D/g, "");
    const link = `https://dhx-workshop.lovable.app/activate?token=${inviteToken}`;
    const message = `Hi ${fullName}, you've been invited to join DHX Body & Paint. Tap here to activate your account: ${link}`;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  const roleOptions: Array<{ value: InviteRole; label: string }> = [
    { value: "member", label: "Team Member" },
    { value: "supervisor", label: "Supervisor" },
    { value: "manager", label: "Manager" },
    { value: "administrator", label: "Administrator" },
  ];

  const compOptions: Array<{ value: CompType; label: string }> = [
    { value: "salary", label: "Salary" },
    { value: "task_based", label: "Task-based" },
    { value: "commission", label: "Commission" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {inviteStep ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">Team Member Added</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <div className="rounded-full bg-success/15 p-3">
                <CheckCircle className="h-8 w-8 text-success" />
              </div>
              <div>
                <p className="text-base font-semibold">{fullName}</p>
                <p className="text-sm text-muted-foreground">Ready to invite</p>
              </div>
              <div className="grid w-full gap-2">
                <Button
                  type="button"
                  className="w-full gap-2 bg-success text-success-foreground hover:bg-success/90"
                  onClick={handleWhatsApp}
                >
                  <MessageCircle className="h-4 w-4" />
                  Send WhatsApp Invite
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleCopyLink}>
                  {copied ? "Copied!" : "Copy Invite Link"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={reset}>
                  Add Another
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  placeholder="+601X-XXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="member@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>System Role</Label>
                <div className="grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
                  {roleOptions.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                        role === r.value ? "bg-background shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Position and engagement can be set on the team member's page.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Compensation Type</Label>
                <div className="grid grid-cols-3 gap-2 rounded-md bg-muted p-1">
                  {compOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCompensationType(opt.value)}
                      className={`rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                        compensationType === opt.value
                          ? "bg-background shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add Team Member
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
