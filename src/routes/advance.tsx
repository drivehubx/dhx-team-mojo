import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useAdvances, useRequestAdvance, useDecideAdvance, type AdvanceWithProfile } from "@/lib/advances";
import { ArrowDownLeft, Plus, Check, X, Loader2 } from "lucide-react";

export const Route = createFileRoute("/advance")({
  head: () => ({
    meta: [
      { title: "Advance — DHX Body & Paint" },
      { name: "description", content: "Team member advances: request, approve, track." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <AdvancePage />
    </WorkspaceGate>
  ),
});

type Tab = "Pending" | "Approved" | "Rejected" | "Mine";

const fmtMYR = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);

function AdvancePage() {
  const { workspaceId, profile, isStaff } = useWorkspace();
  const [tab, setTab] = useState<Tab>(isStaff ? "Pending" : "Mine");
  const [requestOpen, setRequestOpen] = useState(false);

  const q = useAdvances(workspaceId, {
    mineOnly: !isStaff,
    userId: profile?.id,
  });
  const list = q.data ?? [];

  const pending = list.filter((a) => a.status === "pending");
  const approved = list.filter((a) => a.status === "approved");
  const rejected = list.filter((a) => a.status === "rejected");

  const totalApproved = approved.reduce((s, a) => s + Number(a.amount), 0);
  const totalPending = pending.reduce((s, a) => s + Number(a.amount), 0);

  const tabs: Tab[] = isStaff ? ["Pending", "Approved", "Rejected"] : ["Mine"];
  const shown =
    tab === "Pending" ? pending : tab === "Approved" ? approved : tab === "Rejected" ? rejected : list;

  return (
    <div>
      <AppHeader title="Advance" subtitle="Team member credit ledger" />

      <div className="px-5">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm grid grid-cols-2 gap-2 text-center">
          <Stat label="Pending" value={fmtMYR(totalPending)} accent="text-[--color-warning]" />
          <Stat label="Approved" value={fmtMYR(totalApproved)} accent="text-[--color-success]" />
        </div>
      </div>

      <div className="mt-4 px-5">
        <button
          onClick={() => setRequestOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Request Advance
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="mt-5 px-5">
          <div className={`grid grid-cols-${tabs.length} rounded-xl bg-secondary p-1`}>
            {tabs.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  tab === tb ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                {tb}
                {tb === "Pending" && pending.length > 0 ? ` (${pending.length})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 px-5 pb-4">
        {q.isLoading ? (
          <CenterLoader />
        ) : tab === "Pending" && isStaff ? (
          <PendingList list={pending} />
        ) : (
          <EntryList list={shown} />
        )}
      </div>

      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold tracking-tight ${accent}`}>{value}</p>
    </div>
  );
}

function CenterLoader() {
  return (
    <div className="py-10 text-center text-muted-foreground">
      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]}`;
}

function EntryList({ list }: { list: AdvanceWithProfile[] }) {
  if (list.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">No entries.</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{a.profile?.full_name ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {fmtDate(a.created_at)}
              {a.reason ? ` · ${a.reason}` : ""}
              {` · ${a.status}`}
            </p>
          </div>
          <span className="text-sm font-semibold text-destructive">{fmtMYR(Number(a.amount))}</span>
        </li>
      ))}
    </ul>
  );
}

function PendingList({ list }: { list: AdvanceWithProfile[] }) {
  const { workspaceId, profile } = useWorkspace();
  const decide = useDecideAdvance(workspaceId, profile?.id ?? null);
  if (list.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">No pending requests.</p>;

  const handle = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id, decision });
      toast.success(decision === "approved" ? "Approved" : "Rejected");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <ul className="space-y-2.5">
      {list.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold">
              {(a.profile?.full_name ?? "??").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{a.profile?.full_name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {fmtDate(a.created_at)}
                {a.reason ? ` · ${a.reason}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold text-destructive">{fmtMYR(Number(a.amount))}</span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handle(a.id, "approved")}
              disabled={decide.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[--color-success] px-2 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={() => handle(a.id, "rejected")}
              disabled={decide.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-destructive px-2 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const { workspaceId, profile } = useWorkspace();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const m = useRequestAdvance(workspaceId, profile?.id ?? null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!a || a <= 0) return toast.error("Enter a valid amount");
    try {
      await m.mutateAsync({ amount: a, reason });
      toast.success("Request submitted");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background rounded-t-3xl p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold">Request Advance</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">Amount (RM)</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">Reason</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional"
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
