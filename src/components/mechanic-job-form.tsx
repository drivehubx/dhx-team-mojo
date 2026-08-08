import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVehicles } from "@/lib/jobs";
import { useWorkspace } from "@/lib/workspace";
import {
  MECHANIC_JOB_STATUSES,
  MECHANIC_JOB_STATUS_LABELS,
  useMechanicTeamMembers,
  type MechanicJobStatus,
} from "@/lib/mechanic-jobs";

export type MechanicJobFormValues = {
  job_date: string;
  vehicle: { id: string; plate_number: string; make: string | null; model: string | null };
  mechanicId: string;
  helperId: string | null;
  work_description: string;
  status: MechanicJobStatus;
  labour_amount: number;
  parts_amount: number;
  notes: string | null;
};

export type MechanicJobFormDefaults = {
  job_date?: string;
  vehicleId?: string | null;
  registration_number?: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  mechanicId?: string | null;
  helperId?: string | null;
  work_description?: string;
  status?: MechanicJobStatus;
  labour_amount?: number;
  parts_amount?: number;
  notes?: string | null;
};

const NO_HELPER = "__none__";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export function MechanicJobForm({
  defaults,
  submitLabel,
  saving,
  onSubmit,
}: {
  defaults?: MechanicJobFormDefaults;
  submitLabel: string;
  saving?: boolean;
  onSubmit: (values: MechanicJobFormValues) => void;
}) {
  const { workspaceId } = useWorkspace();
  const vehiclesQ = useVehicles(workspaceId);
  const membersQ = useMechanicTeamMembers();

  const mechanics = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.role === "mechanic"),
    [membersQ.data],
  );
  const helpers = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.role === "helper"),
    [membersQ.data],
  );

  const [jobDate, setJobDate] = useState(defaults?.job_date ?? today());
  const [vehicleId, setVehicleId] = useState<string>(defaults?.vehicleId ?? "");
  const [mechanicId, setMechanicId] = useState<string>(defaults?.mechanicId ?? "");
  const [helperId, setHelperId] = useState<string>(defaults?.helperId ?? NO_HELPER);
  const [description, setDescription] = useState(defaults?.work_description ?? "");
  const [status, setStatus] = useState<MechanicJobStatus>(defaults?.status ?? "checking");
  const [labour, setLabour] = useState(String(defaults?.labour_amount ?? 0));
  const [parts, setParts] = useState(String(defaults?.parts_amount ?? 0));
  const [notes, setNotes] = useState(defaults?.notes ?? "");

  // Default mechanic: "Kwang" if present, else first mechanic.
  const effectiveMechanicId = useMemo(() => {
    if (mechanicId) return mechanicId;
    const kwang = mechanics.find((m) => m.name.trim().toLowerCase() === "kwang");
    return kwang?.id ?? mechanics[0]?.id ?? "";
  }, [mechanicId, mechanics]);

  const vehicles = vehiclesQ.data ?? [];
  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? null;

  const submit = () => {
    if (!jobDate) {
      toast.error("Please pick a date.");
      return;
    }
    if (!selectedVehicle) {
      toast.error("Please choose a vehicle.");
      return;
    }
    if (!effectiveMechanicId) {
      toast.error("Please choose a mechanic.");
      return;
    }
    if (!description.trim()) {
      toast.error("Work description is required.");
      return;
    }
    const labourNum = Number(labour);
    const partsNum = Number(parts);
    if (!Number.isFinite(labourNum) || labourNum < 0) {
      toast.error("Labour amount must be a number 0 or above.");
      return;
    }
    if (!Number.isFinite(partsNum) || partsNum < 0) {
      toast.error("Parts amount must be a number 0 or above.");
      return;
    }

    onSubmit({
      job_date: jobDate,
      vehicle: {
        id: selectedVehicle.id,
        plate_number: selectedVehicle.plate_number,
        make: selectedVehicle.make,
        model: selectedVehicle.model,
      },
      mechanicId: effectiveMechanicId,
      helperId: helperId === NO_HELPER ? null : helperId,
      work_description: description.trim(),
      status,
      labour_amount: labourNum,
      parts_amount: partsNum,
      notes: notes.trim() ? notes.trim() : null,
    });
  };

  return (
    <div className="space-y-4 px-5 pb-32">
      <Field label="Date">
        <input
          type="date"
          value={jobDate}
          onChange={(e) => setJobDate(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </Field>

      <Field label="Vehicle">
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue
              placeholder={vehiclesQ.isLoading ? "Loading vehicles…" : "Choose a vehicle"}
            />
          </SelectTrigger>
          <SelectContent>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.plate_number}
                {v.make || v.model ? ` — ${[v.make, v.model].filter(Boolean).join(" ")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {defaults?.registration_number && !selectedVehicle && (
          <p className="mt-1 text-xs text-muted-foreground">
            Current: {defaults.registration_number}{" "}
            {[defaults.vehicle_make, defaults.vehicle_model].filter(Boolean).join(" ")}
          </p>
        )}
      </Field>

      <Field label="Mechanic">
        <Select value={effectiveMechanicId} onValueChange={setMechanicId}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder="Choose a mechanic" />
          </SelectTrigger>
          <SelectContent>
            {mechanics.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Helper (optional)">
        <Select value={helperId} onValueChange={setHelperId}>
          <SelectTrigger className="h-12 rounded-xl">
            <SelectValue placeholder="No helper" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_HELPER}>No helper</SelectItem>
            {helpers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Work description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="What work is needed?"
          className="rounded-xl"
        />
      </Field>

      <div>
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {MECHANIC_JOB_STATUSES.map((s) => {
            const active = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-semibold ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border"
                }`}
              >
                {MECHANIC_JOB_STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Labour (MYR)">
          <input
            inputMode="decimal"
            value={labour}
            onChange={(e) => setLabour(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
        <Field label="Parts (MYR)">
          <input
            inputMode="decimal"
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </div>

      <Field label="Notes (optional)">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-xl"
        />
      </Field>

      <button
        type="button"
        disabled={!!saving}
        onClick={submit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.99] disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
