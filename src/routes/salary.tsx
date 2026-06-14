import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import {
  salaries,
  employees,
  getEmployee,
  fmtMYR,
  netSalary,
  advanceBalance,
} from "@/lib/mock-data";
import {
  Wallet,
  Clock,
  TrendingDown,
  CalendarDays,
  CheckCircle2,
  XCircle,
  HourglassIcon,
} from "lucide-react";

const roleSchema = z.object({
  role: z.enum(["worker", "manager", "owner"]).catch("worker"),
});

export const Route = createFileRoute("/salary")({
  validateSearch: roleSchema,
  head: () => ({
    meta: [
      { title: "Salary — DHX Team Ops" },
      { name: "description", content: "Salary estimate, attendance, and advance requests." },
    ],
  }),
  component: SalaryPage,
});

/* --------------------------------- mock data --------------------------------- */

type Attendance = { worked: number; hours: number; ot: number; late: number };
const attendanceByEmp: Record<string, Attendance> = {
  e1: { worked: 22, hours: 176, ot: 0, late: 0 },
  e2: { worked: 21, hours: 168, ot: 18, late: 2 },
  e3: { worked: 20, hours: 160, ot: 12, late: 3 },
  e4: { worked: 22, hours: 176, ot: 24, late: 1 },
  e5: { worked: 14, hours: 112, ot: 0, late: 0 },
  e6: { worked: 19, hours: 152, ot: 10, late: 4 },
};

function selfIdFor(role: "worker" | "manager" | "owner") {
  if (role === "worker") return "e4"; // Suresh
  return "e1"; // Ron
}

/* ---------------------------- advance request state -------------------------- */

type AdvStatus =
  | "Draft"
  | "Submitted"
  | "Manager Approved"
  | "Owner Approved"
  | "Paid"
  | "Deducting"
  | "Completed"
  | "Rejected"
  | "Cancelled";

type AdvanceRequest = {
  id: string;
  employeeId: string;
  amount: number;
  reason?: string;
  date: string;
  status: AdvStatus;
  remaining: number;
};

const ADV_KEY = "dhx:salary:adv:v1";
const seedRequests: AdvanceRequest[] = [
  { id: "r1", employeeId: "e4", amount: 600, reason: "Bike service", date: "10 Jun", status: "Deducting", remaining: 200 },
  { id: "r2", employeeId: "e2", amount: 300, reason: "Family", date: "08 Jun", status: "Owner Approved", remaining: 300 },
  { id: "r3", employeeId: "e3", amount: 250, date: "12 Jun", status: "Submitted", remaining: 250 },
  { id: "r4", employeeId: "e6", amount: 400, reason: "Rent", date: "01 Jun", status: "Completed", remaining: 0 },
];

function loadRequests(): AdvanceRequest[] {
  if (typeof window === "undefined") return seedRequests;
  try {
    const raw = localStorage.getItem(ADV_KEY);
    if (!raw) return seedRequests;
    return JSON.parse(raw);
  } catch {
    return seedRequests;
  }
}
function saveRequests(r: AdvanceRequest[]) {
  try {
    localStorage.setItem(ADV_KEY, JSON.stringify(r));
  } catch {}
}

const ADV_ELIGIBLE_PCT = 0.5; // up to 50% of basic

/* --------------------------------- helpers ---------------------------------- */

const statusTone: Record<AdvStatus, string> = {
  Draft: "bg-muted text-muted-foreground",
  Submitted: "bg-[--color-warning]/15 text-[--color-warning]",
  "Manager Approved": "bg-primary/10 text-primary",
  "Owner Approved": "bg-primary/10 text-primary",
  Paid: "bg-[--color-success]/15 text-[--color-success]",
  Deducting: "bg-orange-500/15 text-orange-600",
  Completed: "bg-[--color-success]/15 text-[--color-success]",
  Rejected: "bg-destructive/15 text-destructive",
  Cancelled: "bg-muted text-muted-foreground",
};

function activeBalanceFor(empId: string, reqs: AdvanceRequest[]) {
  return reqs
    .filter((r) => r.employeeId === empId && !["Rejected", "Cancelled", "Completed"].includes(r.status))
    .reduce((s, r) => s + r.remaining, 0);
}

/* --------------------------------- page ------------------------------------- */

function SalaryPage() {
  const { tr } = useT();
  const { role } = Route.useSearch();
  const selfId = selfIdFor(role);

  const [requests, setRequests] = useState<AdvanceRequest[]>(() => loadRequests());
  useEffect(() => saveRequests(requests), [requests]);

  const updateStatus = (id: string, status: AdvStatus) =>
    setRequests((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));

  const cancel = (id: string) => {
    updateStatus(id, "Cancelled");
    toast.success(tr("Request cancelled"));
  };

  return (
    <div className="pb-24">
      <AppHeader
        title={tr("Salary")}
        subtitle={
          role === "worker" ? tr("My estimate · June 2026") : role === "manager" ? tr("Team · June 2026") : tr("All staff · June 2026")
        }
      />

      <div className="px-5 -mt-4 space-y-4">
        {role === "worker" && (
          <WorkerView
            empId={selfId}
            requests={requests}
            onRequest={(req) => {
              setRequests((rs) => [req, ...rs]);
              toast.success(tr("Advance request submitted"));
            }}
            onCancel={cancel}
          />
        )}

        {role === "manager" && (
          <ManagerView
            requests={requests}
            onApprove={(id) => {
              updateStatus(id, "Manager Approved");
              toast.success(tr("Forwarded to Owner"));
            }}
            onReject={(id) => {
              updateStatus(id, "Rejected");
              toast.error(tr("Request rejected"));
            }}
          />
        )}

        {role === "owner" && (
          <OwnerView
            requests={requests}
            onFinal={(id) => {
              updateStatus(id, "Owner Approved");
              toast.success(tr("Advance approved"));
            }}
            onReject={(id) => {
              updateStatus(id, "Rejected");
              toast.error(tr("Request rejected"));
            }}
            onPay={(id) => {
              updateStatus(id, "Paid");
              toast.success(tr("Marked paid"));
            }}
          />
        )}
      </div>
    </div>
  );
}

/* --------------------------------- worker ----------------------------------- */

function WorkerView({
  empId,
  requests,
  onRequest,
  onCancel,
}: {
  empId: string;
  requests: AdvanceRequest[];
  onRequest: (r: AdvanceRequest) => void;
  onCancel: (id: string) => void;
}) {
  const { tr } = useT();
  const salary = salaries.find((s) => s.employeeId === empId);
  const att = attendanceByEmp[empId];
  const myReqs = requests.filter((r) => r.employeeId === empId);
  const activeBal = activeBalanceFor(empId, requests);

  const basic = salary?.basic ?? 0;
  const ot = salary?.ot ?? 0;
  const estNet = basic + ot - activeBal;
  const eligible = Math.max(0, Math.round(basic * ADV_ELIGIBLE_PCT) - activeBal);

  return (
    <>
      <SummaryCard
        title={tr("Current month estimate")}
        rows={[
          { label: tr("Base"), value: fmtMYR(basic) },
          { label: tr("OT"), value: `+ ${fmtMYR(ot)}`, tone: "success" },
          { label: tr("Advance deduction"), value: `- ${fmtMYR(activeBal)}`, tone: "destructive" },
        ]}
        total={{ label: tr("Estimated Net"), value: fmtMYR(estNet) }}
      />

      <AttendanceCard a={att} />

      <DeductionPreview basic={basic} ot={ot} advance={activeBal} />

      <RequestAdvance eligible={eligible} empId={empId} onRequest={onRequest} />

      <HistoryList
        title={tr("My Advance History")}
        items={myReqs}
        showEmp={false}
        actions={(r) =>
          r.status === "Submitted" || r.status === "Draft" ? (
            <button
              onClick={() => onCancel(r.id)}
              className="text-[11px] font-semibold text-destructive"
            >
              {tr("Cancel")}
            </button>
          ) : null
        }
      />
    </>
  );
}

/* --------------------------------- manager ---------------------------------- */

function ManagerView({
  requests,
  onApprove,
  onReject,
}: {
  requests: AdvanceRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { tr } = useT();
  const team = employees.filter((e) => e.role !== "Owner");
  const teamIds = new Set(team.map((e) => e.id));

  const totalBase = team.reduce((s, e) => {
    const sal = salaries.find((x) => x.employeeId === e.id);
    return s + (sal?.basic ?? 0);
  }, 0);
  const totalOt = team.reduce((s, e) => {
    const sal = salaries.find((x) => x.employeeId === e.id);
    return s + (sal?.ot ?? 0);
  }, 0);
  const totalAdv = team.reduce((s, e) => s + activeBalanceFor(e.id, requests), 0);
  const estNet = totalBase + totalOt - totalAdv;

  const pending = requests.filter((r) => r.status === "Submitted" && teamIds.has(r.employeeId));

  return (
    <>
      <SummaryCard
        title={tr("Team summary")}
        rows={[
          { label: tr("Base"), value: fmtMYR(totalBase) },
          { label: tr("OT"), value: `+ ${fmtMYR(totalOt)}`, tone: "success" },
          { label: tr("Advance deduction"), value: `- ${fmtMYR(totalAdv)}`, tone: "destructive" },
        ]}
        total={{ label: tr("Estimated Net"), value: fmtMYR(estNet) }}
      />

      <ApprovalQueue
        title={tr("Pending Approval")}
        empty={tr("Nothing to review.")}
        items={pending}
        onApprove={onApprove}
        onReject={onReject}
        approveLabel={tr("Approve → Owner")}
      />

      <TeamAttendance ids={team.map((e) => e.id)} />
    </>
  );
}

/* --------------------------------- owner ------------------------------------ */

function OwnerView({
  requests,
  onFinal,
  onReject,
  onPay,
}: {
  requests: AdvanceRequest[];
  onFinal: (id: string) => void;
  onReject: (id: string) => void;
  onPay: (id: string) => void;
}) {
  const { tr } = useT();

  const totalBase = salaries.reduce((s, x) => s + x.basic, 0);
  const totalOt = salaries.reduce((s, x) => s + x.ot, 0);
  const totalAdv = employees.reduce((s, e) => s + activeBalanceFor(e.id, requests), 0);
  const estNet = totalBase + totalOt - totalAdv;
  const paid = salaries.filter((s) => s.paid).reduce((sum, s) => sum + netSalary(s), 0);

  const awaitingFinal = requests.filter((r) => r.status === "Manager Approved");
  const awaitingPay = requests.filter((r) => r.status === "Owner Approved");

  return (
    <>
      <SummaryCard
        title={tr("Full summary")}
        rows={[
          { label: tr("Base"), value: fmtMYR(totalBase) },
          { label: tr("OT"), value: `+ ${fmtMYR(totalOt)}`, tone: "success" },
          { label: tr("Advance deduction"), value: `- ${fmtMYR(totalAdv)}`, tone: "destructive" },
          { label: tr("Already paid"), value: fmtMYR(paid), tone: "muted" },
        ]}
        total={{ label: tr("Estimated Net"), value: fmtMYR(estNet) }}
      />

      <ApprovalQueue
        title={tr("Final Approval")}
        empty={tr("No pending approvals.")}
        items={awaitingFinal}
        onApprove={onFinal}
        onReject={onReject}
        approveLabel={tr("Final Approve")}
      />

      <ApprovalQueue
        title={tr("Ready to Pay")}
        empty={tr("Nothing to pay out.")}
        items={awaitingPay}
        onApprove={onPay}
        onReject={onReject}
        approveLabel={tr("Mark Paid")}
      />

      <PerEmployeeBreakdown requests={requests} />
    </>
  );
}

/* --------------------------------- shared UI -------------------------------- */

function SectionCard({ title, children, icon }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function SummaryCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: string; tone?: "success" | "destructive" | "muted" }[];
  total: { label: string; value: string };
}) {
  return (
    <SectionCard title={title} icon={<Wallet className="h-3.5 w-3.5" />}>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd
              className={`font-medium ${
                r.tone === "success"
                  ? "text-[--color-success]"
                  : r.tone === "destructive"
                    ? "text-destructive"
                    : r.tone === "muted"
                      ? "text-muted-foreground"
                      : "text-foreground"
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{total.label}</span>
        <span className="text-lg font-semibold tracking-tight text-primary">{total.value}</span>
      </div>
    </SectionCard>
  );
}

function AttendanceCard({ a }: { a: Attendance }) {
  const { tr } = useT();
  return (
    <SectionCard title={tr("Attendance Summary")} icon={<CalendarDays className="h-3.5 w-3.5" />}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label={tr("Days")} value={String(a.worked)} />
        <Stat label={tr("Hours")} value={String(a.hours)} />
        <Stat label={tr("OT Hours")} value={String(a.ot)} accent="text-[--color-success]" />
        <Stat label={tr("Late")} value={String(a.late)} accent={a.late > 0 ? "text-[--color-warning]" : ""} />
      </div>
    </SectionCard>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-secondary p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-base font-semibold tracking-tight ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function DeductionPreview({ basic, ot, advance }: { basic: number; ot: number; advance: number }) {
  const { tr } = useT();
  const est = basic + ot;
  const take = est - advance;
  return (
    <SectionCard title={tr("Deduction Preview")} icon={<TrendingDown className="h-3.5 w-3.5" />}>
      <div className="space-y-2 text-sm">
        <Line label={tr("Salary Estimate")} value={fmtMYR(est)} />
        <Line label={tr("Advance deduction")} value={`- ${fmtMYR(advance)}`} tone="destructive" />
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">{tr("Estimated Take Home")}</span>
          <span className="text-base font-semibold text-primary">{fmtMYR(take)}</span>
        </div>
      </div>
    </SectionCard>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "destructive" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone === "destructive" ? "text-destructive" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

/* --------------------------- request advance form --------------------------- */

function RequestAdvance({
  eligible,
  empId,
  onRequest,
}: {
  eligible: number;
  empId: string;
  onRequest: (r: AdvanceRequest) => void;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const submit = () => {
    const amt = parseInt(amount, 10);
    if (!amt || amt <= 0) {
      toast.error(tr("Enter a valid amount"));
      return;
    }
    if (amt > eligible) {
      toast.error(tr("Exceeds eligible amount"));
      return;
    }
    onRequest({
      id: `r${Date.now()}`,
      employeeId: empId,
      amount: amt,
      reason: reason.trim() || undefined,
      date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      status: "Submitted",
      remaining: amt,
    });
    setAmount("");
    setReason("");
    setOpen(false);
  };

  return (
    <SectionCard title={tr("Advance")} icon={<HourglassIcon className="h-3.5 w-3.5" />}>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-secondary p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tr("Eligible")}</p>
          <p className="mt-1 text-sm font-semibold text-primary">{fmtMYR(eligible)}</p>
        </div>
        <div className="rounded-xl bg-secondary p-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tr("Active Balance")}</p>
          <p className="mt-1 text-sm font-semibold">{fmtMYR(advanceBalance(empId).balance)}</p>
        </div>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          disabled={eligible <= 0}
          className="mt-3 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {tr("Request Advance")}
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={tr("Amount (RM)")}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={tr("Reason (optional)")}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-border py-2 text-sm font-medium"
            >
              {tr("Cancel")}
            </button>
            <button
              onClick={submit}
              className="flex-1 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              {tr("Submit")}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ------------------------------ history list -------------------------------- */

function HistoryList({
  title,
  items,
  showEmp,
  actions,
}: {
  title: string;
  items: AdvanceRequest[];
  showEmp: boolean;
  actions?: (r: AdvanceRequest) => React.ReactNode;
}) {
  const { tr } = useT();
  return (
    <SectionCard title={title} icon={<Clock className="h-3.5 w-3.5" />}>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{tr("No entries.")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const e = getEmployee(r.employeeId);
            return (
              <li key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    {showEmp && <p className="text-sm font-semibold truncate">{e.name}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {r.date}
                      {r.reason ? ` · ${tr(r.reason)}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[r.status]}`}>
                    {tr(r.status)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {tr("Remaining")}: <span className="font-medium text-foreground">{fmtMYR(r.remaining)}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{fmtMYR(r.amount)}</span>
                    {actions?.(r)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ---------------------------- approval queue -------------------------------- */

function ApprovalQueue({
  title,
  empty,
  items,
  onApprove,
  onReject,
  approveLabel,
}: {
  title: string;
  empty: string;
  items: AdvanceRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  approveLabel: string;
}) {
  const { tr } = useT();
  return (
    <SectionCard title={title} icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
      {items.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const e = getEmployee(r.employeeId);
            return (
              <li key={r.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.date}
                      {r.reason ? ` · ${tr(r.reason)}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{fmtMYR(r.amount)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => onReject(r.id)}
                    className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-destructive"
                  >
                    <XCircle className="mr-1 inline h-3 w-3" />
                    {tr("Reject")}
                  </button>
                  <button
                    onClick={() => onApprove(r.id)}
                    className="flex-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    {approveLabel}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ------------------------- manager/owner extra views ------------------------ */

function TeamAttendance({ ids }: { ids: string[] }) {
  const { tr } = useT();
  return (
    <SectionCard title={tr("Team Attendance")} icon={<CalendarDays className="h-3.5 w-3.5" />}>
      <ul className="space-y-2">
        {ids.map((id) => {
          const e = getEmployee(id);
          const a = attendanceByEmp[id];
          if (!a) return null;
          return (
            <li key={id} className="flex items-center justify-between rounded-xl border border-border p-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{e.name}</p>
                <p className="text-[11px] text-muted-foreground">{tr(e.role)}</p>
              </div>
              <div className="flex gap-3 text-[11px]">
                <span>
                  {a.worked}d · {a.hours}h
                </span>
                <span className="text-[--color-success]">OT {a.ot}h</span>
                {a.late > 0 && <span className="text-[--color-warning]">{tr("Late")} {a.late}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

function PerEmployeeBreakdown({ requests }: { requests: AdvanceRequest[] }) {
  const { tr } = useT();
  const rows = useMemo(
    () =>
      salaries.map((s) => {
        const e = getEmployee(s.employeeId);
        const adv = activeBalanceFor(s.employeeId, requests);
        const est = s.basic + s.ot - adv;
        return { e, s, adv, est };
      }),
    [requests],
  );
  return (
    <SectionCard title={tr("Per Employee")} icon={<Wallet className="h-3.5 w-3.5" />}>
      <ul className="space-y-2">
        {rows.map(({ e, s, adv, est }) => (
          <li key={e.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground text-[11px] font-semibold">
                  {e.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{tr(e.role)}</p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  s.paid ? "bg-[--color-success]/15 text-[--color-success]" : "bg-[--color-warning]/15 text-[--color-warning]"
                }`}
              >
                {s.paid ? tr("Paid") : tr("Pending")}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
              <Cell label={tr("Base")} value={fmtMYR(s.basic)} />
              <Cell label={tr("OT")} value={fmtMYR(s.ot)} />
              <Cell label={tr("Adv")} value={`- ${fmtMYR(adv)}`} tone="destructive" />
              <Cell label={tr("Est. Net")} value={fmtMYR(est)} tone="primary" />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "primary" }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p
        className={`font-semibold ${
          tone === "destructive" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
