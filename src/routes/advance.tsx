import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { fmtMYR } from "@/lib/mock-data";
import { ArrowDownLeft, ArrowUpRight, Plus, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useAdvances,
  useRequestAdvance,
  useDecideAdvance,
  useRecordRepayment,
  summarizeAdvances,
  balanceByEmployee,
  type AdvanceWithProfile,
} from "@/lib/advances-api";
import { toast } from "sonner";

export const Route = createFileRoute("/advance")({
  head: () => ({
    meta: [
      { title: "Advance — DHX Team Ops" },
      { name: "description", content: "Employee advances: borrow, repayment, balance tracking." },
    ],
  }),
  component: AdvancePage,
});

type Tab = "Pending" | "Borrow" | "Repayment" | "Balance";

function AdvancePage() {
  const { tr } = useT();
  const router = useRouter();
  const { user, loading: authLoading, isStaff } = useAuth();
  const [tab, setTab] = useState<Tab>(isStaff ? "Pending" : "Borrow");
  const [requestOpen, setRequestOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.navigate({ to: "/login" });
  }, [authLoading, user, router]);

  const advancesQ = useAdvances();
  const list = advancesQ.data ?? [];
  const summary = summarizeAdvances(list);

  const pending = list.filter((a) => a.status === "pending");
  const borrows = list.filter((a) => a.type === "borrow" && a.status !== "rejected");
  const repays = list.filter((a) => a.type === "repayment" && a.status === "approved");

  const tabs: Tab[] = isStaff ? ["Pending", "Borrow", "Repayment", "Balance"] : ["Borrow", "Repayment", "Balance"];

  if (authLoading) return <CenterLoader />;

  return (
    <div>
      <AppHeader title={tr("Advance")} subtitle={tr("Employee credit ledger")} />

      <div className="px-5">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label={tr("Borrowed")} value={fmtMYR(summary.totalBorrow)} accent="text-destructive" />
            <Stat label={tr("Repaid")} value={fmtMYR(summary.totalRepay)} accent="text-[--color-success]" />
            <Stat label={tr("Balance")} value={fmtMYR(summary.outstanding)} accent="text-primary" />
          </div>
        </div>
      </div>

      {!isStaff && (
        <div className="mt-4 px-5">
          <button
            onClick={() => setRequestOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> {tr("Request Advance")}
          </button>
        </div>
      )}

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
              {tr(tb)}
              {tb === "Pending" && pending.length > 0 ? ` (${pending.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-5 pb-4">
        {advancesQ.isLoading ? (
          <CenterLoader />
        ) : tab === "Pending" ? (
          <PendingList list={pending} />
        ) : tab === "Borrow" ? (
          <EntryList list={borrows} />
        ) : tab === "Repayment" ? (
          <EntryList list={repays} />
        ) : (
          <BalanceList list={list} onRepay={isStaff ? (id) => setRepayOpen(id) : undefined} />
        )}
      </div>

      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} />}
      {repayOpen && <RepayModal employeeId={repayOpen} onClose={() => setRepayOpen(null)} />}
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
  const { tr } = useT();
  if (list.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">{tr("No entries.")}</p>;
  return (
    <ul className="space-y-2.5">
      {list.map((a) => {
        const isBorrow = a.type === "borrow";
        return (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                isBorrow ? "bg-destructive/10 text-destructive" : "bg-[--color-success]/15 text-[--color-success]"
              }`}
            >
              {isBorrow ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{a.employee?.full_name ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {fmtDate(a.created_at)}
                {a.reason ? ` · ${a.reason}` : ""}
                {a.status === "pending" ? ` · ${tr("Pending")}` : ""}
              </p>
            </div>
            <span className={`text-sm font-semibold ${isBorrow ? "text-destructive" : "text-[--color-success]"}`}>
              {isBorrow ? "-" : "+"}
              {fmtMYR(Number(a.amount))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PendingList({ list }: { list: AdvanceWithProfile[] }) {
  const { tr } = useT();
  const decide = useDecideAdvance();
  if (list.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">{tr("No pending requests.")}</p>;

  const handle = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id, decision });
      toast.success(decision === "approved" ? tr("Approved") : tr("Rejected"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  return (
    <ul className="space-y-2.5">
      {list.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold">
              {a.employee?.initials ?? "??"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{a.employee?.full_name ?? "—"}</p>
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
              <Check className="h-3.5 w-3.5" /> {tr("Approve")}
            </button>
            <button
              onClick={() => handle(a.id, "rejected")}
              disabled={decide.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-destructive px-2 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" /> {tr("Reject")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BalanceList({
  list,
  onRepay,
}: {
  list: AdvanceWithProfile[];
  onRepay?: (employeeId: string) => void;
}) {
  const { tr } = useT();
  const rows = balanceByEmployee(list).filter((r) => r.borrow > 0);
  if (rows.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">{tr("No balances.")}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const pct = r.borrow === 0 ? 0 : Math.round((r.repay / r.borrow) * 100);
        return (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {r.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">{tr("Balance")}</p>
                <p className="text-sm font-semibold text-primary">{fmtMYR(r.balance)}</p>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>
                  {tr("Repaid {a} of {b}", { a: fmtMYR(r.repay), b: fmtMYR(r.borrow) })}
                </span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-[--color-success]" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {onRepay && r.balance > 0 && (
              <button
                onClick={() => onRepay(r.id)}
                className="mt-3 w-full rounded-lg bg-secondary px-2 py-2 text-xs font-semibold"
              >
                {tr("Record Repayment")}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const { tr } = useT();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const m = useRequestAdvance();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!a || a <= 0) return toast.error(tr("Enter a valid amount"));
    try {
      await m.mutateAsync({ amount: a, reason });
      toast.success(tr("Request submitted"));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background rounded-t-3xl p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold">{tr("Request Advance")}</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">{tr("Amount (RM)")}</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted-foreground">{tr("Reason")}</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr("Optional")}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">
            {tr("Cancel")}
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? tr("Submitting…") : tr("Submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

function RepayModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const { tr } = useT();
  const [amount, setAmount] = useState("");
  const m = useRecordRepayment();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!a || a <= 0) return toast.error(tr("Enter a valid amount"));
    try {
      await m.mutateAsync({ employee_id: employeeId, amount: a });
      toast.success(tr("Repayment recorded"));
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background rounded-t-3xl p-5 space-y-3"
      >
        <h2 className="text-lg font-semibold">{tr("Record Repayment")}</h2>
        <label className="block">
          <span className="text-xs text-muted-foreground">{tr("Amount (RM)")}</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">
            {tr("Cancel")}
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {m.isPending ? tr("Saving…") : tr("Save")}
          </button>
        </div>
      </form>
    </div>
  );
}
