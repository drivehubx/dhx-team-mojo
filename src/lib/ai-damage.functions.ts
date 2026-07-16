// Reusable AI damage-assessment entry point.
// Phase 2: analyze a single "found during repair" photo with full case context.
// Designed so other modules (Rental, Fleet, My Garage) can call the same fn later.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DISCOVERY_STAGES = ["dismantling", "repair", "qc"] as const;
const ACTIONS = ["replace", "repair"] as const;

const Input = z.object({
  jobId: z.string().uuid(),
  photoPath: z.string().min(1), // storage path inside job-photos bucket
  currentRepairStage: z.string().nullable().optional(),
});

export type AnalyzeRepairPartResult = {
  detectedPart: string;
  reasonRequired: string;
  discoveryStage: (typeof DISCOVERY_STAGES)[number];
  quantity: number;
  recommendedAction: (typeof ACTIONS)[number];
  relatedOriginalDamage: string;
  confidence: number;
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
): AnalyzeRepairPartResult {
  return {
    detectedPart: "",
    reasonRequired: "",
    discoveryStage: stageDefault(currentRepairStage),
    quantity: 1,
    recommendedAction: "replace",
    relatedOriginalDamage: "",
    confidence: 0,
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

    // --- Call Lovable AI Gateway (OpenAI-compatible) ---
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return fallback(data.photoPath, data.currentRepairStage);

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

    const systemPrompt = `You are a Body & Paint damage-assessment AI for the DHX workshop.
The technician has JUST discovered new damage while working on this repair order. You must
propose ONE additional part request based on the new photo, using the existing case context.
Never ask for information the system already provided.

Vehicle: ${veh.plate_number ?? "?"} · ${veh.make ?? ""} ${veh.model ?? ""} ${veh.year ?? ""} ${veh.color ?? ""}
Original damage notes: ${job.damage_description ?? "(none)"}
Current repair stage: ${job.repair_stage ?? "(unknown)"}
Existing parts on this job:
${partsList}

Respond with ONLY a JSON object matching this exact shape (no prose, no code fence):
{
  "detectedPart": "short part name",
  "reasonRequired": "one sentence why this part is needed",
  "discoveryStage": "dismantling" | "repair" | "qc",
  "quantity": integer >= 1,
  "recommendedAction": "replace" | "repair",
  "relatedOriginalDamage": "which original damage note this ties back to, or empty",
  "confidence": number between 0 and 1
}`;

    const userContent: any[] = [
      {
        type: "text",
        text: "New photo taken now (the part in question). Additional reference photos of the original damage follow.",
      },
      { type: "image_url", image_url: { url: newPhotoUrl } },
    ];
    for (const url of contextPhotoUrls) {
      userContent.push({ type: "image_url", image_url: { url } });
    }

    let raw: any = null;
    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
          },
          body: JSON.stringify({
            model: "openai/gpt-5.5",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
          }),
        },
      );
      if (!res.ok) {
        return fallback(data.photoPath, data.currentRepairStage);
      }
      raw = await res.json();
    } catch {
      return fallback(data.photoPath, data.currentRepairStage);
    }

    const text: string = raw?.choices?.[0]?.message?.content ?? "";
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
    if (!parsed) return fallback(data.photoPath, data.currentRepairStage);

    const discoveryStage =
      (DISCOVERY_STAGES as readonly string[]).includes(parsed.discoveryStage)
        ? parsed.discoveryStage
        : stageDefault(data.currentRepairStage);
    const recommendedAction =
      (ACTIONS as readonly string[]).includes(parsed.recommendedAction)
        ? parsed.recommendedAction
        : "replace";
    const qty = Math.max(1, Math.min(99, Number(parsed.quantity) || 1));

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
      rawJson: JSON.stringify(parsed),
    };
  });
