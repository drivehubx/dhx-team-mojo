import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/salary")({
  head: () => ({
    meta: [
      { title: "Salary — DHX Body & Paint" },
      { name: "description", content: "Monthly salary: basic, OT, bonus, deduction." },
    ],
  }),
  component: SalaryPage,
});

type Profile = { id: string; full_name: string; initials: string | null };
type Salary = {
  id: string;
  employee_id: string;
  period: string;
  basic: number;
  ot: number;
  bonus: number;
  deduction: number;
  paid: boolean;
  notes: string | null;
};

const fmtMYR = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);

const thisPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function SalaryPage() {
  const { user, profile, isOwner, isManager, loading } = useAuth();
  const isStaff = isOwner || isManager;

  const [period, setPeriod] = useState(thisPeriod());
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [salary, setSalary] = useState<Salary | null>(null);
  const [fetching, setFetching] = useState(false);

  // Load employees (staff) or default to self (worker)
  useEffect(() => {
    if (!user) return;
    if (isStaff) {
      supabase
        .from("profiles")
        .select("id, full_name, initials")
        .order("full_name")
        .then(({ data }) => {
          const list = (data ?? []) as Profile[];
          setEmployees(list);
          setSelectedId((cur) => cur ?? list[0]?.id ?? user.id);
        });
    } else {
      setSelectedId(user.id);
      if (profile) setEmployees([{ id: user.id, full_name: profile.full_name, initials: profile.initials }]);
    }
  }, [user?.id, isStaff, profile?.full_name]);

  // Load salary for selected employee + period
  useEffect(() => {
    if (!selectedId) return;
    setFetching(true);
    supabase
      .from("salaries")
      .select("*")
      .eq("employee_id", selectedId)
      .eq("period", period)
      .maybeSingle()
      .then(({ data }) => {
        setSalary((data as Salary) ?? null);
        setFetching(false);
      });
  }, [selectedId, period]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Please sign in to view salary.</div>
    );
  }

  const selectedEmp = employees.find((e) => e.id === selectedId);

  return (
    <div className="pb-24">
      <AppHeader
        title="Salary"
        subtitle={isStaff ? "Manage monthly pay" : "My monthly pay"}
      />

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
            employee={selectedEmp ?? null}
            period={period}
            initial={salary}
            isOwner={isOwner}
            isManager={isManager}
            onSaved={(s) => setSalary(s)}
          />
        )}
      </div>
    </div>
  );
}

function SalaryEditor({
  employee,
  period,
  initial,
  isOwner,
  isManager,
  onSaved,
}: {
  employee: Profile | null;
  period: string;
  initial: Salary | null;
  isOwner: boolean;
  isManager: boolean;
  onSaved: (s: Salary) => void;
}) {
  const isStaff = isOwner || isManager;
  const canEditBasic = isOwner;
  const canEditOps = isOwner || isManager; // OT/Bonus/Deduction/Notes
  const canTogglePaid = isOwner;
  const readOnly = !isStaff;

  const [basic, setBasic] = useState(initial?.basic ?? 0);
  const [ot, setOt] = useState(initial?.ot ?? 0);
  const [bonus, setBonus] = useState(initial?.bonus ?? 0);
  const [deduction, setDeduction] = useState(initial?.deduction ?? 0);
  const [paid, setPaid] = useState(initial?.paid ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const net = useMemo(
    () => Number(basic) + Number(ot) + Number(bonus) - Number(deduction),
    [basic, ot, bonus, deduction],
  );

  const save = async () => {
    if (!employee) return;
    setSaving(true);
    const payload = {
      employee_id: employee.id,
      period,
      basic: Number(basic) || 0,
      ot: Number(ot) || 0,
      bonus: Number(bonus) || 0,
      deduction: Number(deduction) || 0,
      paid,
      notes: notes || null,
    };
    const { data, error } = await supabase
      .from("salaries")
      .upsert(payload, { onConflict: "employee_id,period" })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salary saved");
    onSaved(data as Salary);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{employee?.full_name ?? "—"}</h2>
          <p className="text-[11px] text-muted-foreground">{period}</p>
        </div>
        {initial?.paid && (
          <span className="rounded-full bg-[--color-success]/15 px-2 py-0.5 text-[10px] font-semibold text-[--color-success]">
            PAID
          </span>
        )}
      </header>

      <Field
        label="Basic"
        value={basic}
        onChange={setBasic}
        disabled={readOnly || !canEditBasic}
        hint={!canEditBasic && isStaff ? "Owner only" : undefined}
      />
      <Field label="OT" value={ot} onChange={setOt} disabled={readOnly || !canEditOps} />
      <Field label="Bonus" value={bonus} onChange={setBonus} disabled={readOnly || !canEditOps} />
      <Field
        label="Deduction"
        value={deduction}
        onChange={setDeduction}
        disabled={readOnly || !canEditOps}
      />

      <label className="block">
        <span className="text-[11px] text-muted-foreground">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={readOnly || !canEditOps}
          rows={2}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
        />
      </label>

      {isStaff && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            disabled={!canTogglePaid}
            className="h-4 w-4"
          />
          <span>Mark as paid</span>
          {!canTogglePaid && <span className="text-[10px] text-muted-foreground">(Owner only)</span>}
        </label>
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Net</span>
        <span className="text-lg font-semibold text-primary">{fmtMYR(net)}</span>
      </div>

      {isStaff && (
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
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        {hint && <span className="text-[10px]">{hint}</span>}
      </span>
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
