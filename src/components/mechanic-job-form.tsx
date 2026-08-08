import { useMemo, useState } from "react";
import { Car, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuickAddVehicle, useSearchVehiclesByPlate } from "@/lib/jobs";
import { useWorkspace } from "@/lib/workspace";
import {
  MECHANIC_JOB_STATUSES,
  MECHANIC_JOB_STATUS_LABELS,
  useCanViewMechanicCosts,
  useMechanicTeamMembers,
  type MechanicJobStatus,
} from "@/lib/mechanic-jobs";

type PickedVehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year?: number | null;
};

export type MechanicJobFormValues = {
  job_date: string;
  vehicle: { id: string; plate_number: string; make: string | null; model: string | null };
  mechanicId: string;
  helperId: string | null;
  work_description: string;
  status: MechanicJobStatus;
  labour_amount?: number;
  parts_amount?: number;
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
  labour_amount?: number | null;
  parts_amount?: number | null;
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

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

function VehiclePicker({
  workspaceId,
  vehicle,
  setVehicle,
}: {
  workspaceId: string | null;
  vehicle: PickedVehicle | null;
  setVehicle: (v: PickedVehicle | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const searchQ = useSearchVehiclesByPlate(workspaceId, query);
  const quickAdd = useQuickAddVehicle(workspaceId);

  const [qaPlate, setQaPlate] = useState("");
  const [qaMake, setQaMake] = useState("");
  const [qaModel, setQaModel] = useState("");
  const [qaYear, setQaYear] = useState("");

  const results = searchQ.data ?? [];

  const doQuickAdd = async () => {
    if (!qaPlate.trim()) {
      toast.error("Plate number required");
      return;
    }
    try {
      const v = await quickAdd.mutateAsync({
        plate_number: qaPlate,
        make: qaMake,
        model: qaModel,
        year: qaYear.trim() ? Number(qaYear) : null,
      });
      setVehicle({
        id: v.id,
        plate_number: v.plate_number,
        make: v.make,
        model: v.model,
        year: v.year,
      });
      setShowQuickAdd(false);
      toast.success("Vehicle added (complete full details later)");
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (/duplicate|unique/i.test(msg)) {
        toast.error(
          "This plate already exists — search for the existing vehicle instead of adding it again.",
        );
      } else {
        toast.error(msg || "Failed to add vehicle");
      }
    }
  };

  if (vehicle) {
    return (
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <Car className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{vehicle.plate_number}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVehicle(null)}
            className="text-xs font-medium text-primary"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plate, make or model"
          className={`${inputCls} pl-9`}
        />
      </div>

      {searchQ.isFetching && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Searching…
        </p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {results.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() =>
                  setVehicle({
                    id: v.id,
                    plate_number: v.plate_number,
                    make: v.make,
                    model: v.model,
                    year: v.year,
                  })
                }
                className="flex w-full items-center justify-between px-3 py-3 text-left active:bg-secondary"
              >
                <span className="text-sm font-semibold">{v.plate_number}</span>
                <span className="text-xs text-muted-foreground">
                  {[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 2 && !searchQ.isFetching && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No matching vehicle found.</p>
      )}

      {!showQuickAdd ? (
        <button
          type="button"
          onClick={() => {
            setShowQuickAdd(true);
            setQaPlate(query.trim().toUpperCase());
          }}
          className="text-xs font-medium text-primary"
        >
          Vehicle not in registry — quick add
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <input
            value={qaPlate}
            onChange={(e) => setQaPlate(e.target.value.toUpperCase())}
            placeholder="Plate number (required)"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={qaMake}
              onChange={(e) => setQaMake(e.target.value)}
              placeholder="Make"
              className={inputCls}
            />
            <input
              value={qaModel}
              onChange={(e) => setQaModel(e.target.value)}
              placeholder="Model"
              className={inputCls}
            />
          </div>
          <input
            value={qaYear}
            onChange={(e) => setQaYear(e.target.value)}
            inputMode="numeric"
            placeholder="Year (optional)"
            className={inputCls}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doQuickAdd}
              disabled={quickAdd.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {quickAdd.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add vehicle
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
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
  const membersQ = useMechanicTeamMembers();
  const canViewCostsQ = useCanViewMechanicCosts();
  const canViewCosts = canViewCostsQ.data === true;

  const mechanics = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.role === "mechanic"),
    [membersQ.data],
  );
  const helpers = useMemo(
    () => (membersQ.data ?? []).filter((m) => m.role === "helper"),
    [membersQ.data],
  );

  const [jobDate, setJobDate] = useState(defaults?.job_date ?? today());
  const [vehicle, setVehicle] = useState<PickedVehicle | null>(
    defaults?.vehicleId && defaults?.registration_number
      ? {
          id: defaults.vehicleId,
          plate_number: defaults.registration_number,
          make: defaults.vehicle_make ?? null,
          model: defaults.vehicle_model ?? null,
        }
      : null,
  );
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

  const submit = () => {
    if (!jobDate) {
      toast.error("Please pick a date.");
      return;
    }
    if (!vehicle) {
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

    const values: MechanicJobFormValues = {
      job_date: jobDate,
      vehicle: {
        id: vehicle.id,
        plate_number: vehicle.plate_number,
        make: vehicle.make,
        model: vehicle.model,
      },
      mechanicId: effectiveMechanicId,
      helperId: helperId === NO_HELPER ? null : helperId,
      work_description: description.trim(),
      status,
      notes: notes.trim() ? notes.trim() : null,
    };

    if (canViewCosts) {
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
      values.labour_amount = labourNum;
      values.parts_amount = partsNum;
    }

    onSubmit(values);
  };

  return (
    <div className="space-y-4 px-5 pb-32">
      <Field label="Date">
        <input
          type="date"
          value={jobDate}
          onChange={(e) => setJobDate(e.target.value)}
          className={inputCls}
        />
      </Field>

      <div>
        <span className="text-xs font-medium text-muted-foreground">Vehicle</span>
        <div className="mt-1.5">
          <VehiclePicker
            workspaceId={workspaceId}
            vehicle={vehicle}
            setVehicle={setVehicle}
          />
        </div>
      </div>

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
        <div className="mt-1.5 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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

      {canViewCosts && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Labour (MYR)">
            <input
              inputMode="decimal"
              value={labour}
              onChange={(e) => setLabour(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Parts (MYR)">
            <input
              inputMode="decimal"
              value={parts}
              onChange={(e) => setParts(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      )}

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
