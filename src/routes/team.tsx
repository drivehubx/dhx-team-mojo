import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useWorkspaceProfiles } from "@/lib/jobs";
import { sbCore } from "@/integrations/supabase/shared-schema";
import { Loader2, Plus, UserCheck, UserX } from "lucide-react";
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
  const { isStaff } = useWorkspace();
  const q = useWorkspaceProfiles(useWorkspace().workspaceId);
  const list = q.data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <div>
      <AppHeader title="Team" subtitle={`${list.length} members`} />

      <div className="px-5 space-y-3 pb-24">
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

      {isStaff && (
        <>
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-20 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
          <AddMemberDialog
            open={open}
            onOpenChange={setOpen}
            onAdded={() => {
              setOpen(false);
              void q.refetch();
            }}
          />
        </>
      )}
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"worker" | "manager">("worker");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setEmail("");
    setFullName("");
    setPhone("");
    setRole("worker");
    setSubmitting(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setSubmitting(true);
    const { error } = await sbCore().rpc("invite_member", {
      p_email: email.trim(),
      p_full_name: fullName.trim(),
      p_phone: phone.trim() || null,
      p_role: role,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Member added");
    reset();
    onAdded();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Member must already have a signed-up account.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
              {(["worker", "manager"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`rounded-sm px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    role === r
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add to Team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
