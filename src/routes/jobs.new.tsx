import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useT } from "@/lib/i18n";
import { useJobs } from "@/lib/jobs-store";
import { employees } from "@/lib/mock-data";

const roleSchema = z.object({
  role: z.enum(["worker", "manager", "owner"]).catch("worker"),
});

export const Route = createFileRoute("/jobs/new")({
  validateSearch: roleSchema,
  head: () => ({
    meta: [
      { title: "New Job — DHX Team Ops" },
      { name: "description", content: "Create a new workshop job." },
    ],
  }),
  component: NewJobPage,
});

function NewJobPage() {
  const { tr } = useT();
  const { role } = Route.useSearch();
  const { addJob } = useJobs();
  const navigate = useNavigate();

  const [plate, setPlate] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setAssignedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSave = plate.trim().length > 0 && vehicle.trim().length > 0;

  const onSave = () => {
    if (!canSave || saving) return;
    setSaving(true);
    const job = addJob({
      plate: plate.trim().toUpperCase(),
      vehicle: vehicle.trim(),
      assignedIds,
      notes: notes.trim(),
      photos: [],
      status: "In Progress",
      progress: 5,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
    });
    toast.success(tr("Job created"));
    navigate({ to: "/jobs/$id", params: { id: job.id }, search: { role } });
  };

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-5 py-4">
          <Link
            to="/jobs"
            search={{ role }}
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight">{tr("New Job")}</h1>
            <p className="text-[11px] text-muted-foreground">{tr("Add basic info now, photos later.")}</p>
          </div>
        </div>
      </header>

      <div className="px-5 mt-4 space-y-3">
        <Field label={tr("Plate") + " *"}>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="WXY 1234"
            autoFocus
            className="inp uppercase"
          />
        </Field>
        <Field label={tr("Vehicle") + " *"}>
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="Honda Civic 2019"
            className="inp"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Customer")}>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder={tr("Optional")}
              className="inp"
            />
          </Field>
          <Field label={tr("Phone")}>
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder={tr("Optional")}
              inputMode="tel"
              className="inp"
            />
          </Field>
        </div>

        <Field label={tr("Assigned Workers")}>
          <div className="flex flex-wrap gap-1.5">
            {employees
              .filter((e) => e.active && e.role !== "Owner")
              .map((e) => {
                const on = assignedIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={`rounded-full px-3 py-1.5 text-xs ${
                      on ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
          </div>
        </Field>

        <Field label={tr("Notes")}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("Damage description, customer requests...")}
            rows={4}
            className="inp resize-none"
          />
        </Field>

        <p className="pt-1 text-[11px] text-muted-foreground">
          {tr("Tip: You can add photos and update progress after the job is created.")}
        </p>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-background/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md flex gap-2">
          <Link
            to="/jobs"
            search={{ role }}
            className="flex-1 rounded-xl border border-border bg-card py-3 text-center text-sm font-medium"
          >
            {tr("Cancel")}
          </Link>
          <button
            disabled={!canSave || saving}
            onClick={onSave}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {tr("Save Job")}
          </button>
        </div>
      </div>

      <style>{`.inp{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--card));border-radius:0.75rem;padding:0.7rem 0.85rem;font-size:0.9rem;outline:none}.inp:focus{box-shadow:0 0 0 2px hsl(var(--primary)/0.25)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
