import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { useWorkspaceProfiles } from "@/lib/jobs";
import { sbWorkshop, type WorkshopSalary, type CoreProfile } from "@/integrations/supabase/shared-schema";
import { useAdvances, useRequestAdvance, type AdvanceWithProfile } from "@/lib/advances";
import { Wallet, Loader2, Save, Plus } from "lucide-react";

export const Route = createFileRoute("/salary")({
  head: () => ({
    meta: [
      { title: "Salary — DHX Body & Paint" },
      { name: "description", content: "Monthly salary: basic, allowances, bonus, deductions." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <SalaryPage />
    </WorkspaceGate>
  ),
});

const fmtMYR = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);

const thisPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function SalaryPage() {
  const { profile, workspaceId, isStaff, isOwner, isManager, isWorker } = useWorkspace();
  const profilesQ = useWorkspaceProfiles(workspaceId);

  const [period, setPeriod] = useState(thisPeriod());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [salary, setSalary] = useState<WorkshopSalary | null>(null);
  const [fetching, setFetching] = useState(false);

  const employees = useMemo<CoreProfile[]>(() => {
    if (!profile) return [];
    if (isStaff) return profilesQ.data ?? [];
    return [profile];
  }, [profile, isStaff, profilesQ.data]);

  useEffect(() => {
    if (!profile) return;
    setSelectedId((cur) => cur ?? (isStaff ? employees[0]?.id ?? profile.id : profile.id));
  }, [profile?.id, isStaff, employees.length]);

  useEffect(() => {
    if (!selectedId || !workspaceId) return;
    setFetching(true);
    sbWorkshop()
      .from("salaries")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", selectedId)
      .eq("period", period)
      .maybeSingle()
      .then(({ data }: { data: WorkshopSalary | null }) => {
        setSalary(data);
        setFetching(false);
      });
  }, [selectedId, period, workspaceId]);

  const selectedEmp = employees.find((e) => e.id === selectedId);

  return (
    <div className="pb-24">
      <AppHeader title="Salary" subtitle={isStaff ? "Manage monthly pay" : "My monthly pay"} />

      <div className="px-5 space-y-4">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Period & Employee
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Period</span>
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-[11px] text-muted-foreground">Employee</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={!isStaff}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {fetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <SalaryEditor
            key={`${selectedId}-${period}`}
            workspaceId={workspaceId!}
            employee={selectedEmp ?? null}
            period={period}
            initial={salary}
            isOwner={isOwner}
            isManager={isManager}
            onSaved={(s) => setSalary(s)}
          />
        )}

        {isWorker && profile && workspaceId && (
          <CrewAdvanceSection workspaceId={workspaceId} userId={profile.id} />
        )}
      </div>
    </div>
  );
}

function SalaryEditor({
  workspaceId,
  employee,
  period,
  initial,
  isOwner,
  isManager,
  onSaved,
}: {
  workspaceId: string;
  employee: CoreProfile | null;
  period: string;
  initial: WorkshopSalary | null;
  isOwner: boolean;
  isManager: boolean;
  onSaved: (s: WorkshopSalary) => void;
}) {
  const readOnly = !isOwner;

  const [basic, setBasic] = useState(initial?.basic ?? 0);
  const [allowances, setAllowances] = useState(initial?.allowances ?? 0);
  const [bonus, setBonus] = useState(initial?.bonus ?? 0);
  const [deductions, setDeductions] = useState(initial?.deductions ?? 0);
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const net = useMemo(
    () => Number(basic) + Number(allowances) + Number(bonus) - Number(deductions),
    [basic, allowances, bonus, deductions],
  );

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    const payload = {
      workspace_id: workspaceId,
      profile_id: employee.id,
      period,
      basic: Number(basic) || 0,
      allowances: Number(allowances) || 0,
      bonus: Number(bonus) || 0,
      deductions: Number(deductions) || 0,
      paid,
      notes: notes || null,
    };
    const { data, error } = await sbWorkshop()
      .from("salaries")
      .upsert(payload, { onConflict: "profile_id,period" })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salary saved");
    onSaved(data as WorkshopSalary);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{employee?.full_name ?? "—"}</h2>
          <p className="text-[11px] text-muted-foreground">{period}</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && !isOwner && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              VIEW ONLY
            </span>
          )}
          {initial?.paid && (
            <span className="rounded-full bg-[--color-success]/15 px-2 py-0.5 text-[10px] font-semibold text-[--color-success]">
              PAID
            </span>
          )}
        </div>
      </header>

      <Field label="Basic" value={basic} onChange={setBasic} disabled={readOnly} />
      <Field label="Allowances (OT etc)" value={allowances} onChange={setAllowances} disabled={readOnly} />
      <Field label="Bonus" value={bonus} onChange={setBonus} disabled={readOnly} />
      <Field label="Deductions" value={deductions} onChange={setDeductions} disabled={readOnly} />

      <label className="block">
        <span className="text-[11px] text-muted-foreground">Notes</span>
        <textarea
          value={notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          disabled={readOnly}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
      </label>

      {isOwner && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4"
          />
          <span>Mark as paid</span>
        </label>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Net</span>
        <span className="text-lg font-semibold text-primary">{fmtMYR(net)}</span>
      </div>

      {isOwner && (
        <button
          onClick={save}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {initial ? "Save changes" : "Create record"}
        </button>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
      />
    </label>
  );
}

function CrewAdvanceSection({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const req = useRequestAdvance(workspaceId, userId);
  const histQ = useAdvances(workspaceId, { mineOnly: true, userId });

  const presets = [300, 500, 1000];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const a = Number(amount);
    if (!a || a <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await req.mutateAsync({ amount: a, reason });
      toast.success("Request submitted");
      setAmount("");
      setReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Request Advance
          </h2>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-lg border px-2 py-2 text-sm font-semibold transition-colors ${
                  Number(amount) === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground"
                }`}
              >
                RM {p.toLocaleString()}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-[11px] text-muted-foreground">Or enter amount</span>
            <div className="mt-1 flex items-center rounded-lg border border-border bg-background px-3">
              <span className="text-sm text-muted-foreground">RM</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent px-2 py-2 text-sm outline-none"
              />
            </div>
          </label>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <button
            type="submit"
            disabled={req.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {req.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Request
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My Advance History
        </h2>
        {histQ.isLoading ? (
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        ) : (histQ.data ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">No requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {(histQ.data ?? []).map((a: AdvanceWithProfile) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{fmtMYR(Number(a.amount))}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {new Date(a.created_at).toLocaleDateString()}
                    {a.reason ? ` · ${a.reason}` : ""}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600",
    approved: "bg-[--color-success]/15 text-[--color-success]",
    rejected: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
        map[status] ?? "bg-secondary text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}
