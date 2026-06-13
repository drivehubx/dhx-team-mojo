import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { advances, employees, getEmployee, fmtMYR, advanceBalance } from "@/lib/mock-data";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/advance")({
  head: () => ({
    meta: [
      { title: "Advance — DHX Team Ops" },
      { name: "description", content: "Employee advances: borrow, repayment, balance tracking." },
    ],
  }),
  component: AdvancePage,
});

const tabs = ["Borrow", "Repayment", "Balance"] as const;
type Tab = (typeof tabs)[number];

function AdvancePage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("Borrow");

  const totalBorrow = advances.filter((a) => a.type === "borrow").reduce((s, a) => s + a.amount, 0);
  const totalRepay = advances.filter((a) => a.type === "repayment").reduce((s, a) => s + a.amount, 0);
  const outstanding = totalBorrow - totalRepay;

  return (
    <div>
      <AppHeader title={t("page.advance.title")} subtitle="Employee credit ledger" />

      <div className="px-5 -mt-4">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Borrowed" value={fmtMYR(totalBorrow)} accent="text-destructive" />
            <Stat label="Repaid" value={fmtMYR(totalRepay)} accent="text-[--color-success]" />
            <Stat label="Balance" value={fmtMYR(outstanding)} accent="text-primary" />
          </div>
        </div>
      </div>

      <div className="mt-5 px-5">
        <div className="grid grid-cols-3 rounded-xl bg-secondary p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                tab === t ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 px-5 pb-4">
        {tab === "Borrow" && <EntryList type="borrow" />}
        {tab === "Repayment" && <EntryList type="repayment" />}
        {tab === "Balance" && <BalanceList />}
      </div>
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

function EntryList({ type }: { type: "borrow" | "repayment" }) {
  const list = advances.filter((a) => a.type === type);
  if (list.length === 0)
    return <p className="text-center text-sm text-muted-foreground py-10">No entries.</p>;

  return (
    <ul className="space-y-2.5">
      {list.map((a) => {
        const e = getEmployee(a.employeeId);
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
              <p className="text-sm font-semibold truncate">{e.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {a.date}{a.reason ? ` · ${a.reason}` : ""}
              </p>
            </div>
            <span className={`text-sm font-semibold ${isBorrow ? "text-destructive" : "text-[--color-success]"}`}>
              {isBorrow ? "-" : "+"}{fmtMYR(a.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function BalanceList() {
  const rows = employees
    .filter((e) => e.role !== "Owner")
    .map((e) => ({ e, ...advanceBalance(e.id) }))
    .filter((r) => r.borrow > 0);

  return (
    <ul className="space-y-2.5">
      {rows.map(({ e, borrow, repay, balance }) => {
        const pct = borrow === 0 ? 0 : Math.round((repay / borrow) * 100);
        return (
          <li key={e.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {e.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{e.role}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Balance</p>
                <p className="text-sm font-semibold text-primary">{fmtMYR(balance)}</p>
              </div>
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Repaid {fmtMYR(repay)} of {fmtMYR(borrow)}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-[--color-success]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
