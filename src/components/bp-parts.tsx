import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Wrench,
  Replace as ReplaceIcon,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sbCore } from "@/integrations/supabase/shared-schema";
import { dhxWorkshop } from "@/lib/dhx";
import { useWorkspace } from "@/lib/workspace";
import { useT, Translatable, type Lang } from "@/lib/i18n";
import { analyzeRepairPart, type AnalyzeRepairPartResult } from "@/lib/ai-damage.functions";
import type {
  PartDiscoveryStage,
  PartRecommendedAction,
  PartRevisionStatus,
} from "@/lib/jobs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

// ---------- types ----------
type PartRow = {
  id: string;
  workspace_id: string;
  job_id: string;
  part_name: string;
  quantity: number;
  unit_cost: number | null;
  status: string;
  provenance: string | null;
  discovery_stage: string | null;
  reason_required: string | null;
  recommended_action: string | null;
  related_damage: string | null;
  photo_file_id: string | null;
  ai_suggestion: any;
  revision_status: string | null;
  created_at: string;
};

type FileMeta = { id: string; url: string | null; storage_path: string | null };

const BUCKET = "job-photos";
const DISCOVERY_STAGES: PartDiscoveryStage[] = [
  "dismantling",
  "repair",
  "qc",
  "customer_request",
  "other",
];

// ---------- label maps (all human, all translated via tr()) ----------
function provenanceLabel(v: string | null | undefined): string {
  return v === "initial_assessment" ? "Initial Assessment" : "Found During Repair";
}
function revisionLabel(v: string | null | undefined): string {
  if (v === "approved") return "Approved";
  if (v === "rejected") return "Rejected";
  return "Awaiting Approval"; // pending, draft_revision, null, anything else
}
function actionLabel(v: string | null | undefined): string {
  return v === "repair" ? "Repair" : "Replace";
}
function stageLabel(v: string | null | undefined): string {
  switch (v) {
    case "dismantling":
      return "Dismantling";
    case "repair":
      return "Repair";
    case "qc":
      return "Quality Control";
    case "customer_request":
      return "Customer Request";
    case "other":
      return "Other";
    default:
      return "Repair";
  }
}

// ---------- workspace AI settings ----------
type PartsMode = "photo_first" | "manual" | "both";
type AiSettings = {
  partsDetection: boolean;
  humanApproval: boolean;
  partsMode: PartsMode;
};
const DEFAULT_AI: AiSettings = {
  partsDetection: true,
  humanApproval: true,
  partsMode: "photo_first",
};

function useAiSettings(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-ai-settings", workspaceId],
    enabled: !!workspaceId,
    queryFn: async (): Promise<AiSettings> => {
      const { data } = await sbCore()
        .from("workspaces")
        .select("settings")
        .eq("id", workspaceId!)
        .maybeSingle();
      const s = ((data?.settings ?? {}) as any)?.ai ?? {};
      return { ...DEFAULT_AI, ...s };
    },
  });
}

// ---------- parts query ----------
function useParts(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["bp-parts", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const { data: parts, error } = await dhxWorkshop()
        .from("repair_parts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (parts ?? []) as PartRow[];

      const fileIds = rows.map((r) => r.photo_file_id).filter(Boolean) as string[];
      const signedByFileId: Record<string, string> = {};
      if (fileIds.length) {
        const { data: files } = await sbCore()
          .from("files")
          .select("id, url, storage_path")
          .in("id", fileIds);
        const filesList = (files ?? []) as FileMeta[];
        const paths = filesList
          .map((f) => f.storage_path || f.url)
          .filter(Boolean) as string[];
        if (paths.length) {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrls(paths, 60 * 60);
          const byPath: Record<string, string> = {};
          for (const s of signed ?? []) {
            if (s.path && s.signedUrl) byPath[s.path] = s.signedUrl;
          }
          for (const f of filesList) {
            const p = f.storage_path || f.url;
            if (p && byPath[p]) signedByFileId[f.id] = byPath[p];
          }
        }
      }

      return rows.map((r) => ({
        ...r,
        photoUrl: r.photo_file_id ? signedByFileId[r.photo_file_id] ?? null : null,
      }));
    },
  });
}

// ============================================================
// Main section
// ============================================================
export function BPParts({
  jobId,
  repairStage,
}: {
  jobId: string;
  repairStage: string | null;
}) {
  const { tr } = useT();
  const { workspaceId, isAdmin } = useWorkspace();
  const partsQ = useParts(workspaceId, jobId);
  const aiSettingsQ = useAiSettings(workspaceId);
  const [addOpen, setAddOpen] = useState(false);

  const parts = partsQ.data ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">{tr("Parts")}</h2>
          <p className="text-xs text-muted-foreground">
            {parts.length} {tr(parts.length === 1 ? "part" : "parts")}
          </p>
        </div>
      </div>

      {partsQ.isLoading ? (
        <div className="py-4 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : parts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {tr("No parts yet.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {parts.map((p) => (
            <PartCard key={p.id} part={p} showCost={isAdmin} />
          ))}
        </ul>
      )}

      <Button
        onClick={() => setAddOpen(true)}
        className="h-14 w-full text-base font-semibold"
      >
        <Plus className="mr-2 h-5 w-5" /> {tr("Add Part")}
      </Button>

      {addOpen && (
        <AddPartSheet
          open={addOpen}
          onOpenChange={setAddOpen}
          jobId={jobId}
          workspaceId={workspaceId}
          repairStage={repairStage}
          aiSettings={aiSettingsQ.data ?? DEFAULT_AI}
        />
      )}
    </section>
  );
}

// ============================================================
// Part card
// ============================================================
function PartCard({
  part,
  showCost,
}: {
  part: PartRow & { photoUrl: string | null };
  showCost: boolean;
}) {
  const { tr } = useT();
  const ai = (part.ai_suggestion ?? {}) as any;
  const translations = ai?.translations ?? {};
  const aiLang = ai?.lang as Lang | undefined;
  const aiTr = aiLang && translations?.[aiLang];
  const confidence: number | null =
    typeof ai?.confidence === "number" ? ai.confidence : null;

  const revision = part.revision_status ?? "pending";
  const revTone =
    revision === "approved"
      ? "bg-[--color-success]/15 text-[--color-success]"
      : revision === "rejected"
        ? "bg-destructive/15 text-destructive"
        : "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  const revIcon =
    revision === "approved" ? (
      <Check className="h-3 w-3" />
    ) : revision === "rejected" ? (
      <X className="h-3 w-3" />
    ) : (
      <Loader2 className="h-3 w-3" />
    );

  return (
    <li className="flex gap-3 rounded-xl border border-border bg-background p-3">
      {part.photoUrl ? (
        <img
          src={part.photoUrl}
          alt=""
          className="h-16 w-16 flex-none rounded-lg object-cover border border-border"
        />
      ) : (
        <div className="grid h-16 w-16 flex-none place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Wrench className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            <Translatable
              en={part.part_name || tr("Unnamed part")}
              translated={aiTr?.detectedPart ?? null}
            />
          </p>
          <span
            className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${revTone}`}
          >
            {revIcon} {tr(revisionLabel(revision))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {tr(actionLabel(part.recommended_action))}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            × {part.quantity}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            {tr(stageLabel(part.discovery_stage))}
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
            {tr(provenanceLabel(part.provenance))}
          </span>
          {confidence !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" /> {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        {part.reason_required && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            <Translatable
              en={part.reason_required}
              translated={aiTr?.reasonRequired ?? null}
            />
          </p>
        )}
        {part.related_damage && (
          <p className="text-[11px] text-muted-foreground">
            <span className="opacity-70">{tr("Related")}:</span>{" "}
            <Translatable
              en={part.related_damage}
              translated={aiTr?.relatedOriginalDamage ?? null}
            />
          </p>
        )}
        {showCost && part.unit_cost !== null && (
          <p className="text-[11px] font-medium">
            {tr("Unit cost")}: RM {Number(part.unit_cost).toFixed(2)}
          </p>
        )}
      </div>
    </li>
  );
}

// ============================================================
// Add-Part sheet
// ============================================================
type Step = "choose" | "analyzing" | "review" | "manual";

type ReviewState = {
  photoFile: File;
  photoPath: string;
  fileId: string;
  detectedPart: string;
  reasonRequired: string;
  relatedOriginalDamage: string;
  discoveryStage: PartDiscoveryStage;
  quantity: number;
  recommendedAction: PartRecommendedAction;
  confidence: number;
  aiPayload: any | null; // full ai_suggestion payload as saved
  originalEnglish: {
    detectedPart: string;
    reasonRequired: string;
    relatedOriginalDamage: string;
  } | null;
  originalTranslation: {
    detectedPart: string;
    reasonRequired: string;
    relatedOriginalDamage: string;
  } | null;
  aiWasUsed: boolean;
};

function AddPartSheet({
  open,
  onOpenChange,
  jobId,
  workspaceId,
  repairStage,
  aiSettings,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  workspaceId: string | null;
  repairStage: string | null;
  aiSettings: AiSettings;
}) {
  const { tr, lang } = useT();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeRepairPart);
  const initialStep: Step = aiSettings.partsMode === "manual" ? "manual" : "choose";
  const [step, setStep] = useState<Step>(initialStep);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [aiFailedMsg, setAiFailedMsg] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setReview(null);
      setAiFailedMsg(null);
    }
  }, [open, initialStep]);

  const defaultStage = ((): PartDiscoveryStage => {
    if (repairStage === "disassembly") return "dismantling";
    if (repairStage === "qc") return "qc";
    return "repair";
  })();

  const uploadPhoto = async (
    file: File,
  ): Promise<{ photoPath: string; fileId: string }> => {
    if (!workspaceId) throw new Error("Workspace not ready");
    const { data: userRes } = await supabase.auth.getUser();
    const uploadedBy = userRes.user?.id ?? null;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const uuid =
      (globalThis.crypto as any)?.randomUUID?.() ??
      Math.random().toString(36).slice(2);
    const photoPath = `${workspaceId}/${jobId}/parts/${uuid}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(photoPath, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { data: fileRow, error: fErr } = await sbCore()
      .from("files")
      .insert({
        workspace_id: workspaceId,
        owner_type: "workshop.jobs",
        owner_id: jobId,
        file_type: "part_photo",
        url: photoPath,
        storage_path: photoPath,
        status: "approved",
        uploaded_by: uploadedBy,
      })
      .select("id")
      .single();
    if (fErr) throw fErr;
    return { photoPath, fileId: (fileRow as { id: string }).id };
  };

  const handlePicked = async (fl: FileList | null) => {
    const f = fl?.[0];
    if (!f) return;
    setStep("analyzing");
    setAiFailedMsg(null);
    try {
      const { photoPath, fileId } = await uploadPhoto(f);

      // AI OFF or Manual mode → skip AI, jump to review with blanks.
      if (!aiSettings.partsDetection) {
        setReview({
          photoFile: f,
          photoPath,
          fileId,
          detectedPart: "",
          reasonRequired: "",
          relatedOriginalDamage: "",
          discoveryStage: defaultStage,
          quantity: 1,
          recommendedAction: "replace",
          confidence: 0,
          aiPayload: null,
          originalEnglish: null,
          originalTranslation: null,
          aiWasUsed: false,
        });
        setStep("review");
        return;
      }

      let result: AnalyzeRepairPartResult;
      try {
        result = await analyze({
          data: {
            jobId,
            photoPath,
            currentRepairStage: repairStage,
            lang: lang as Lang,
          },
        });
      } catch (e) {
        setAiFailedMsg(e instanceof Error ? e.message : "AI unavailable");
        setReview({
          photoFile: f,
          photoPath,
          fileId,
          detectedPart: "",
          reasonRequired: "",
          relatedOriginalDamage: "",
          discoveryStage: defaultStage,
          quantity: 1,
          recommendedAction: "replace",
          confidence: 0,
          aiPayload: null,
          originalEnglish: null,
          originalTranslation: null,
          aiWasUsed: false,
        });
        setStep("review");
        return;
      }

      const translation = result.translation;
      const canonical = {
        detectedPart: result.detectedPart,
        reasonRequired: result.reasonRequired,
        relatedOriginalDamage: result.relatedOriginalDamage,
      };
      const aiPayload = {
        canonical,
        translations: translation ? { [result.lang]: translation } : {},
        confidence: result.confidence,
        lang: result.lang,
        recommendedAction: result.recommendedAction,
        discoveryStage: result.discoveryStage,
        quantity: result.quantity,
        rawJson: result.rawJson,
      };

      // Prefill review with translated fields when available, so the
      // technician can read them; canonical English stays inside aiPayload.
      const prefill = translation ?? canonical;

      setReview({
        photoFile: f,
        photoPath,
        fileId,
        detectedPart: prefill.detectedPart,
        reasonRequired: prefill.reasonRequired,
        relatedOriginalDamage: prefill.relatedOriginalDamage,
        discoveryStage: result.discoveryStage,
        quantity: result.quantity,
        recommendedAction: result.recommendedAction,
        confidence: result.confidence,
        aiPayload,
        originalEnglish: canonical,
        originalTranslation: translation,
        aiWasUsed: result.confidence > 0 || !!result.detectedPart,
      });
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
      setStep(initialStep);
    }
  };

  const save = useMutation({
    mutationFn: async (r: ReviewState) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: userRes } = await supabase.auth.getUser();
      const createdBy = userRes.user?.id ?? null;

      // Determine provenance & source label.
      const provenance = "found_during_repair";
      // Human-edited iff canonical or translation values differ from final.
      const canonical = r.originalEnglish;
      const translation = r.originalTranslation;
      const finalDetected = r.detectedPart.trim();
      const finalReason = r.reasonRequired.trim();
      const finalRelated = r.relatedOriginalDamage.trim();
      const aiSaid = translation ?? canonical;
      const edited =
        !aiSaid ||
        (aiSaid.detectedPart ?? "").trim() !== finalDetected ||
        (aiSaid.reasonRequired ?? "").trim() !== finalReason ||
        (aiSaid.relatedOriginalDamage ?? "").trim() !== finalRelated;

      // Build ai_suggestion payload; canonical (English) is permanent.
      const aiSuggestion = r.aiPayload
        ? {
            ...r.aiPayload,
            human: {
              detectedPart: finalDetected,
              reasonRequired: finalReason,
              relatedOriginalDamage: finalRelated,
              recommendedAction: r.recommendedAction,
              discoveryStage: r.discoveryStage,
              quantity: r.quantity,
            },
          }
        : null;

      // Final values stored in normalized columns:
      // canonical English when AI used (never overwrite with translation),
      // otherwise the human's typed value.
      const partName = canonical?.detectedPart?.trim()
        ? edited
          ? finalDetected // human overrode → save human final
          : canonical.detectedPart
        : finalDetected;
      const reason = canonical?.reasonRequired?.trim()
        ? edited
          ? finalReason
          : canonical.reasonRequired
        : finalReason;
      const related = canonical?.relatedOriginalDamage?.trim()
        ? edited
          ? finalRelated
          : canonical.relatedOriginalDamage
        : finalRelated;

      const revisionStatus: PartRevisionStatus = aiSettings.humanApproval
        ? "pending"
        : "approved";

      // Insert repair_parts row.
      const insertPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        job_id: jobId,
        part_name: partName || "Unnamed part",
        quantity: r.quantity,
        unit_cost: null,
        status: "required",
        created_by: createdBy,
        provenance,
        discovery_stage: r.discoveryStage,
        reason_required: reason || null,
        recommended_action: r.recommendedAction,
        related_damage: related || null,
        photo_file_id: r.fileId,
        ai_suggestion: aiSuggestion,
        revision_status: revisionStatus,
      };

      const { data: partRow, error: pErr } = await dhxWorkshop()
        .from("repair_parts")
        .insert(insertPayload)
        .select("id")
        .single();
      if (pErr) throw pErr;
      const partId = (partRow as { id: string }).id;

      // Record an assessment version (append-only).
      const source = r.aiWasUsed ? (edited ? "hybrid" : "ai") : "human";
      try {
        const { data: versionId, error: vErr } = await dhxWorkshop().rpc(
          "add_assessment_version",
          {
            p_job_id: jobId,
            p_type: "additional_part",
            p_source: source,
            p_json: {
              ai_suggestion: aiSuggestion,
              confirmed: {
                partName,
                quantity: r.quantity,
                recommendedAction: r.recommendedAction,
                discoveryStage: r.discoveryStage,
                reasonRequired: reason,
                relatedOriginalDamage: related,
                photoPath: r.photoPath,
              },
              partId,
            },
          },
        );
        if (!vErr && versionId) {
          await dhxWorkshop()
            .from("repair_parts")
            .update({ assessment_version_id: versionId })
            .eq("id", partId);
        }
      } catch {
        // Non-fatal — the part is saved either way.
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp-parts", workspaceId, jobId] });
      toast.success(tr("Part added"));
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[95vh] flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle>{tr("Add Part")}</SheetTitle>
        </SheetHeader>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePicked(e.target.files)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handlePicked(e.target.files)}
        />

        {step === "choose" && (
          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr("Take a clear photo of the part you found.")}
            </p>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-8 text-primary-foreground shadow-md"
            >
              <Camera className="h-8 w-8" />
              <span className="text-lg font-semibold">{tr("Take Photo")}</span>
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-border bg-card py-6"
            >
              <ImagePlus className="h-6 w-6" />
              <span className="text-base font-semibold">{tr("Upload Photo")}</span>
            </button>
            {aiSettings.partsMode === "both" && (
              <button
                onClick={() => setStep("manual")}
                className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground"
              >
                {tr("Enter manually instead")}
              </button>
            )}
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex-1 grid place-items-center px-5">
            <div className="text-center space-y-3">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-medium">
                {aiSettings.partsDetection
                  ? tr("Analyzing photo…")
                  : tr("Uploading photo…")}
              </p>
            </div>
          </div>
        )}

        {step === "review" && review && (
          <ReviewForm
            state={review}
            setState={setReview}
            onRetake={() => {
              setReview(null);
              setStep(initialStep);
            }}
            onConfirm={() => save.mutate(review)}
            saving={save.isPending}
            aiFailedMsg={aiFailedMsg}
          />
        )}

        {step === "manual" && (
          <ManualForm
            defaultStage={defaultStage}
            saving={save.isPending}
            onCancel={() => onOpenChange(false)}
            onSubmit={async (m) => {
              // No photo path — but table requires photo? Not enforced; save without photo.
              if (!workspaceId) return;
              const { data: userRes } = await supabase.auth.getUser();
              const createdBy = userRes.user?.id ?? null;
              const revisionStatus: PartRevisionStatus = aiSettings.humanApproval
                ? "pending"
                : "approved";
              const { error } = await dhxWorkshop()
                .from("repair_parts")
                .insert({
                  workspace_id: workspaceId,
                  job_id: jobId,
                  part_name: m.partName || "Unnamed part",
                  quantity: m.quantity,
                  unit_cost: null,
                  status: "required",
                  created_by: createdBy,
                  provenance: "found_during_repair",
                  discovery_stage: m.discoveryStage,
                  reason_required: m.reason || null,
                  recommended_action: m.recommendedAction,
                  revision_status: revisionStatus,
                });
              if (error) {
                toast.error(error.message);
                return;
              }
              qc.invalidateQueries({ queryKey: ["bp-parts", workspaceId, jobId] });
              toast.success(tr("Part added"));
              onOpenChange(false);
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Review form (large photo, chips, +/- steppers)
// ============================================================
function ReviewForm({
  state,
  setState,
  onRetake,
  onConfirm,
  saving,
  aiFailedMsg,
}: {
  state: ReviewState;
  setState: (s: ReviewState) => void;
  onRetake: () => void;
  onConfirm: () => void;
  saving: boolean;
  aiFailedMsg: string | null;
}) {
  const { tr } = useT();
  const photoUrl = useMemo(
    () => URL.createObjectURL(state.photoFile),
    [state.photoFile],
  );
  useEffect(() => () => URL.revokeObjectURL(photoUrl), [photoUrl]);

  const set = (patch: Partial<ReviewState>) => setState({ ...state, ...patch });
  const confidencePct = Math.round(state.confidence * 100);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        {aiFailedMsg && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            {tr("AI unavailable — please fill in the details manually.")}
          </div>
        )}

        <img
          src={photoUrl}
          alt=""
          className="w-full max-h-[42vh] rounded-2xl object-cover border border-border"
        />

        {state.confidence > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" /> {tr("AI confidence")}
              </span>
              <span className="font-semibold">{confidencePct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full ${
                  confidencePct >= 70
                    ? "bg-[--color-success]"
                    : confidencePct >= 40
                      ? "bg-amber-500"
                      : "bg-destructive"
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        )}

        {/* Repair vs Replace */}
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Action")}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BigChoice
              active={state.recommendedAction === "replace"}
              onClick={() => set({ recommendedAction: "replace" })}
              icon={<ReplaceIcon className="h-6 w-6" />}
              label={tr("Replace")}
            />
            <BigChoice
              active={state.recommendedAction === "repair"}
              onClick={() => set({ recommendedAction: "repair" })}
              icon={<Wrench className="h-6 w-6" />}
              label={tr("Repair")}
            />
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Quantity")}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => set({ quantity: Math.max(1, state.quantity - 1) })}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background text-2xl"
              aria-label={tr("Decrease")}
            >
              <Minus className="h-6 w-6" />
            </button>
            <div className="flex-1 grid h-14 place-items-center rounded-2xl border border-border bg-background text-3xl font-bold tabular-nums">
              {state.quantity}
            </div>
            <button
              type="button"
              onClick={() => set({ quantity: Math.min(99, state.quantity + 1) })}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background text-2xl"
              aria-label={tr("Increase")}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Detected part */}
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Detected Part")}
          </label>
          <input
            value={state.detectedPart}
            onChange={(e) => set({ detectedPart: e.target.value })}
            placeholder={tr("e.g. Left bumper bracket")}
            className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
          />
          {state.originalEnglish?.detectedPart && (
            <ShowOriginal en={state.originalEnglish.detectedPart} />
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Reason Required")}
          </label>
          <textarea
            value={state.reasonRequired}
            onChange={(e) => set({ reasonRequired: e.target.value })}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base"
          />
          {state.originalEnglish?.reasonRequired && (
            <ShowOriginal en={state.originalEnglish.reasonRequired} />
          )}
        </div>

        {/* Related damage */}
        {(state.relatedOriginalDamage ||
          state.originalEnglish?.relatedOriginalDamage) && (
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              {tr("Related Original Damage")}
            </label>
            <input
              value={state.relatedOriginalDamage}
              onChange={(e) => set({ relatedOriginalDamage: e.target.value })}
              className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
            />
            {state.originalEnglish?.relatedOriginalDamage && (
              <ShowOriginal en={state.originalEnglish.relatedOriginalDamage} />
            )}
          </div>
        )}

        {/* Discovery stage chips */}
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Discovery Stage")}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DISCOVERY_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set({ discoveryStage: s })}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  state.discoveryStage === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {tr(stageLabel(s))}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] space-y-2">
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
          {tr("Confirm")}
        </button>
        <button
          onClick={onRetake}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background text-base font-semibold disabled:opacity-50"
        >
          <RefreshCw className="h-5 w-5" /> {tr("Retake Photo")}
        </button>
      </div>
    </>
  );
}

function BigChoice({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 font-semibold ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function ShowOriginal({ en }: { en: string }) {
  const { tr, lang } = useT();
  const [show, setShow] = useState(false);
  if (lang === "en") return null;
  return (
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="mt-1 text-[11px] text-muted-foreground underline decoration-dotted"
    >
      {show ? en : tr("Show original English")}
    </button>
  );
}

// ============================================================
// Manual fallback form
// ============================================================
function ManualForm({
  defaultStage,
  onCancel,
  onSubmit,
  saving,
}: {
  defaultStage: PartDiscoveryStage;
  onCancel: () => void;
  onSubmit: (m: {
    partName: string;
    reason: string;
    quantity: number;
    recommendedAction: PartRecommendedAction;
    discoveryStage: PartDiscoveryStage;
  }) => void;
  saving: boolean;
}) {
  const { tr } = useT();
  const [partName, setPartName] = useState("");
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [action, setAction] = useState<PartRecommendedAction>("replace");
  const [stage, setStage] = useState<PartDiscoveryStage>(defaultStage);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Part name")}
          </label>
          <input
            value={partName}
            onChange={(e) => setPartName(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border border-border bg-background px-3 text-base"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Reason Required")}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-base"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Quantity")}
          </label>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background"
            >
              <Minus className="h-6 w-6" />
            </button>
            <div className="flex-1 grid h-14 place-items-center rounded-2xl border border-border bg-background text-3xl font-bold tabular-nums">
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-background"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Action")}
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <BigChoice
              active={action === "replace"}
              onClick={() => setAction("replace")}
              icon={<ReplaceIcon className="h-6 w-6" />}
              label={tr("Replace")}
            />
            <BigChoice
              active={action === "repair"}
              onClick={() => setAction("repair")}
              icon={<Wrench className="h-6 w-6" />}
              label={tr("Repair")}
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            {tr("Discovery Stage")}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DISCOVERY_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  stage === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {tr(stageLabel(s))}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-card px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] space-y-2">
        <button
          onClick={() =>
            onSubmit({
              partName,
              reason,
              quantity,
              recommendedAction: action,
              discoveryStage: stage,
            })
          }
          disabled={saving || !partName.trim()}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
          {tr("Confirm")}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="h-12 w-full rounded-2xl border border-border bg-background text-base font-semibold"
        >
          {tr("Cancel")}
        </button>
      </div>
    </>
  );
}
