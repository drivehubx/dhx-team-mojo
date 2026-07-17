import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Loader2,
  Camera,
  X,
  Search,
  Car,
  Sparkles,
  Check,
  Trash2,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import {
  useSearchVehiclesByPlate,
  useQuickAddVehicle,
  useCreateDraftJobForAI,
  useApproveInitialAssessment,
  WORK_REQUEST_SOURCES,
  WORK_REQUEST_SOURCE_LABELS,
  type WorkRequestSource,
  type CorrectedFinding,
  type CorrectedPart,
} from "@/lib/jobs";
import { analyzeInitialDamage } from "@/lib/ai-damage.functions";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/jobs/new")({
  head: () => ({
    meta: [
      { title: "New Work Request — DHX Body & Paint" },
      {
        name: "description",
        content: "AI-assisted intake for accident & repair work requests.",
      },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <NewWorkRequestPage />
    </WorkspaceGate>
  ),
});

const MAX_PHOTOS = 8;

type PickedVehicle = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  year: number | null;
};

type AIResult = Awaited<ReturnType<typeof analyzeInitialDamage>>;

function NewWorkRequestPage() {
  const { workspaceId, isStaff } = useWorkspace();
  const navigate = useNavigate({ from: "/jobs/new" });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ---- Step 1 state ----
  const [source, setSource] = useState<WorkRequestSource>("internal_fleet");
  const [vehicle, setVehicle] = useState<PickedVehicle | null>(null);
  const [plateQuery, setPlateQuery] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // ---- Step 2 state ----
  const [photos, setPhotos] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const previews = useMemo(
    () => photos.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [photos],
  );

  // ---- Step 3/4 state ----
  const [jobId, setJobId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ai, setAI] = useState<AIResult | null>(null);
  const [findings, setFindings] = useState<CorrectedFinding[]>([]);
  const [parts, setParts] = useState<CorrectedPart[]>([]);
  const [labourHours, setLabourHours] = useState(0);
  const [paintPanels, setPaintPanels] = useState(0);
  const [days, setDays] = useState(0);
  const [cost, setCost] = useState<string>("");
  const [summary, setSummary] = useState("");

  const analyzeFn = useServerFn(analyzeInitialDamage);
  const createDraft = useCreateDraftJobForAI(workspaceId);
  const approve = useApproveInitialAssessment(workspaceId);

  if (!isStaff) {
    return (
      <ShellHeader>
        <div className="mx-5 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Only managers can create work requests.
        </div>
      </ShellHeader>
    );
  }

  const onPickPhotos = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    setPhotos((prev) => [...prev, ...incoming].slice(0, MAX_PHOTOS));
  };
  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const goToAI = async () => {
    if (!vehicle) return;
    if (photos.length === 0) {
      toast.error("Add at least one photo");
      return;
    }
    setStep(3);
    setAnalyzing(true);
    try {
      const draft = await createDraft.mutateAsync({
        vehicle_id: vehicle.id,
        work_request_source: source,
        damage_description: notes.trim(),
        photos,
      });
      setJobId(draft.id);
      const result = await analyzeFn({ data: { jobId: draft.id } });
      setAI(result);
      setFindings(
        result.findings.map((f) => ({
          component: f.component,
          severity: f.severity,
          recommendedAction: f.recommendedAction,
          notes: f.notes,
        })),
      );
      setParts(
        result.parts.map((p) => ({
          partName: p.partName,
          quantity: p.quantity,
          unitPrice: p.estimatedUnitPrice,
          recommendedAction: p.recommendedAction,
          relatedComponent: p.relatedComponent,
        })),
      );
      setLabourHours(result.estimatedLabourHours);
      setPaintPanels(result.estimatedPaintPanels);
      setDays(result.estimatedDays);
      setCost(result.estimatedCost != null ? String(result.estimatedCost) : "");
      setSummary(result.summary || notes.trim());
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI analysis failed",
      );
      setStep(2);
    } finally {
      setAnalyzing(false);
    }
  };

  const onApprove = async () => {
    if (!jobId || !ai) return;
    const parsedCost = cost.trim() ? Number(cost) : null;
    if (parsedCost !== null && !Number.isFinite(parsedCost)) {
      toast.error("Estimate must be a number");
      return;
    }
    try {
      await approve.mutateAsync({
        jobId,
        aiRawJson: ai.rawJson,
        correctedFindings: findings,
        correctedParts: parts.filter((p) => p.partName.trim().length > 0),
        estimatedLabourHours: Number(labourHours) || 0,
        estimatedPaintPanels: Number(paintPanels) || 0,
        estimatedDays: Number(days) || 0,
        estimateAmount: parsedCost,
        summary: summary.trim(),
      });
      toast.success("Assessment approved — job created");
      navigate({ to: "/jobs/$id", params: { id: jobId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
  };

  return (
    <ShellHeader step={step}>
      <div className="px-5">
        {step === 1 && (
          <StepVehicle
            source={source}
            setSource={setSource}
            plateQuery={plateQuery}
            setPlateQuery={setPlateQuery}
            workspaceId={workspaceId}
            vehicle={vehicle}
            setVehicle={setVehicle}
            showQuickAdd={showQuickAdd}
            setShowQuickAdd={setShowQuickAdd}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepPhotos
            previews={previews}
            photos={photos}
            onPick={onPickPhotos}
            onRemove={removePhoto}
            notes={notes}
            setNotes={setNotes}
            onBack={() => setStep(1)}
            onNext={goToAI}
          />
        )}
        {step === 3 && (
          <StepAI analyzing={analyzing} ai={ai} onContinue={() => setStep(4)} />
        )}
        {step === 4 && ai && (
          <StepReview
            findings={findings}
            setFindings={setFindings}
            parts={parts}
            setParts={setParts}
            labourHours={labourHours}
            setLabourHours={setLabourHours}
            paintPanels={paintPanels}
            setPaintPanels={setPaintPanels}
            days={days}
            setDays={setDays}
            cost={cost}
            setCost={setCost}
            summary={summary}
            setSummary={setSummary}
            saving={approve.isPending}
            onApprove={onApprove}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </ShellHeader>
  );
}

function ShellHeader({
  children,
  step,
}: {
  children: React.ReactNode;
  step?: number;
}) {
  return (
    <div className="pb-12">
      <header className="sticky top-0 z-40 mb-4 bg-[--color-navy] text-[--color-navy-foreground] pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <Link
            to="/jobs"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-widest text-white/60">
              DHX Body & Paint
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              New Work Request
            </h1>
          </div>
        </div>
        {step && (
          <div className="mt-4 flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full ${
                  n <= step ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}

// -------- Step 1 --------
function StepVehicle({
  source,
  setSource,
  plateQuery,
  setPlateQuery,
  workspaceId,
  vehicle,
  setVehicle,
  showQuickAdd,
  setShowQuickAdd,
  onNext,
}: {
  source: WorkRequestSource;
  setSource: (s: WorkRequestSource) => void;
  plateQuery: string;
  setPlateQuery: (v: string) => void;
  workspaceId: string | null;
  vehicle: PickedVehicle | null;
  setVehicle: (v: PickedVehicle | null) => void;
  showQuickAdd: boolean;
  setShowQuickAdd: (v: boolean) => void;
  onNext: () => void;
}) {
  const searchQ = useSearchVehiclesByPlate(workspaceId, plateQuery);
  const quickAdd = useQuickAddVehicle(workspaceId);

  const [qaPlate, setQaPlate] = useState("");
  const [qaMake, setQaMake] = useState("");
  const [qaModel, setQaModel] = useState("");
  const [qaYear, setQaYear] = useState("");

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
      toast.success("Vehicle added (flag for full intake later)");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add vehicle");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step 1
        </p>
        <h2 className="mt-1 text-sm font-semibold">Vehicle</h2>
        <p className="text-xs text-muted-foreground">
          One vehicle, one identity — always find it first.
        </p>

        {vehicle ? (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 p-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                <Car className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {vehicle.plate_number}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[vehicle.make, vehicle.model, vehicle.year]
                    .filter(Boolean)
                    .join(" ") || "—"}
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
        ) : (
          <>
            <div className="mt-3 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                inputMode="search"
                value={plateQuery}
                onChange={(e) =>
                  setPlateQuery(e.target.value.toUpperCase())
                }
                placeholder="Search by plate (min 2 chars)"
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="mt-3 space-y-2 min-h-[3rem]">
              {searchQ.isFetching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              )}
              {!searchQ.isFetching && plateQuery.trim().length >= 2 && (searchQ.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  No matches. Use quick-add below.
                </p>
              )}
              {(searchQ.data ?? []).map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() =>
                    setVehicle({
                      id: v.id,
                      plate_number: v.plate_number,
                      make: v.make,
                      model: v.model,
                      year: v.year,
                    })
                  }
                  className="w-full flex items-center gap-3 rounded-xl border border-border bg-background p-3 text-left hover:bg-secondary/50 active:scale-[0.99] transition"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-foreground">
                    <Car className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {v.plate_number}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[v.make, v.model, v.year].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <Plus className="h-4 w-4" />
              {showQuickAdd ? "Cancel quick-add" : "Vehicle not in registry — quick add"}
            </button>

            {showQuickAdd && (
              <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border p-3">
                <input
                  value={qaPlate}
                  onChange={(e) => setQaPlate(e.target.value.toUpperCase())}
                  placeholder="Plate number *"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={qaMake}
                    onChange={(e) => setQaMake(e.target.value)}
                    placeholder="Make"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <input
                    value={qaModel}
                    onChange={(e) => setQaModel(e.target.value)}
                    placeholder="Model"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <input
                  value={qaYear}
                  onChange={(e) => setQaYear(e.target.value)}
                  inputMode="numeric"
                  placeholder="Year"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={doQuickAdd}
                  disabled={quickAdd.isPending}
                  className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {quickAdd.isPending ? "Adding…" : "Add & flag for full intake"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Work Request Source
        </label>
        <div className="mt-2">
          <Select
            value={source}
            onValueChange={(v) => setSource(v as WorkRequestSource)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_REQUEST_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {WORK_REQUEST_SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <button
        type="button"
        disabled={!vehicle}
        onClick={onNext}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}

// -------- Step 2 --------
function StepPhotos({
  previews,
  photos,
  onPick,
  onRemove,
  notes,
  setNotes,
  onBack,
  onNext,
}: {
  previews: { name: string; url: string }[];
  photos: File[];
  onPick: (f: FileList | null) => void;
  onRemove: (i: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // AI detection starts automatically once photos settle (founder rule: no extra tap).
  // Adding another photo restarts the countdown; typing notes pauses it.
  const [notesFocused, setNotesFocused] = useState(false);
  const autoRef = useRef<number | null>(null);
  useEffect(() => {
    if (autoRef.current) window.clearTimeout(autoRef.current);
    if (photos.length === 0 || notesFocused) return;
    autoRef.current = window.setTimeout(() => onNext(), 3500);
    return () => {
      if (autoRef.current) window.clearTimeout(autoRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length, notesFocused]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step 2
        </p>
        <h2 className="mt-1 text-sm font-semibold">Accident Photos</h2>
        <p className="text-xs text-muted-foreground">
          Overall shots + damage close-ups. Up to {MAX_PHOTOS}. {photos.length}/{MAX_PHOTOS}.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {previews.map((p, idx) => (
            <div
              key={idx}
              className="relative aspect-square rounded-xl overflow-hidden border border-border bg-secondary"
            >
              <img
                src={p.url}
                alt={p.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(idx)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
              <Camera className="h-6 w-6" />
              <span className="text-[11px]">Camera</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
            </label>
          )}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:bg-secondary/40">
              <Upload className="h-6 w-6" />
              <span className="text-[11px]">Upload</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
            </label>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="block text-sm font-semibold" htmlFor="notes">
          Notes for the AI (optional)
        </label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          placeholder="Anything the photos don't show clearly…"
          className="mt-2 min-h-[80px] resize-none"
        />
      </section>

      {photos.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" />
          <span>
            🤖 AI detection starts automatically ({photos.length} photo{photos.length > 1 ? "s" : ""})
            — add more or it begins in a moment…
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={photos.length === 0}
          className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" /> Analyze now
        </button>
      </div>
    </div>
  );
}

// -------- Step 3 --------
function StepAI({
  analyzing,
  ai,
  onContinue,
}: {
  analyzing: boolean;
  ai: AIResult | null;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        {analyzing ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h2 className="mt-4 text-base font-semibold">
              AI is drafting the initial assessment…
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Reading photos, matching to the vehicle identity, estimating parts & labour.
            </p>
          </>
        ) : ai ? (
          <>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-base font-semibold">Draft ready</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {ai.findings.length} finding{ai.findings.length === 1 ? "" : "s"} · {ai.parts.length} part{ai.parts.length === 1 ? "" : "s"} · overall confidence {(ai.overallConfidence * 100).toFixed(0)}%
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow"
            >
              Review & approve
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}

// -------- Step 4 --------
function StepReview({
  findings,
  setFindings,
  parts,
  setParts,
  labourHours,
  setLabourHours,
  paintPanels,
  setPaintPanels,
  days,
  setDays,
  cost,
  setCost,
  summary,
  setSummary,
  saving,
  onApprove,
  onBack,
}: {
  findings: CorrectedFinding[];
  setFindings: React.Dispatch<React.SetStateAction<CorrectedFinding[]>>;
  parts: CorrectedPart[];
  setParts: React.Dispatch<React.SetStateAction<CorrectedPart[]>>;
  labourHours: number;
  setLabourHours: (v: number) => void;
  paintPanels: number;
  setPaintPanels: (v: number) => void;
  days: number;
  setDays: (v: number) => void;
  cost: string;
  setCost: (v: string) => void;
  summary: string;
  setSummary: (v: string) => void;
  saving: boolean;
  onApprove: () => void;
  onBack: () => void;
}) {
  const updateFinding = (i: number, patch: Partial<CorrectedFinding>) =>
    setFindings((prev) =>
      prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    );
  const removeFinding = (i: number) =>
    setFindings((prev) => prev.filter((_, idx) => idx !== i));
  const addFinding = () =>
    setFindings((prev) => [
      ...prev,
      {
        component: "",
        severity: "moderate",
        recommendedAction: "repair",
        notes: "",
      },
    ]);

  const updatePart = (i: number, patch: Partial<CorrectedPart>) =>
    setParts((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const removePart = (i: number) =>
    setParts((prev) => prev.filter((_, idx) => idx !== i));
  const addPart = () =>
    setParts((prev) => [
      ...prev,
      {
        partName: "",
        quantity: 1,
        unitPrice: null,
        recommendedAction: "replace",
        relatedComponent: "",
      },
    ]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Summary
        </p>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="mt-2 min-h-[80px] resize-none"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Findings</h2>
          <button
            type="button"
            onClick={addFinding}
            className="text-xs font-medium text-primary inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {findings.length === 0 && (
            <p className="text-xs text-muted-foreground">No findings.</p>
          )}
          {findings.map((f, i) => (
            <div
              key={i}
              className="rounded-xl border border-border p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <input
                  value={f.component}
                  onChange={(e) =>
                    updateFinding(i, { component: e.target.value })
                  }
                  placeholder="Component"
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeFinding(i)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={f.severity}
                  onValueChange={(v) =>
                    updateFinding(i, {
                      severity: v as CorrectedFinding["severity"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={f.recommendedAction}
                  onValueChange={(v) =>
                    updateFinding(i, {
                      recommendedAction:
                        v as CorrectedFinding["recommendedAction"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="replace">Replace</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                value={f.notes}
                onChange={(e) => updateFinding(i, { notes: e.target.value })}
                placeholder="Notes"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Parts (Initial Assessment)</h2>
          <button
            type="button"
            onClick={addPart}
            className="text-xs font-medium text-primary inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {parts.length === 0 && (
            <p className="text-xs text-muted-foreground">No parts.</p>
          )}
          {parts.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-border p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <input
                  value={p.partName}
                  onChange={(e) =>
                    updatePart(i, { partName: e.target.value })
                  }
                  placeholder="Part name"
                  className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removePart(i)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  value={p.quantity}
                  onChange={(e) =>
                    updatePart(i, {
                      quantity: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                  placeholder="Qty"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <input
                  inputMode="decimal"
                  value={p.unitPrice ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    updatePart(i, {
                      unitPrice: v === "" ? null : Number(v),
                    });
                  }}
                  placeholder="RM"
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <Select
                  value={p.recommendedAction}
                  onValueChange={(v) =>
                    updatePart(i, {
                      recommendedAction:
                        v as CorrectedPart["recommendedAction"],
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">Replace</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                value={p.relatedComponent}
                onChange={(e) =>
                  updatePart(i, { relatedComponent: e.target.value })
                }
                placeholder="Related component"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Estimates</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            Labour hours
            <input
              type="number"
              min={0}
              step="0.5"
              value={labourHours}
              onChange={(e) => setLabourHours(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Paint panels
            <input
              type="number"
              min={0}
              value={paintPanels}
              onChange={(e) => setPaintPanels(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Repair days
            <input
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Estimate (MYR)
            <input
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground"
            />
          </label>
        </div>
      </section>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={saving}
          className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Approve & Create Job
        </button>
      </div>
    </div>
  );
}
