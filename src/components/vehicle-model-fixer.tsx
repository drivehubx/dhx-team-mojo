import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useUpdateVehicleBasics } from "@/lib/jobs";
import { identifyVehicleFromPhotos } from "@/lib/ai-damage.functions";

export function VehicleModelFixer({
  workspaceId,
  vehicle,
  jobId,
  onSaved,
}: {
  workspaceId: string | null;
  vehicle: {
    id: string;
    plate_number: string;
    make: string | null;
    model: string | null;
    year: number | null;
  };
  /** Job id used to load intake photos for AI identification. Omit to hide the AI button. */
  jobId?: string;
  onSaved?: (v: any) => void;
}) {
  const [make, setMake] = useState(vehicle.make ?? "");
  const [model, setModel] = useState(vehicle.model ?? "");
  const [year, setYear] = useState(vehicle.year ? String(vehicle.year) : "");
  const [identifying, setIdentifying] = useState(false);
  const update = useUpdateVehicleBasics(workspaceId);
  const identify = useServerFn(identifyVehicleFromPhotos);

  async function runIdentify() {
    if (!jobId) return;
    setIdentifying(true);
    try {
      const r = await identify({ data: { jobId } });
      if (r.confidence > 0 && (r.make || r.model)) {
        if (r.make) setMake(r.make);
        if (r.model) setModel(r.model);
        if (r.year) setYear(String(r.year));
        toast.success("AI suggestion filled in — review and save");
      } else {
        toast.message("AI couldn't identify the vehicle from these photos");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI identify failed");
    } finally {
      setIdentifying(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-400/40 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-amber-600">
          This car has no model yet — add it so AI matching works.
        </p>
        {jobId && (
          <button
            type="button"
            onClick={runIdentify}
            disabled={identifying}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            {identifying ? "Identifying…" : "Identify with AI"}
          </button>
        )}
      </div>
      <input
        value={make}
        onChange={(e) => setMake(e.target.value)}
        placeholder="Make — e.g. Perodua, Toyota"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={model}
        onChange={(e) => setModel(e.target.value)}
        placeholder="Model — e.g. Alza, Myvi, Prius"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <input
        value={year}
        onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        placeholder="Year"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
      <button
        type="button"
        disabled={update.isPending || !model.trim()}
        onClick={async () => {
          try {
            const v = await update.mutateAsync({
              vehicleId: vehicle.id,
              make,
              model,
              year: year ? Number(year) : null,
            });
            toast.success("Vehicle updated");
            onSaved?.(v);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update vehicle");
          }
        }}
        className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {update.isPending ? "Saving…" : "Save vehicle details"}
      </button>
    </div>
  );
}
