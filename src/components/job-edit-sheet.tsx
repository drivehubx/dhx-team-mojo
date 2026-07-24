import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  REPAIR_STAGES,
  useUpdateJobDetails,
  useUpdatePartDetails,
  useSetJobWorkers,
  useUpdateVehicleBasics,
  useRepairParts,
  useWorkspaceProfiles,
  type JobWithRels,
  type RepairPart,
} from "@/lib/jobs";
import {
  WORK_REQUEST_SOURCES,
  WORK_REQUEST_SOURCE_LABELS,
  type WorkRequestSource,
} from "@/lib/work-source";
import type { JobStatus, RepairStage } from "@/integrations/supabase/shared-schema";

const JOB_STATUSES: JobStatus[] = ["open", "in_progress", "completed", "cancelled"];
const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STAGE_LABELS: Record<RepairStage, string> = {
  queued: "Queued",
  disassembly: "Disassembly",
  panel_repair: "Panel Repair",
  putty: "Putty",
  primer: "Primer",
  paint: "Paint",
  polish: "Polish",
  qc: "QC",
  completed: "Completed",
};

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function JobEditSheet({
  workspaceId,
  job,
  onClose,
}: {
  workspaceId: string | null;
  job: JobWithRels;
  onClose: () => void;
}) {
  const updateJob = useUpdateJobDetails(workspaceId);
  const setWorkers = useSetJobWorkers(workspaceId);
  const updateVehicle = useUpdateVehicleBasics(workspaceId);
  const partsQ = useRepairParts(workspaceId, job.id);
  const profilesQ = useWorkspaceProfiles(workspaceId);
  const updatePart = useUpdatePartDetails(workspaceId);

  // Vehicle
  const [make, setMake] = useState(job.vehicle?.make ?? "");
  const [model, setModel] = useState(job.vehicle?.model ?? "");
  const [year, setYear] = useState<string>(
    (job.vehicle as any)?.year ? String((job.vehicle as any).year) : "",
  );

  // Job base
  const [description, setDescription] = useState(job.description ?? "");
  const [damage, setDamage] = useState(job.damage_description ?? "");
  const [source, setSource] = useState<string>(
    ((job as any).work_request_source as string) ?? "",
  );
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [stage, setStage] = useState<RepairStage>(
    (job.repair_stage ?? "queued") as RepairStage,
  );

  // Work order
  const [leadId, setLeadId] = useState<string>(job.assigned_lead_id ?? "");
  const [laborHours, setLaborHours] = useState<string>(
    job.labor_hours_estimate != null ? String(job.labor_hours_estimate) : "",
  );
  const [dueDate, setDueDate] = useState<string>(job.due_date ?? "");

  // Estimation
  const [estimateAmount, setEstimateAmount] = useState<string>(
    job.estimate_amount != null ? String(job.estimate_amount) : "",
  );
  const [estLabour, setEstLabour] = useState<string>(
    (job as any).estimated_labour_hours != null
      ? String((job as any).estimated_labour_hours)
      : "",
  );
  const [estPanels, setEstPanels] = useState<string>(
    (job as any).estimated_paint_panels != null
      ? String((job as any).estimated_paint_panels)
      : "",
  );
  const [estDays, setEstDays] = useState<string>(
    (job as any).estimated_days != null ? String((job as any).estimated_days) : "",
  );

  // Assigned team members
  const [workerIds, setWorkerIds] = useState<Set<string>>(
    new Set(job.workers.map((w) => w.profile_id)),
  );
  const initialWorkerIds = useMemo(
    () => new Set(job.workers.map((w) => w.profile_id)),
    [job.id],
  );

  const toggleWorker = (id: string) => {
    setWorkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Parts local state (staged edits)
  const parts = partsQ.data ?? [];
  const [partEdits, setPartEdits] = useState<Record<string, Partial<RepairPart>>>({});

  useEffect(() => {
    setPartEdits({});
  }, [partsQ.data?.length]);

  const patchPart = (id: string, patch: Partial<RepairPart>) => {
    setPartEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const [saving, setSaving] = useState(false);

  const workersChanged = useMemo(() => {
    if (workerIds.size !== initialWorkerIds.size) return true;
    for (const id of workerIds) if (!initialWorkerIds.has(id)) return true;
    return false;
  }, [workerIds, initialWorkerIds]);

  const vehicleChanged =
    (job.vehicle?.make ?? "") !== make ||
    (job.vehicle?.model ?? "") !== model ||
    String((job.vehicle as any)?.year ?? "") !== year;

  const save = async () => {
    setSaving(true);
    try {
      // 1) Vehicle basics
      if (vehicleChanged && job.vehicle) {
        await updateVehicle.mutateAsync({
          vehicleId: job.vehicle.id,
          make,
          model,
          year: year.trim() === "" ? null : Number(year),
        });
      }

      // 2) Job fields
      await updateJob.mutateAsync({
        jobId: job.id,
        patch: {
          description: description.trim() || null,
          damage_description: damage.trim() || null,
          status,
          repair_stage: stage,
          work_request_source: source || null,
          assigned_lead_id: leadId || null,
          labor_hours_estimate: numOrNull(laborHours),
          due_date: dueDate || null,
          estimate_amount: numOrNull(estimateAmount),
          estimated_labour_hours: numOrNull(estLabour),
          estimated_paint_panels: numOrNull(estPanels),
          estimated_days: numOrNull(estDays),
        },
      });

      // 3) Assigned team members
      if (workersChanged) {
        await setWorkers.mutateAsync({
          jobId: job.id,
          profileIds: Array.from(workerIds),
        });
      }

      // 4) Parts (only send changed rows)
      const partsToSave = Object.entries(partEdits).filter(
        ([, p]) => Object.keys(p).length > 0,
      );
      for (const [id, patch] of partsToSave) {
        const clean: any = {};
        if (patch.part_name !== undefined) clean.part_name = patch.part_name;
        if (patch.quantity !== undefined)
          clean.quantity = Math.max(1, Number(patch.quantity) || 1);
        if (patch.unit_cost !== undefined) clean.unit_cost = patch.unit_cost;
        if (patch.supplier !== undefined) clean.supplier = patch.supplier;
        if (patch.notes !== undefined) clean.notes = patch.notes;
        if (Object.keys(clean).length === 0) continue;
        await updatePart.mutateAsync({ id, jobId: job.id, patch: clean });
      }

      toast.success("Job updated");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background rounded-t-2xl">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Edit Job
            </p>
            <h2 className="text-base font-semibold">
              {job.vehicle?.plate_number ?? "Vehicle"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary active:scale-95"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Vehicle */}
          <Section title="Vehicle">
            <Field label="Make">
              <input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className={inputCls}
                placeholder="e.g. Perodua"
              />
            </Field>
            <Field label="Model">
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={inputCls}
                placeholder="e.g. Myvi"
              />
            </Field>
            <Field label="Year">
              <input
                value={year}
                onChange={(e) =>
                  setYear(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                inputMode="numeric"
                className={inputCls}
                placeholder="e.g. 2020"
              />
            </Field>
          </Section>

          {/* Job basics */}
          <Section title="Job">
            <Field label="Job Title / Description">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
                placeholder="Short title"
              />
            </Field>
            <Field label="Damage Description / Notes">
              <textarea
                value={damage}
                onChange={(e) => setDamage(e.target.value)}
                rows={4}
                className={inputCls}
                placeholder="What is damaged? What needs to be done?"
              />
            </Field>
            <Field label="Work Request Source">
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className={inputCls}
              >
                <option value="">— Not set —</option>
                {WORK_REQUEST_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {WORK_REQUEST_SOURCE_LABELS[s as WorkRequestSource]}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Status & stage */}
          <Section title="Status & Stage">
            <Field label="Job Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                className={inputCls}
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Repair Stage">
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as RepairStage)}
                className={inputCls}
              >
                {REPAIR_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {/* Work order */}
          <Section title="Work Order">
            <Field label="Team Lead">
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Unassigned —</option>
                {(profilesQ.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Labour Estimate (hours)">
              <input
                type="number"
                step="0.5"
                min="0"
                value={laborHours}
                onChange={(e) => setLaborHours(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </Section>

          {/* Estimation (internal) */}
          <Section title="Estimation (internal)">
            <Field label="Estimated Repair Cost — RM (internal)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={estimateAmount}
                onChange={(e) => setEstimateAmount(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Labour hrs">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estLabour}
                  onChange={(e) => setEstLabour(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Paint panels">
                <input
                  type="number"
                  min="0"
                  value={estPanels}
                  onChange={(e) => setEstPanels(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Days">
                <input
                  type="number"
                  min="0"
                  value={estDays}
                  onChange={(e) => setEstDays(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* Assigned Team Members */}
          <Section title="Assigned Team Members">
            {(profilesQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No team members available.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                {(profilesQ.data ?? []).map((p) => {
                  const checked = workerIds.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer active:bg-secondary/60"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleWorker(p.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="flex-1 truncate">{p.full_name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Parts */}
          <Section title="Parts">
            {partsQ.isLoading ? (
              <div className="text-center text-xs text-muted-foreground">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : parts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No parts recorded.</p>
            ) : (
              <div className="space-y-2">
                {parts.map((p) => {
                  const edit = partEdits[p.id] ?? {};
                  const nameVal = (edit.part_name ?? p.part_name) as string;
                  const qtyVal =
                    edit.quantity !== undefined ? String(edit.quantity) : String(p.quantity);
                  const costVal =
                    edit.unit_cost !== undefined
                      ? edit.unit_cost == null
                        ? ""
                        : String(edit.unit_cost)
                      : p.unit_cost == null
                        ? ""
                        : String(p.unit_cost);
                  const supplierVal =
                    edit.supplier !== undefined ? (edit.supplier ?? "") : (p.supplier ?? "");
                  const notesVal =
                    edit.notes !== undefined ? (edit.notes ?? "") : (p.notes ?? "");
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border bg-card p-3 space-y-2"
                    >
                      <input
                        value={nameVal}
                        onChange={(e) =>
                          patchPart(p.id, { part_name: e.target.value })
                        }
                        className={inputCls}
                        placeholder="Part name"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          min="1"
                          value={qtyVal}
                          onChange={(e) =>
                            patchPart(p.id, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className={inputCls}
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={costVal}
                          onChange={(e) =>
                            patchPart(p.id, {
                              unit_cost:
                                e.target.value.trim() === "" ? null : Number(e.target.value),
                            })
                          }
                          className={inputCls}
                          placeholder="Unit RM"
                        />
                        <input
                          value={supplierVal}
                          onChange={(e) =>
                            patchPart(p.id, { supplier: e.target.value || null })
                          }
                          className={inputCls}
                          placeholder="Supplier"
                        />
                      </div>
                      <input
                        value={notesVal}
                        onChange={(e) => patchPart(p.id, { notes: e.target.value || null })}
                        className={inputCls}
                        placeholder="Notes"
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Part status (required / ordered / received / installed) is changed from
              the Parts section on the job page — not here.
            </p>
          </Section>

          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
            Read-only in this form: customer / contact details (not stored on this
            job type), intake checklist, intake photos, assessment approval,
            invoice, archive, delete, and administrative override. Use the
            dedicated sections on the job page for those.
          </div>
        </div>

        <footer className="sticky bottom-0 flex gap-2 px-5 py-3 border-t border-border bg-background rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-[2] rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
