import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useWorkspaceProfiles } from "@/lib/jobs";
import {
  useAdvances,
  useRequestAdvance,
  useDecideAdvance,
  useCreateAdvanceOnBehalf,
  useRecordAdvancePayment,
  useReverseAdvance,
  useAdvanceDeductions,
  useAdvanceEvents,
  type AdvanceWithProfile,
  type AdvanceDeduction,
} from "@/lib/advances";
import { round2 } from "@/lib/advance-rules";
import { ArrowDownLeft, Plus, Check, X, Loader2, UserPlus, Banknote, Undo2 } from "lucide-react";

export const Route = createFileRoute("/advance")({
  head: () => ({
    meta: [
      { title: "Advance — DHX Body & Paint" },
      { name: "description", content: "Team member advances: request, approve, pay, track balances." },
      { property: "og:title", content: "Advance — DHX Body & Paint" },
      { property: "og:description", content: "Team member advances: request, approve, pay, track balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <AdvancePage />
    </WorkspaceGate>
  ),
});

type Tab = "Pending" | "Unpaid" | "Outstanding" | "Settled" | "Rejected" | "Log" | "Mine";

const fmtMYR = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const METHODS = [
  { v: "cash", l: "Cash / 现金" },
  { v: "bank", l: "Bank in / 银行转账" },
  { v: "duitnow", l: "DuitNow" },
];

function useBalances(workspaceId: string | null, list: AdvanceWithProfile[]) {
  const ids = list.filter((a) => a.paid_at).map((a) => a.id);
  const dq = useAdvanceDeductions(workspaceId, ids);
  const byAdv = useMemo(() => {
    const m = new Map<string, AdvanceDeduction[]>();
    for (const d of dq.data ?? []) m.set(d.advance_id, [...(m.get(d.advance_id) ?? []), d]);
    return m;
  }, [dq.data]);
  const balance = (a: AdvanceWithProfile) =>
    round2(Number(a.paid_amount ?? 0) - (byAdv.get(a.id) ?? []).reduce((s, d) => s + Number(d.amount), 0));
  return { byAdv, balance };
}

function AdvancePage() {
  const { workspaceId, profile, isAdmin } = useWorkspace();
  const [tab, setTab] = useState<Tab>(isAdmin ? "Pending" : "Mine");
  const [requestOpen, setRequestOpen] = useState(false);
  const [onBehalfOpen, setOnBehalfOpen] = useState(false);

  const q = useAdvances(workspaceId, { mineOnly: !isAdmin, userId: profile?.id });
  const list = (q.data ?? []) as AdvanceWithProfile[];
  const { byAdv, balance } = useBalances(workspaceId, list);

  const pending = list.filter((a) => a.status === "pending");
  const unpaid = list.filter((a) => a.status === "approved");
  const outstanding = list.filter((a) => a.status === "paid" || a.status === "partially_settled");
  const settled = list.filter((a) => a.status === "settled" || a.status === "repaid");
  const rejected = list.filter((a) => a.status === "rejected" || a.status === "reversed");
  const totalOutstanding = outstanding.reduce((s, a) => s + balance(a), 0);
  const totalUnpaid = unpaid.reduce((s, a) => s + Number(a.amount), 0);

  const tabs: Tab[] = isAdmin ? ["Pending", "Unpaid", "Outstanding", "Settled", "Rejected", "Log"] : ["Mine"];
  const shown =
    tab === "Unpaid" ? unpaid : tab === "Outstanding" ? outstanding : tab === "Settled" ? settled : tab === "Rejected" ? rejected : list;

  return (
    <div>
      <AppHeader title="Advance" subtitle="Team member credit ledger" />

      <div className="px-5">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm grid grid-cols-2 gap-2 text-center">
          <Stat label="Approved, not paid" value={fmtMYR(totalUnpaid)} accent="text-warning" />
          <Stat label="Outstanding balance" value={fmtMYR(totalOutstanding)} accent="text-destructive" />
        </div>
      </div>

      <div className="mt-4 px-5 grid gap-2">
        {isAdmin && (
          <button
            onClick={() => setOnBehalfOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" /> Add for Team Member / 帮工友登记
          </button>
        )}
        <button
          onClick={() => setRequestOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> Request Advance
        </button>
      </div>

      {tabs.length > 1 && (
        <div className="mt-5 px-5 overflow-x-auto">
          <div className="flex gap-1 rounded-xl bg-secondary p-1 w-max">
            {tabs.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                  tab === tb ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                {tb === "Unpaid" ? "Approved · unpaid" : tb}
                {tb === "Pending" && pending.length > 0 ? ` (${pending.length})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 px-5 pb-4">
        {q.isLoading ? (
          <CenterLoader />
        ) : tab === "Log" ? (
          <EventLog />
        ) : tab === "Pending" && isAdmin ? (
          <PendingList list={pending} />
        ) : (
          <EntryList list={shown} balance={balance} byAdv={byAdv} canManage={isAdmin} />
        )}
      </div>

      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} />}
      {onBehalfOpen && <OnBehalfModal onClose={() => setOnBehalfOpen(false)} />}
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
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending / 待批",
  approved: "Approved, not paid / 已批未付",
  paid: "Paid / 已付",
  partially_settled: "Partly repaid / 部分已扣",
  settled: "Settled / 已还清",
  repaid: "Settled / 已还清",
  rejected: "Rejected / 拒绝",
  reversed: "Reversed / 已撤销",
};

function EntryList({
  list,
  balance,
  byAdv,
  canManage,
}: {
  list: AdvanceWithProfile[];
  balance: (a: AdvanceWithProfile) => number;
  byAdv: Map<string, AdvanceDeduction[]>;
  canManage: boolean;
}) {
  const [payFor, setPayFor] = useState<AdvanceWithProfile | null>(null);
  const reverse = useReverseAdvance();
  if (list.length === 0) return <p className="text-center text-sm text-muted-foreground py-10">No entries.</p>;

  const doReverse = async (a: AdvanceWithProfile) => {
    const reason = window.prompt("撤销原因 / Reason for reversal");
    if (!reason) return;
    try {
      await reverse.mutateAsync({ id: a.id, reason });
      toast.success("Reversed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <>
      <ul className="space-y-2.5">
        {list.map((a) => {
          const deds = byAdv.get(a.id) ?? [];
          const bal = a.paid_at ? balance(a) : null;
          return (
            <li key={a.id} className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <ArrowDownLeft className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{a.profile?.full_name ?? "—"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {fmtDate(a.created_at)}
                    {a.reason ? ` · ${a.reason}` : ""}
                    {a.entry_mode === "on_behalf" ? " · 代登记" : ""}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {STATUS_LABEL[a.status] ?? a.status}
                    {a.is_legacy ? " · 旧记录未核对 / Legacy" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmtMYR(Number(a.amount))}</p>
                  {bal !== null && <p className="text-[11px] text-destructive">余额 {fmtMYR(bal)}</p>}
                </div>
              </div>
              {a.paid_at && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  付款 Paid {fmtDate(a.paid_at)} · {a.payment_method?.toUpperCase()}
                  {a.payment_reference ? ` · ${a.payment_reference}` : ""}
                </p>
              )}
              {deds.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {deds.map((d) => (
                    <li key={d.id}>
                      {d.period} 工资扣除 −{fmtMYR(Number(d.amount))}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (a.status === "approved" || (a.status === "paid" && deds.length === 0)) && (
                <div className="mt-3 flex gap-2">
                  {a.status === "approved" && (
                    <button
                      onClick={() => setPayFor(a)}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-2 text-xs font-semibold text-primary-foreground"
                    >
                      <Banknote className="h-3.5 w-3.5" /> {a.is_legacy ? "Reconcile / 核对" : "Mark as paid / 已付款"}
                    </button>
                  )}
                  <button
                    onClick={() => doReverse(a)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <Undo2 className="h-3.5 w-3.5" /> Reverse
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {payFor && <PayModal advance={payFor} onClose={() => setPayFor(null)} />}
    </>
  );
}

function PendingList({ list }: { list: AdvanceWithProfile[] }) {
  const { workspaceId, profile } = useWorkspace();
  const decide = useDecideAdvance(workspaceId, profile?.id ?? null);
  if (list.length === 0) return <p className="text-center text-sm text-muted-foreground py-10">No pending requests.</p>;

  const handle = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id, decision });
      toast.success(decision === "approved" ? "Approved — remember to mark as paid when money is given" : "Rejected");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <ul className="space-y-2.5">
      {list.map((a) => (
        <li key={a.id} className="rounded-2xl border border-border bg-card p-3.5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-warning/15 text-warning text-xs font-semibold">
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
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-success px-2 py-2 text-xs font-semibold text-success-foreground disabled:opacity-60"
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

function EventLog() {
  const { workspaceId, isAdmin } = useWorkspace();
  const q = useAdvanceEvents(workspaceId, isAdmin);
  if (q.isLoading) return <CenterLoader />;
  const rows = q.data ?? [];
  if (rows.length === 0) return <p className="text-center text-sm text-muted-foreground py-10">No activity yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li key={e.id} className="rounded-xl border border-border bg-card p-3 text-xs">
          <p className="font-semibold">{e.event}</p>
          <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
          {e.details?.total !== undefined && <p>Total {fmtMYR(Number(e.details.total))} · Cap {fmtMYR(Number(e.details.cap))}</p>}
          {e.details?.amount !== undefined && <p>Amount {fmtMYR(Number(e.details.amount))}</p>}
          {e.details?.reason && <p>Reason: {e.details.reason}</p>}
        </li>
      ))}
    </ul>
  );
}

function Sheet({ children, onClose, onSubmit }: { children: React.ReactNode; onClose: () => void; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/50 flex items-end" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[90vh] overflow-y-auto bg-background rounded-t-3xl p-5 space-y-3"
      >
        {children}
      </form>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary";

function PaymentFields({
  method, setMethod, paidAt, setPaidAt, reference, setReference, s103, setS103,
}: {
  method: string; setMethod: (v: string) => void; paidAt: string; setPaidAt: (v: string) => void;
  reference: string; setReference: (v: string) => void; s103: string; setS103: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => setMethod(m.v)}
            className={`rounded-lg border px-2 py-2 text-xs font-semibold ${
              method === m.v ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Paid date / 付款日期</span>
        <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">Reference (optional) / 转账编号</span>
        <input value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">
          s.103 approval ref — only if advance is more than one month's wages / 超过一个月工资才需要
        </span>
        <input value={s103} onChange={(e) => setS103(e.target.value)} className={inputCls} />
      </label>
    </>
  );
}

function PayModal({ advance, onClose }: { advance: AdvanceWithProfile; onClose: () => void }) {
  const [method, setMethod] = useState("cash");
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState("");
  const [s103, setS103] = useState("");
  const m = useRecordAdvancePayment();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await m.mutateAsync({ id: advance.id, method, paidAt, reference, s103Ref: s103 });
      toast.success("Recorded as paid");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  };
  return (
    <Sheet onClose={onClose} onSubmit={submit}>
      <h2 className="text-lg font-semibold">Mark as paid / 记录已付款</h2>
      <p className="text-sm text-muted-foreground">
        {advance.profile?.full_name} · {fmtMYR(Number(advance.amount))}
      </p>
      <PaymentFields {...{ method, setMethod, paidAt, setPaidAt, reference, setReference, s103, setS103 }} />
      <Actions onClose={onClose} pending={m.isPending} label="Confirm paid" />
    </Sheet>
  );
}

function OnBehalfModal({ onClose }: { onClose: () => void }) {
  const { workspaceId, profile } = useWorkspace();
  const people = useWorkspaceProfiles(workspaceId).data ?? [];
  const [personId, setPersonId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [paidNow, setPaidNow] = useState(true);
  const [method, setMethod] = useState("cash");
  const [paidAt, setPaidAt] = useState(today());
  const [reference, setReference] = useState("");
  const [s103, setS103] = useState("");
  const m = useCreateAdvanceOnBehalf();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!personId) return toast.error("请选择工友 / Choose a Team Member");
    if (!a || a <= 0) return toast.error("Enter a valid amount");
    try {
      await m.mutateAsync({
        profileId: personId, amount: a, reason,
        method: paidNow ? method : null, paidAt: paidNow ? paidAt : null, reference, s103Ref: s103,
      });
      toast.success(paidNow ? "Saved as paid" : "Saved as approved (not paid yet)");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  };

  return (
    <Sheet onClose={onClose} onSubmit={submit}>
      <h2 className="text-lg font-semibold">Add advance for Team Member / 帮工友登记预支</h2>
      <label className="block">
        <span className="text-xs text-muted-foreground">Team Member / 工友</span>
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={inputCls}>
          <option value="">—</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {[100, 300, 500].map((p) => (
          <button key={p} type="button" onClick={() => setAmount(String(p))}
            className={`rounded-lg border px-2 py-2 text-sm font-semibold ${Number(amount) === p ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
            RM {p}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="text-xs text-muted-foreground">Amount (RM) / 金额</span>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">Reason (optional) / 原因</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-4 w-4" />
        Money already given / 钱已经给了
      </label>
      {paidNow && <PaymentFields {...{ method, setMethod, paidAt, setPaidAt, reference, setReference, s103, setS103 }} />}
      <p className="text-[11px] text-muted-foreground">Recorded by / 操作人: {profile?.full_name}</p>
      <Actions onClose={onClose} pending={m.isPending} label="Save" />
    </Sheet>
  );
}

function Actions({ onClose, pending, label }: { onClose: () => void; pending: boolean; label: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm">Cancel</button>
      <button type="submit" disabled={pending}
        className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Saving…" : label}
      </button>
    </div>
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
    <Sheet onClose={onClose} onSubmit={submit}>
      <h2 className="text-lg font-semibold">Request Advance</h2>
      <label className="block">
        <span className="text-xs text-muted-foreground">Amount (RM)</span>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
      </label>
      <label className="block">
        <span className="text-xs text-muted-foreground">Reason</span>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" className={inputCls} />
      </label>
      <Actions onClose={onClose} pending={m.isPending} label="Submit" />
    </Sheet>
  );
}
