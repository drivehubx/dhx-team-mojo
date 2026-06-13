import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { salaries, getEmployee, fmtMYR, netSalary } from "@/lib/mock-data";
import { ChevronDown, TrendingUp, TrendingDown, Plus, Minus } from "lucide-react";

export const Route = createFileRoute("/salary")({
  head: () => ({
    meta: [
      { title: "Salary — DHX Team Ops" },
      { name: "description", content: "Manage workshop staff salaries: basic, OT, bonus, deductions." },
    ],
  }),
  component: SalaryPage,
});

function SalaryPage() {
  const { t } = useT();
  const total = salaries.reduce((s, x) => s + netSalary(x), 0);
  const paid = salaries.filter((s) => s.paid).reduce((sum, s) => sum + netSalary(s), 0);
  const outstanding = total - paid;

  return (
    <div>
      <AppHeader title={t("page.salary.title")} subtitle="June 2026" />

      <div className="px-5 -mt-4">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <button className="flex w-full items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Payroll month</span>
            <span className="flex items-center gap-1 text-sm font-semibold">
              June 2026 <ChevronDown className="h-4 w-4" />
            </span>
          </button>
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Total payroll</p>
            <p className="text-2xl font-semibold tracking-tight">{fmtMYR(total)}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[--color-success]/10 p-3">
                <p className="text-[11px] text-muted-foreground">Paid</p>
                <p className="text-sm font-semibold text-[--color-success]">{fmtMYR(paid)}</p>
              </div>
              <div className="rounded-xl bg-destructive/10 p-3">
                <p className="text-[11px] text-muted-foreground">Outstanding</p>
                <p className="text-sm font-semibold text-destructive">{fmtMYR(outstanding)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="mt-5 space-y-3 px-5">
        {salaries.map((s) => {
          const e = getEmployee(s.employeeId);
          const net = netSalary(s);
          return (
            <li key={s.employeeId} className="rounded-2xl border border-border bg-card p-4">
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
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                    s.paid
                      ? "bg-[--color-success]/15 text-[--color-success]"
                      : "bg-[--color-warning]/15 text-[--color-warning]"
                  }`}
                >
                  {s.paid ? "Paid" : "Pending"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Row label="Basic" value={fmtMYR(s.basic)} />
                <Row label="OT" value={fmtMYR(s.ot)} icon={<TrendingUp className="h-3 w-3 text-[--color-success]" />} />
                <Row label="Bonus" value={fmtMYR(s.bonus)} icon={<Plus className="h-3 w-3 text-[--color-success]" />} />
                <Row label="Deduction" value={`- ${fmtMYR(s.deduction)}`} icon={<Minus className="h-3 w-3 text-destructive" />} negative />
              </dl>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Net salary</span>
                <span className="text-lg font-semibold tracking-tight text-primary">{fmtMYR(net)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Row({ label, value, icon, negative }: { label: string; value: string; icon?: React.ReactNode; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</dt>
      <dd className={`text-sm font-medium ${negative ? "text-destructive" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}
