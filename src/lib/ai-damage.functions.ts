// Reusable AI damage-assessment entry point.
// Phase 2: analyze a single "found during repair" photo with full case context.
// Designed so other modules (Rental, Fleet, My Garage) can call the same fn later.

import { createServerFn } from "@tanstack/react-start";
import { BUDGET_STRATEGY_AI_GUIDANCE, budgetStrategyFor, type WorkRequestSource } from "@/lib/work-source";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DISCOVERY_STAGES = [
  "dismantling",
  "repair",
  "qc",
  "customer_request",
  "other",
] as const;
const ACTIONS = ["replace", "repair"] as const;
const LANGS = ["en", "zh", "ms", "id"] as const;
type Lang = (typeof LANGS)[number];

const Input = z.object({
  jobId: z.string().uuid(),
  photoPath: z.string().min(1), // storage path inside job-photos bucket
  currentRepairStage: z.string().nullable().optional(),
  lang: z.enum(LANGS).optional(),
});

export type RepairPartTranslation = {
  detectedPart: string;
  reasonRequired: string;
  relatedOriginalDamage: string;
};

export type AnalyzeRepairPartResult = {
  detectedPart: string;
  reasonRequired: string;
  discoveryStage: (typeof DISCOVERY_STAGES)[number];
  quantity: number;
  recommendedAction: (typeof ACTIONS)[number];
  relatedOriginalDamage: string;
  confidence: number;
  lang: Lang;
  translation: RepairPartTranslation | null;
  rawJson: string; // serialized AI response for the learning loop
};

const JOB_PHOTOS_BUCKET = "job-photos";

function stageDefault(stage?: string | null): (typeof DISCOVERY_STAGES)[number] {
  if (stage === "disassembly") return "dismantling";
  if (stage === "qc") return "qc";
  return "repair";
}

function fallback(
  photoPath: string,
  currentRepairStage?: string | null,
  lang: Lang = "en",
): AnalyzeRepairPartResult {
  return {
    detectedPart: "",
    reasonRequired: "",
    discoveryStage: stageDefault(currentRepairStage),
    quantity: 1,
    recommendedAction: "replace",
    relatedOriginalDamage: "",
    confidence: 0,
    lang,
    translation: null,
    rawJson: JSON.stringify({ fallback: true, photoPath }),
  };
}

export const analyzeRepairPart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data, context }): Promise<AnalyzeRepairPartResult> => {
    const sb = context.supabase as any;
    const workshop = sb.schema("workshop");
    const core = sb.schema("core");

    // --- Load case context (never re-ask what the system already knows) ---
    const { data: job } = await workshop
      .from("jobs")
      .select(
        "id, vehicle_id, damage_description, repair_stage, intake_checklist",
      )
      .eq("id", data.jobId)
      .maybeSingle();

    if (!job) throw new Error("Job not found");

    const [{ data: vehicle }, { data: existingParts }, { data: intakeFiles }] =
      await Promise.all([
        core
          .from("vehicles")
          .select("plate_number, make, model, year, color")
          .eq("id", job.vehicle_id)
          .maybeSingle(),
        workshop
          .from("repair_parts")
          .select("part_name, quantity, provenance, related_damage")
          .eq("job_id", data.jobId),
        core
          .from("files")
          .select("url")
          .eq("owner_type", "workshop.jobs")
          .eq("owner_id", data.jobId)
          .eq("file_type", "intake_photo")
          .limit(6),
      ]);

    // Sign the new photo + up to 4 intake photos for the AI to see.
    const paths = [
      data.photoPath,
      ...((intakeFiles ?? []) as { url: string }[]).slice(0, 4).map((f) => f.url),
    ];
    const { data: signed } = await sb.storage
      .from(JOB_PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 10);
    const signedByPath: Record<string, string> = {};
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedByPath[s.path] = s.signedUrl;
    }
    const newPhotoUrl = signedByPath[data.photoPath];
    const contextPhotoUrls = paths
      .slice(1)
      .map((p) => signedByPath[p])
      .filter(Boolean);

    if (!newPhotoUrl) return fallback(data.photoPath, data.currentRepairStage);

    // --- Call the shared DHX ai-vision edge function (own Gemini key) ---

    const veh = vehicle ?? {};
    const partsList =
      (existingParts as any[] | null)?.length
        ? (existingParts as any[])
            .map(
              (p) =>
                `- ${p.part_name} x${p.quantity} (${p.provenance ?? "initial"})`,
            )
            .join("\n")
        : "(none yet)";

    const lang: Lang = (data.lang ?? "en") as Lang;
    const langName: Record<Lang, string> = {
      en: "English",
      zh: "Simplified Chinese",
      ms: "Bahasa Melayu",
      id: "Bahasa Indonesia",
    };

    const translationBlock =
      lang === "en"
        ? ""
        : `\nAlso include a "translations" object with the three free-text fields translated into ${langName[lang]}. Do NOT translate "recommendedAction" or "discoveryStage" — they must stay as the exact English codes above.
"translations": { "detectedPart": "...", "reasonRequired": "...", "relatedOriginalDamage": "..." }`;

    const systemPrompt = `You are a Body & Paint damage-assessment AI for the DHX workshop.
The technician has JUST discovered new damage while working on this repair order. You must
propose ONE additional part request based on the new photo, using the existing case context.
Never ask for information the system already provided.

Vehicle: ${veh.plate_number ?? "?"} · ${veh.make ?? ""} ${veh.model ?? ""} ${veh.year ?? ""} ${veh.color ?? ""}
Original damage notes: ${job.damage_description ?? "(none)"}
Current repair stage: ${job.repair_stage ?? "(unknown)"}
Existing parts on this job:
${partsList}

Respond with ONLY a JSON object matching this exact shape (no prose, no code fence). English is canonical.
{
  "detectedPart": "short part name (English)",
  "reasonRequired": "one sentence why this part is needed (English)",
  "discoveryStage": "dismantling" | "repair" | "qc" | "customer_request" | "other",
  "quantity": integer >= 1,
  "recommendedAction": "replace" | "repair",
  "relatedOriginalDamage": "which original damage note this ties back to, or empty (English)",
  "confidence": number between 0 and 1${translationBlock ? "," : ""}${translationBlock}
}`;

    const imageUrls = [newPhotoUrl, ...contextPhotoUrls];

    let text = "";
    try {
      const { data: aiRes, error: aiErr } = await sb.functions.invoke("ai-vision", {
        body: {
          system: systemPrompt,
          user_text:
            "New photo taken now (the part in question). Additional reference photos of the original damage follow.",
          image_urls: imageUrls,
          context: "additional_part",
          source_id: data.jobId,
        },
      });
      if (aiErr || aiRes?.error) {
        console.error("[analyzeRepairPart] ai-vision:", aiErr?.message ?? aiRes?.error, aiRes?.detail ?? "");
        return fallback(data.photoPath, data.currentRepairStage, lang);
      }
      text = String(aiRes?.text ?? "");
    } catch (e) {
      console.error("[analyzeRepairPart] network:", String(e));
      return fallback(data.photoPath, data.currentRepairStage, lang);
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed) return fallback(data.photoPath, data.currentRepairStage, lang);

    const discoveryStage =
      (DISCOVERY_STAGES as readonly string[]).includes(parsed.discoveryStage)
        ? parsed.discoveryStage
        : stageDefault(data.currentRepairStage);
    const recommendedAction =
      (ACTIONS as readonly string[]).includes(parsed.recommendedAction)
        ? parsed.recommendedAction
        : "replace";
    const qty = Math.max(1, Math.min(99, Number(parsed.quantity) || 1));

    let translation: RepairPartTranslation | null = null;
    if (lang !== "en" && parsed.translations && typeof parsed.translations === "object") {
      const t = parsed.translations;
      translation = {
        detectedPart: String(t.detectedPart ?? "").slice(0, 120),
        reasonRequired: String(t.reasonRequired ?? "").slice(0, 500),
        relatedOriginalDamage: String(t.relatedOriginalDamage ?? "").slice(0, 300),
      };
      if (!translation.detectedPart && !translation.reasonRequired) {
        translation = null;
      }
    }

    return {
      detectedPart: String(parsed.detectedPart ?? "").slice(0, 120),
      reasonRequired: String(parsed.reasonRequired ?? "").slice(0, 500),
      discoveryStage,
      quantity: qty,
      recommendedAction,
      relatedOriginalDamage: String(parsed.relatedOriginalDamage ?? "").slice(
        0,
        300,
      ),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      lang,
      translation,
      rawJson: JSON.stringify(parsed),
    };
  });

// ---------------------------------------------------------------------------
// Phase 1 — Initial (accident intake) damage assessment.
// Context = "repair_estimate". Same reusable server-fn pattern as Phase 2.
// AI drafts the ORIGINAL assessment (findings + parts + labour + paint + cost
// + days + confidence). Humans review & approve; both AI raw + corrected are
// persisted for the learning loop.
// ---------------------------------------------------------------------------

const SEVERITIES = ["minor", "moderate", "major"] as const;

const InitInput = z.object({
  jobId: z.string().uuid(),
});

export type InitialFinding = {
  component: string;
  severity: (typeof SEVERITIES)[number];
  recommendedAction: (typeof ACTIONS)[number];
  confidence: number;
  notes: string;
};

export type InitialPart = {
  partName: string;
  quantity: number;
  estimatedUnitPrice: number | null;
  recommendedAction: (typeof ACTIONS)[number];
  relatedComponent: string;
};

export type AnalyzeInitialDamageResult = {
  findings: InitialFinding[];
  parts: InitialPart[];
  estimatedLabourHours: number;
  estimatedPaintPanels: number;
  estimatedDays: number;
  estimatedCost: number | null;
  overallConfidence: number;
  summary: string;
  rawJson: string;
};

function initialFallback(reason = "unknown"): AnalyzeInitialDamageResult {
  console.error("[analyzeInitialDamage] fallback:", reason);
  return {
    findings: [],
    parts: [],
    estimatedLabourHours: 0,
    estimatedPaintPanels: 0,
    estimatedDays: 0,
    estimatedCost: null,
    overallConfidence: 0,
    summary: "",
    rawJson: JSON.stringify({ fallback: true, reason }),
  };
}

export const analyzeInitialDamage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => InitInput.parse(v))
  .handler(async ({ data, context }): Promise<AnalyzeInitialDamageResult> => {
    const sb = context.supabase as any;
    const workshop = sb.schema("workshop");
    const core = sb.schema("core");

    const { data: job } = await workshop
      .from("jobs")
      .select("id, vehicle_id, damage_description, repair_stage, work_request_source")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    const [{ data: vehicle }, { data: intakeFiles }] = await Promise.all([
      core
        .from("vehicles")
        .select("plate_number, make, model, year, color")
        .eq("id", job.vehicle_id)
        .maybeSingle(),
      core
        .from("files")
        .select("url")
        .eq("owner_type", "workshop.jobs")
        .eq("owner_id", data.jobId)
        .eq("file_type", "intake_photo")
        .order("created_at", { ascending: true })
        .limit(8),
    ]);

    const paths = ((intakeFiles ?? []) as { url: string }[]).map((f) => f.url);
    if (paths.length === 0) return initialFallback("no_intake_photos");

    const { data: signed } = await sb.storage
      .from(JOB_PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 10);
    const photoUrls = (signed ?? [])
      .map((s: any) => s?.signedUrl)
      .filter(Boolean) as string[];
    if (photoUrls.length === 0) return initialFallback("storage_signed_urls_failed");



    const veh = vehicle ?? {};
    const systemPrompt = `You are the DHX Body & Paint AI damage-assessment engine (Phase 1: accident intake).
The technician has just taken photos of an incoming damaged vehicle. Produce the ORIGINAL assessment
that a human estimator will review and approve. Be conservative — flag low confidence rather than
guessing. Never invent parts you cannot see damage evidence for.

Vehicle: ${veh.plate_number ?? "?"} · ${veh.make ?? ""} ${veh.model ?? ""} ${veh.year ?? ""} ${veh.color ?? ""}
Notes from work request: ${job.damage_description ?? "(none)"}
${BUDGET_STRATEGY_AI_GUIDANCE[budgetStrategyFor((job.work_request_source ?? "walk_in") as WorkRequestSource)]}

Respond with ONLY a JSON object of this exact shape (no prose, no code fence):
{
  "summary": "one short paragraph describing overall damage",
  "findings": [
    {
      "component": "e.g. Front Bumper",
      "severity": "minor" | "moderate" | "major",
      "recommendedAction": "replace" | "repair",
      "confidence": 0.0-1.0,
      "notes": "short reason"
    }
  ],
  "parts": [
    {
      "partName": "e.g. Front Bumper Cover",
      "quantity": integer >= 1,
      "estimatedUnitPrice": number in MYR (see pricing rule below),
      "recommendedAction": "replace" | "repair",
      "relatedComponent": "which finding.component this ties to"
    }
  ],
  "estimatedLabourHours": number,
  "estimatedPaintPanels": integer,
  "estimatedDays": integer,
  "estimatedCost": number in MYR (sum of parts + labour + paint),
  "overallConfidence": 0.0-1.0
}

PRICING RULE — IMPORTANT:
- ALWAYS provide a realistic best-estimate MYR unit price for every part, based on
  typical Malaysian workshop / aftermarket pricing for this vehicle's make, model
  and year (e.g. Perodua Axia / Bezza / Myvi / Alza parts are cheap; continental
  makes are higher). A rough but reasonable number is far more useful to the
  estimator than null.
- Use null ONLY for a genuinely un-priceable placeholder line (e.g. "misc
  consumables TBD"). Do not use null just because you are uncertain — give
  your best guess.`;

    let text = "";
    try {
      const { data: aiRes, error: aiErr } = await sb.functions.invoke("ai-vision", {
        body: {
          system: systemPrompt,
          user_text: "Damage photos of the incoming vehicle:",
          image_urls: photoUrls,
          context: "initial_assessment",
          source_id: data.jobId,
        },
      });
      if (aiErr) return initialFallback(`ai_vision_invoke: ${aiErr.message ?? "error"}`);
      if (aiRes?.error) {
        return initialFallback(
          `${aiRes.error}${aiRes.detail ? ": " + String(aiRes.detail).slice(0, 140) : ""}`,
        );
      }
      text = String(aiRes?.text ?? "");
    } catch (e) {
      return initialFallback(`network: ${e instanceof Error ? e.message : "error"}`);
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed) return initialFallback("ai_response_not_json");

    const findings: InitialFinding[] = Array.isArray(parsed.findings)
      ? parsed.findings.slice(0, 20).map((f: any) => ({
          component: String(f?.component ?? "").slice(0, 120),
          severity: (SEVERITIES as readonly string[]).includes(f?.severity)
            ? f.severity
            : "moderate",
          recommendedAction: (ACTIONS as readonly string[]).includes(
            f?.recommendedAction,
          )
            ? f.recommendedAction
            : "repair",
          confidence: Math.max(0, Math.min(1, Number(f?.confidence) || 0)),
          notes: String(f?.notes ?? "").slice(0, 400),
        }))
      : [];

    const parts: InitialPart[] = Array.isArray(parsed.parts)
      ? parsed.parts.slice(0, 30).map((p: any) => ({
          partName: String(p?.partName ?? "").slice(0, 120),
          quantity: Math.max(1, Math.min(99, Number(p?.quantity) || 1)),
          estimatedUnitPrice:
            p?.estimatedUnitPrice == null
              ? null
              : Number.isFinite(Number(p.estimatedUnitPrice))
                ? Math.max(0, Number(p.estimatedUnitPrice))
                : null,
          recommendedAction: (ACTIONS as readonly string[]).includes(
            p?.recommendedAction,
          )
            ? p.recommendedAction
            : "replace",
          relatedComponent: String(p?.relatedComponent ?? "").slice(0, 120),
        }))
      : [];

    return {
      findings,
      parts,
      estimatedLabourHours: Math.max(0, Number(parsed.estimatedLabourHours) || 0),
      estimatedPaintPanels: Math.max(
        0,
        Math.floor(Number(parsed.estimatedPaintPanels) || 0),
      ),
      estimatedDays: Math.max(0, Math.floor(Number(parsed.estimatedDays) || 0)),
      estimatedCost: (() => {
        // Authoritative: sum of (qty × unit price) across priced parts.
        // Fall back to AI-provided total only when no priced parts exist.
        const partsSum = parts.reduce((acc, p) => {
          if (p.estimatedUnitPrice == null) return acc;
          return acc + p.estimatedUnitPrice * p.quantity;
        }, 0);
        if (partsSum > 0) return Math.round(partsSum * 100) / 100;
        if (parsed.estimatedCost == null) return null;
        return Number.isFinite(Number(parsed.estimatedCost))
          ? Math.max(0, Number(parsed.estimatedCost))
          : null;
      })(),
      overallConfidence: Math.max(
        0,
        Math.min(1, Number(parsed.overallConfidence) || 0),
      ),
      summary: String(parsed.summary ?? "").slice(0, 800),
      rawJson: JSON.stringify(parsed),
    };
  });

// ---------------------------------------------------------------------------
// Vehicle identification from intake photos.
// AI-drafts / humans-approve: fills make/model/year/color from photos; the
// technician still confirms and saves via VehicleModelFixer.
// ---------------------------------------------------------------------------

const IdentifyInput = z.object({ jobId: z.string().uuid() });

export type IdentifyVehicleResult = {
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  confidence: number;
  rawJson: string;
};

function identifyFallback(reason = "unknown"): IdentifyVehicleResult {
  console.error("[identifyVehicleFromPhotos] fallback:", reason);
  return {
    make: null,
    model: null,
    year: null,
    color: null,
    confidence: 0,
    rawJson: JSON.stringify({ fallback: true, reason }),
  };
}

export const identifyVehicleFromPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => IdentifyInput.parse(v))
  .handler(async ({ data, context }): Promise<IdentifyVehicleResult> => {
    const sb = context.supabase as any;
    const workshop = sb.schema("workshop");
    const core = sb.schema("core");

    const { data: job } = await workshop
      .from("jobs")
      .select("id, vehicle_id")
      .eq("id", data.jobId)
      .maybeSingle();
    if (!job) throw new Error("Job not found");

    const [{ data: vehicle }, { data: intakeFiles }] = await Promise.all([
      core
        .from("vehicles")
        .select("plate_number")
        .eq("id", job.vehicle_id)
        .maybeSingle(),
      core
        .from("files")
        .select("url")
        .eq("owner_type", "workshop.jobs")
        .eq("owner_id", data.jobId)
        .eq("file_type", "intake_photo")
        .order("created_at", { ascending: true })
        .limit(8),
    ]);

    const paths = ((intakeFiles ?? []) as { url: string }[]).map((f) => f.url);
    if (paths.length === 0) return identifyFallback("no_intake_photos");

    const { data: signed } = await sb.storage
      .from(JOB_PHOTOS_BUCKET)
      .createSignedUrls(paths, 60 * 10);
    const photoUrls = (signed ?? [])
      .map((s: any) => s?.signedUrl)
      .filter(Boolean) as string[];
    if (photoUrls.length === 0) return identifyFallback("storage_signed_urls_failed");

    const plate = (vehicle as any)?.plate_number ?? "?";
    const systemPrompt = `You are a vehicle identification assistant for a Malaysian workshop.
Look at the photos of the vehicle (plate: ${plate}) and identify:
- make (brand, e.g. "Perodua", "Toyota", "Honda")
- model (e.g. "Axia", "Myvi", "Alza", "Vios", "City")
- year (best-guess model year as integer, or null if unsure)
- color (short common name, e.g. "White", "Silver", "Red")
- confidence (0.0-1.0 overall)

Common Malaysian fleet cars include Perodua Axia / Bezza / Myvi / Alza,
Proton Saga / Persona / X50, Toyota Vios / Yaris, Honda City / Jazz.

Respond with ONLY a JSON object of this exact shape (no prose, no code fence):
{ "make": string|null, "model": string|null, "year": integer|null, "color": string|null, "confidence": 0.0-1.0 }`;

    let text = "";
    try {
      const { data: aiRes, error: aiErr } = await sb.functions.invoke("ai-vision", {
        body: {
          system: systemPrompt,
          user_text: "Identify the vehicle in these photos:",
          image_urls: photoUrls,
          context: "vehicle_identify",
          source_id: data.jobId,
        },
      });
      if (aiErr) return identifyFallback(`ai_vision_invoke: ${aiErr.message ?? "error"}`);
      if (aiRes?.error) {
        return identifyFallback(
          `${aiRes.error}${aiRes.detail ? ": " + String(aiRes.detail).slice(0, 140) : ""}`,
        );
      }
      text = String(aiRes?.text ?? "");
    } catch (e) {
      return identifyFallback(`network: ${e instanceof Error ? e.message : "error"}`);
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed) return identifyFallback("ai_response_not_json");

    const yearNum = Number(parsed.year);
    return {
      make: parsed.make ? String(parsed.make).slice(0, 60) : null,
      model: parsed.model ? String(parsed.model).slice(0, 60) : null,
      year: Number.isFinite(yearNum) && yearNum >= 1950 && yearNum <= 2100
        ? Math.floor(yearNum)
        : null,
      color: parsed.color ? String(parsed.color).slice(0, 40) : null,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      rawJson: JSON.stringify(parsed),
    };
  });
