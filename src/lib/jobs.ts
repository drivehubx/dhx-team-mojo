import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sbCore,
  sbWorkshop,
  type WorkshopJob,
  type WorkshopJobWorker,
  type CoreVehicle,
  type CoreProfile,
  type JobStatus,
} from "@/integrations/supabase/shared-schema";

export type JobWithRels = WorkshopJob & {
  vehicle: Pick<CoreVehicle, "id" | "plate_number" | "make" | "model" | "status"> | null;
  workers: Array<{
    id: string;
    profile_id: string;
    role_on_job: string | null;
    profile: Pick<CoreProfile, "id" | "full_name" | "avatar_url"> | null;
  }>;
};

async function hydrateJobs(rows: WorkshopJob[]): Promise<JobWithRels[]> {
  if (rows.length === 0) return [];
  const vIds = Array.from(new Set(rows.map((r) => r.vehicle_id)));
  const jIds = rows.map((r) => r.id);
  const [{ data: vehicles }, { data: jws }] = await Promise.all([
    sbCore().from("vehicles").select("id, plate_number, make, model, status").in("id", vIds),
    sbWorkshop().from("job_workers").select("*").in("job_id", jIds),
  ]);
  const vMap = new Map((vehicles ?? []).map((v: any) => [v.id, v]));
  const workerRows = (jws ?? []) as WorkshopJobWorker[];
  const pIds = Array.from(new Set(workerRows.map((w) => w.profile_id)));
  const { data: profs } = pIds.length
    ? await sbCore().from("profiles").select("id, full_name, avatar_url").in("id", pIds)
    : { data: [] as any[] };
  const pMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
  return rows.map((j) => ({
    ...j,
    vehicle: (vMap.get(j.vehicle_id) as any) ?? null,
    workers: workerRows
      .filter((w) => w.job_id === j.id)
      .map((w) => ({
        id: w.id,
        profile_id: w.profile_id,
        role_on_job: w.role_on_job,
        profile: (pMap.get(w.profile_id) as any) ?? null,
      })),
  }));
}

export function useJobs(
  workspaceId: string | null,
  opts: { includeSold?: boolean; includeArchived?: boolean; includeCancelled?: boolean } = {},
) {
  const includeSold = !!opts.includeSold;
  const includeArchived = !!opts.includeArchived;
  const includeCancelled = opts.includeCancelled ?? true;
  return useQuery({
    queryKey: ["jobs", workspaceId, { includeSold, includeArchived, includeCancelled }],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = sbWorkshop()
        .from("jobs")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (!includeArchived) qb = qb.is("archived_at", null);
      const { data, error } = await qb.order("created_at", { ascending: false });
      if (error) throw error;
      let hydrated = await hydrateJobs((data ?? []) as WorkshopJob[]);
      if (!includeSold) hydrated = hydrated.filter((j) => j.vehicle?.status !== "sold");
      if (!includeCancelled) hydrated = hydrated.filter((j) => j.status !== "cancelled");
      return hydrated;
    },
  });
}


export function useJob(workspaceId: string | null, id: string) {
  return useQuery({
    queryKey: ["job", workspaceId, id],
    enabled: !!workspaceId && !!id,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [hydrated] = await hydrateJobs([data as WorkshopJob]);
      return hydrated;
    },
  });
}

export function useVehicles(
  workspaceId: string | null,
  opts: { includeSold?: boolean } = {},
) {
  const includeSold = !!opts.includeSold;
  return useQuery({
    queryKey: ["vehicles", workspaceId, { includeSold }],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = sbCore()
        .from("vehicles")
        .select("*")
        .eq("workspace_id", workspaceId);
      if (!includeSold) qb = qb.neq("status", "sold");
      const { data, error } = await qb.order("plate_number");
      if (error) throw error;
      return (data ?? []) as CoreVehicle[];
    },
  });
}

export function useSoldVehicles(workspaceId: string | null) {
  return useQuery({
    queryKey: ["vehicles", workspaceId, { onlySold: true }],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("vehicles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("status", "sold")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CoreVehicle[];
    },
  });
}

export function useWorkspaceProfiles(workspaceId: string | null) {
  return useQuery({
    queryKey: ["profiles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("profiles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as CoreProfile[];
    },
  });
}

export function useCreateJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vehicle_id: string;
      description: string;
      worker_ids: string[];
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: job, error } = await sbWorkshop()
        .from("jobs")
        .insert({
          workspace_id: workspaceId,
          vehicle_id: input.vehicle_id,
          description: input.description || null,
          status: "open" as JobStatus,
        })
        .select()
        .single();
      if (error) throw error;
      if (input.worker_ids.length > 0) {
        const rows = input.worker_ids.map((pid) => ({
          workspace_id: workspaceId,
          job_id: job.id,
          profile_id: pid,
        }));
        const { error: e2 } = await sbWorkshop().from("job_workers").insert(rows);
        if (e2) throw e2;
      }
      return job as WorkshopJob;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", workspaceId] }),
  });
}

export function useUpdateJobStatus(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: JobStatus }) => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.id] });
    },
  });
}

// ---- Intake / photos / estimate ----

import { supabase } from "@/integrations/supabase/client";
import type {
  CoreFile,
  IntakeChecklist,
  RepairStage,
} from "@/integrations/supabase/shared-schema";

export type IntakePhoto = {
  id: string;
  path: string; // storage path stored in core.files.url
  signedUrl: string | null;
};

const JOB_PHOTOS_BUCKET = "job-photos";

async function signPaths(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

export function useJobPhotos(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["job-photos", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async (): Promise<IntakePhoto[]> => {
      const { data, error } = await sbCore()
        .from("files")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_type", "workshop.jobs")
        .eq("owner_id", jobId)
        .eq("file_type", "intake_photo")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CoreFile[];
      const paths = rows.map((r) => r.url);
      const signed = await signPaths(paths);
      return rows.map((r) => ({
        id: r.id,
        path: r.url,
        signedUrl: signed[r.url] ?? null,
      }));
    },
  });
}

export function useProfileById(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ["profile-by-id", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("profiles")
        .select("id, full_name")
        .eq("id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; full_name: string } | null;
    },
  });
}

export type IntakeInput = {
  vehicle_id: string;
  damage_description: string;
  estimate_amount: number | null;
  intake_checklist: IntakeChecklist;
  photos: File[];
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "jpg";
}

export function useCreateJobIntake(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: IntakeInput) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: job, error } = await sbWorkshop()
        .from("jobs")
        .insert({
          workspace_id: workspaceId,
          vehicle_id: input.vehicle_id,
          description: input.damage_description || null,
          damage_description: input.damage_description || null,
          estimate_amount: input.estimate_amount,
          intake_checklist: input.intake_checklist,
          repair_stage: "queued" as RepairStage,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      const jobRow = job as WorkshopJob;

      // Upload photos
      const { data: userRes } = await supabase.auth.getUser();
      const uploadedBy = userRes.user?.id ?? null;

      for (const file of input.photos) {
        const uuid =
          (globalThis.crypto as any)?.randomUUID?.() ??
          Math.random().toString(36).slice(2);
        const path = `${workspaceId}/${jobRow.id}/${uuid}.${extOf(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(JOB_PHOTOS_BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: fErr } = await sbCore().from("files").insert({
          workspace_id: workspaceId,
          owner_type: "workshop.jobs",
          owner_id: jobRow.id,
          file_type: "intake_photo",
          url: path,
          status: "pending",
          uploaded_by: uploadedBy,
        });
        if (fErr) throw fErr;
      }
      return jobRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", workspaceId] }),
  });
}

export function useApproveEstimate(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, profileId }: { jobId: string; profileId: string }) => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .update({ estimate_approved: true, estimate_approved_by: profileId })
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.jobId] });
    },
  });
}

export const REPAIR_STAGES: RepairStage[] = [
  "queued",
  "disassembly",
  "panel_repair",
  "putty",
  "primer",
  "paint",
  "polish",
  "qc",
  "completed",
];

export function useAdvanceStage(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      currentStage,
      startedAt,
    }: {
      jobId: string;
      currentStage: RepairStage;
      startedAt: string | null;
    }) => {
      const idx = REPAIR_STAGES.indexOf(currentStage);
      if (idx < 0 || idx >= REPAIR_STAGES.length - 1) {
        throw new Error("Already at final stage");
      }
      const next = REPAIR_STAGES[idx + 1];
      const patch: Record<string, unknown> = { repair_stage: next };
      if (next === "disassembly" && !startedAt) patch.started_at = new Date().toISOString();
      if (next === "completed") patch.completed_at = new Date().toISOString();
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .update(patch)
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;
      return { job: data as WorkshopJob, next };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.jobId] });
    },
  });
}

export type WorkOrderInput = {
  jobId: string;
  assigned_lead_id: string | null;
  labor_hours_estimate: number | null;
  due_date: string | null;
};

export function useUpdateWorkOrder(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkOrderInput) => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .update({
          assigned_lead_id: input.assigned_lead_id,
          labor_hours_estimate: input.labor_hours_estimate,
          due_date: input.due_date,
        })
        .eq("id", input.jobId)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.jobId] });
    },
  });
}

// ---- Parts ----

export type RepairPartStatus = "required" | "ordered" | "received" | "installed";
export const PART_STATUS_ORDER: RepairPartStatus[] = [
  "required",
  "ordered",
  "received",
  "installed",
];

export type PartProvenance = "initial_assessment" | "found_during_repair";
export type PartDiscoveryStage =
  | "dismantling"
  | "repair"
  | "qc"
  | "customer_request"
  | "other";
export type PartRecommendedAction = "replace" | "repair";
export type PartRevisionStatus = "pending" | "approved" | "rejected" | "draft_revision";

export type RepairPart = {
  id: string;
  workspace_id: string;
  job_id: string;
  part_name: string;
  quantity: number;
  unit_cost: number | null;
  status: RepairPartStatus;
  supplier: string | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  provenance: PartProvenance;
  discovery_stage: PartDiscoveryStage | null;
  reason_required: string | null;
  recommended_action: PartRecommendedAction | null;
  related_damage: string | null;
  photo_file_id: string | null;
  ai_suggestion: unknown | null;
  revision_status: PartRevisionStatus;
};

export function useRepairParts(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["repair-parts", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("repair_parts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RepairPart[];
    },
  });
}

export type AddPartInput = {
  job_id: string;
  part_name: string;
  quantity: number;
  unit_cost: number | null;
  supplier: string | null;
};

export function useAddPart(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddPartInput) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await sbWorkshop()
        .from("repair_parts")
        .insert({
          workspace_id: workspaceId,
          job_id: input.job_id,
          part_name: input.part_name,
          quantity: input.quantity,
          unit_cost: input.unit_cost,
          supplier: input.supplier,
          status: "required" as RepairPartStatus,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RepairPart;
    },
    onSuccess: (d) =>
      qc.invalidateQueries({ queryKey: ["repair-parts", workspaceId, d.job_id] }),
  });
}

export function useUpdatePartStatus(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      jobId,
      status,
    }: {
      id: string;
      jobId: string;
      status: RepairPartStatus;
    }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "ordered") patch.ordered_at = new Date().toISOString();
      if (status === "received") patch.received_at = new Date().toISOString();
      const { data, error } = await sbWorkshop()
        .from("repair_parts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { part: data as RepairPart, jobId };
    },
    onSuccess: (res) =>
      qc.invalidateQueries({ queryKey: ["repair-parts", workspaceId, res.jobId] }),
  });
}

// ---- QC ----

export type QcRecord = {
  id: string;
  workspace_id: string;
  job_id: string;
  inspected_by: string | null;
  passed: boolean | null;
  notes: string | null;
  rework_required: boolean;
  rework_notes: string | null;
  created_at: string;
};

export type QcPhoto = {
  id: string;
  kind: "qc_before" | "qc_after";
  path: string;
  signedUrl: string | null;
};

export function useQcRecord(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["qc-record", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const [recRes, filesRes] = await Promise.all([
        sbWorkshop()
          .from("qc_records")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1),
        sbCore()
          .from("files")
          .select("*")
          .eq("workspace_id", workspaceId)
          .eq("owner_type", "workshop.jobs")
          .eq("owner_id", jobId)
          .in("file_type", ["qc_before", "qc_after"])
          .order("created_at", { ascending: true }),
      ]);
      if (recRes.error) throw recRes.error;
      if (filesRes.error) throw filesRes.error;
      const fileRows = (filesRes.data ?? []) as CoreFile[];
      const paths = fileRows.map((r) => r.url);
      const signed = await signPaths(paths);
      const photos: QcPhoto[] = fileRows.map((r) => ({
        id: r.id,
        kind: r.file_type as "qc_before" | "qc_after",
        path: r.url,
        signedUrl: signed[r.url] ?? null,
      }));
      return {
        record: ((recRes.data ?? [])[0] ?? null) as QcRecord | null,
        photos,
      };
    },
  });
}

export type SubmitQcInput = {
  jobId: string;
  inspectedBy: string;
  passed: boolean;
  notes: string;
  reworkRequired: boolean;
  reworkNotes: string;
  beforePhoto: File | null;
  afterPhoto: File | null;
  currentReworkCount: number;
};

export function useSubmitQc(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitQcInput) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: userRes } = await supabase.auth.getUser();
      const uploadedBy = userRes.user?.id ?? null;

      const uploadOne = async (file: File, kind: "qc_before" | "qc_after") => {
        const uuid =
          (globalThis.crypto as any)?.randomUUID?.() ??
          Math.random().toString(36).slice(2);
        const path = `${workspaceId}/${input.jobId}/${kind}-${uuid}.${extOf(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from(JOB_PHOTOS_BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: fErr } = await sbCore().from("files").insert({
          workspace_id: workspaceId,
          owner_type: "workshop.jobs",
          owner_id: input.jobId,
          file_type: kind,
          url: path,
          status: "pending",
          uploaded_by: uploadedBy,
        });
        if (fErr) throw fErr;
      };

      if (input.beforePhoto) await uploadOne(input.beforePhoto, "qc_before");
      if (input.afterPhoto) await uploadOne(input.afterPhoto, "qc_after");

      const { data, error } = await sbWorkshop()
        .from("qc_records")
        .insert({
          workspace_id: workspaceId,
          job_id: input.jobId,
          inspected_by: input.inspectedBy,
          passed: input.passed,
          notes: input.notes || null,
          rework_required: input.reworkRequired,
          rework_notes: input.reworkRequired ? input.reworkNotes || null : null,
        })
        .select()
        .single();
      if (error) throw error;

      if (input.reworkRequired) {
        const { error: jErr } = await sbWorkshop()
          .from("jobs")
          .update({ rework_count: (input.currentReworkCount ?? 0) + 1 })
          .eq("id", input.jobId);
        if (jErr) throw jErr;
      }

      return data as QcRecord;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["qc-record", workspaceId, vars.jobId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.jobId] });
    },
  });
}

// ---- Release ----

export function useReleaseJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, profileId }: { jobId: string; profileId: string }) => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .update({
          released_at: new Date().toISOString(),
          released_by: profileId,
          repair_stage: "completed" as RepairStage,
          status: "completed" as JobStatus,
        })
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, vars.jobId] });
    },
  });
}

// ---- Additional part found during repair (Phase 2 AI flow) ----

export type FoundPartInput = {
  jobId: string;
  photoFile: File;
  partName: string;
  reasonRequired: string;
  discoveryStage: PartDiscoveryStage;
  quantity: number;
  recommendedAction: PartRecommendedAction;
  relatedDamage: string;
  aiSuggestion: unknown | null;
};

export function useAddFoundPart(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FoundPartInput) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: userRes } = await supabase.auth.getUser();
      const uploadedBy = userRes.user?.id ?? null;

      // 1. Upload the discovery photo (universal media pattern).
      const ext =
        input.photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const uuid =
        (globalThis.crypto as any)?.randomUUID?.() ??
        Math.random().toString(36).slice(2);
      const path = `${workspaceId}/${input.jobId}/found/${uuid}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("job-photos")
        .upload(path, input.photoFile, {
          contentType: input.photoFile.type || undefined,
        });
      if (upErr) throw upErr;

      // 2. Register file in core.files. owner_id=jobId keeps the photo
      // discoverable from the job even before the part row exists.
      const { data: fileRow, error: fErr } = await sbCore()
        .from("files")
        .insert({
          workspace_id: workspaceId,
          owner_type: "workshop.repair_parts",
          owner_id: input.jobId,
          file_type: "found_part_photo",
          url: path,
          status: "approved",
          uploaded_by: uploadedBy,
        })
        .select("id")
        .single();
      if (fErr) throw fErr;

      // 3. Create the part row, marked as a draft quotation revision.
      const { data: part, error: pErr } = await sbWorkshop()
        .from("repair_parts")
        .insert({
          workspace_id: workspaceId,
          job_id: input.jobId,
          part_name: input.partName,
          quantity: input.quantity,
          unit_cost: null,
          status: "required" as RepairPartStatus,
          created_by: uploadedBy,
          provenance: "found_during_repair" as PartProvenance,
          discovery_stage: input.discoveryStage,
          reason_required: input.reasonRequired || null,
          recommended_action: input.recommendedAction,
          related_damage: input.relatedDamage || null,
          photo_file_id: (fileRow as { id: string }).id,
          ai_suggestion: input.aiSuggestion ?? null,
          revision_status: "draft_revision" as PartRevisionStatus,
        })
        .select()
        .single();
      if (pErr) throw pErr;
      return part as RepairPart;
    },
    onSuccess: (p) =>
      qc.invalidateQueries({ queryKey: ["repair-parts", workspaceId, p.job_id] }),
  });
}

export function useApprovePartRevision(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, jobId }: { id: string; jobId: string }) => {
      const { data, error } = await sbWorkshop()
        .from("repair_parts")
        .update({ revision_status: "approved" as PartRevisionStatus })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { part: data as RepairPart, jobId };
    },
    onSuccess: (res) =>
      qc.invalidateQueries({ queryKey: ["repair-parts", workspaceId, res.jobId] }),
  });
}

// ---- Phase 1: AI-assisted work-request intake ----

export {
  WORK_REQUEST_SOURCES,
  WORK_REQUEST_SOURCE_LABELS,
  WORK_SOURCE_CATEGORY,
  CATEGORY_BUDGET_STRATEGY,
  BUDGET_STRATEGY_LABELS,
  budgetStrategyFor,
} from "@/lib/work-source";
import type { WorkRequestSource } from "@/lib/work-source";
export type { WorkRequestSource, WorkSourceCategory, BudgetStrategy } from "@/lib/work-source";

export function useSearchVehiclesByPlate(
  workspaceId: string | null,
  query: string,
) {
  const q = query.trim().replace(/[^\w\s-]/g, "");
  return useQuery({
    queryKey: ["vehicle-search", workspaceId, q.toUpperCase()],
    enabled: !!workspaceId && q.length >= 2,
    queryFn: async () => {
      // Search by plate OR make OR model — "prius", "alza", "myvi" all work.
      const { data, error } = await sbCore()
        .from("vehicles")
        .select("id, plate_number, make, model, year")
        .eq("workspace_id", workspaceId)
        .or(`plate_number.ilike.%${q}%,make.ilike.%${q}%,model.ilike.%${q}%`)
        .neq("status", "sold")
        .order("plate_number")
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Pick<
        CoreVehicle,
        "id" | "plate_number" | "make" | "model" | "year"
      >[];
    },
  });
}

export function useQuickAddVehicle(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      plate_number: string;
      make: string;
      model: string;
      year: number | null;
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data, error } = await sbCore()
        .from("vehicles")
        .insert({
          workspace_id: workspaceId,
          plate_number: input.plate_number.trim().toUpperCase(),
          make: input.make.trim() || null,
          model: input.model.trim() || null,
          year: input.year,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CoreVehicle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles", workspaceId] });
      qc.invalidateQueries({ queryKey: ["vehicle-search", workspaceId] });
    },
  });
}

/**
 * Create a draft job + upload intake photos. Photos are attached BEFORE the AI
 * runs so the server function can pull them via signed URLs. The job starts
 * `open` / `queued` and is upgraded on approval (or left as-is if the user
 * bails out — it still flows into the normal jobs board).
 */
/** Save an AI assessment draft onto an existing job (run from the job page). */
export function useSaveAIAssessmentDraft(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      rawJson: string;
      estimatedLabourHours: number;
      estimatedPaintPanels: number;
      estimatedDays: number;
      estimatedCost: number | null;
      summary: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      let aiRaw: unknown;
      try {
        aiRaw = JSON.parse(input.rawJson);
      } catch {
        aiRaw = { raw: input.rawJson };
      }
      const { error } = await sbWorkshop()
        .from("jobs")
        .update({
          ai_initial_assessment: aiRaw,
          estimated_labour_hours: input.estimatedLabourHours,
          estimated_paint_panels: input.estimatedPaintPanels,
          estimated_days: input.estimatedDays,
          estimate_amount: input.estimatedCost,
          damage_description: input.summary || null,
        })
        .eq("id", input.jobId)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["job", workspaceId, v.jobId] });
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
    },
  });
}

/** Fill in missing make/model/year on an existing vehicle (quick-added cars). */
export function useUpdateVehicleBasics(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vehicleId: string;
      make: string;
      model: string;
      year: number | null;
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data, error } = await sbCore()
        .from("vehicles")
        .update({
          make: input.make.trim() || null,
          model: input.model.trim() || null,
          year: input.year,
        })
        .eq("id", input.vehicleId)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
      if (error) throw error;
      return data as CoreVehicle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vehicles", workspaceId] });
      qc.invalidateQueries({ queryKey: ["vehicle-search", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId] });
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
    },
  });
}

/** Upload intake photos to an existing job via the universal core.files pattern. */
export async function uploadIntakePhotos(
  workspaceId: string,
  jobId: string,
  photos: File[],
): Promise<void> {
  const { data: userRes } = await supabase.auth.getUser();
  const uploadedBy = userRes.user?.id ?? null;
  for (const file of photos) {
    const uuid =
      (globalThis.crypto as any)?.randomUUID?.() ??
      Math.random().toString(36).slice(2);
    const path = `${workspaceId}/${jobId}/${uuid}.${extOf(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(JOB_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { error: fErr } = await sbCore().from("files").insert({
      workspace_id: workspaceId,
      owner_type: "workshop.jobs",
      owner_id: jobId,
      file_type: "intake_photo",
      url: path,
      status: "approved",
      uploaded_by: uploadedBy,
    });
    if (fErr) throw fErr;
  }
}

export function useCreateDraftJobForAI(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      vehicle_id: string;
      work_request_source: WorkRequestSource;
      damage_description: string;
      photos: File[];
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: job, error } = await sbWorkshop()
        .from("jobs")
        .insert({
          workspace_id: workspaceId,
          vehicle_id: input.vehicle_id,
          description: input.damage_description || null,
          damage_description: input.damage_description || null,
          work_request_source: input.work_request_source,
          repair_stage: "queued" as RepairStage,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      const jobRow = job as WorkshopJob;

      await uploadIntakePhotos(workspaceId, jobRow.id, input.photos);
      return jobRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs", workspaceId] }),
  });
}

export type CorrectedFinding = {
  component: string;
  severity: "minor" | "moderate" | "major";
  recommendedAction: "replace" | "repair";
  notes: string;
};
export type CorrectedPart = {
  partName: string;
  quantity: number;
  unitPrice: number | null;
  recommendedAction: "replace" | "repair";
  relatedComponent: string;
};

/**
 * Persist the human-approved assessment: writes the corrected snapshot
 * (+ raw AI output) onto the job, materializes each part with
 * provenance='initial_assessment', and records the initial estimate. The
 * job continues through the existing workflow untouched.
 */
export function useApproveInitialAssessment(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      aiRawJson: string;
      correctedFindings: CorrectedFinding[];
      correctedParts: CorrectedPart[];
      estimatedLabourHours: number;
      estimatedPaintPanels: number;
      estimatedDays: number;
      estimateAmount: number | null;
      summary: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: userRes } = await supabase.auth.getUser();
      const createdBy = userRes.user?.id ?? null;

      let aiRaw: unknown = null;
      try {
        aiRaw = JSON.parse(input.aiRawJson);
      } catch {
        aiRaw = { raw: input.aiRawJson };
      }
      const corrected = {
        summary: input.summary,
        findings: input.correctedFindings,
        parts: input.correctedParts,
        estimatedLabourHours: input.estimatedLabourHours,
        estimatedPaintPanels: input.estimatedPaintPanels,
        estimatedDays: input.estimatedDays,
        estimateAmount: input.estimateAmount,
        approvedAt: new Date().toISOString(),
      };

      const { error: jErr } = await sbWorkshop()
        .from("jobs")
        .update({
          ai_initial_assessment: aiRaw,
          ai_corrected_assessment: corrected,
          damage_description: input.summary || null,
          estimate_amount: input.estimateAmount,
          estimated_labour_hours: input.estimatedLabourHours,
          estimated_paint_panels: input.estimatedPaintPanels,
          estimated_days: input.estimatedDays,
          labor_hours_estimate: input.estimatedLabourHours || null,
        })
        .eq("id", input.jobId);
      if (jErr) throw jErr;

      if (input.correctedParts.length > 0) {
        const rows = input.correctedParts.map((p) => ({
          workspace_id: workspaceId,
          job_id: input.jobId,
          part_name: p.partName,
          quantity: p.quantity,
          unit_cost: p.unitPrice,
          status: "required" as RepairPartStatus,
          created_by: createdBy,
          provenance: "initial_assessment" as PartProvenance,
          recommended_action: p.recommendedAction,
          related_damage: p.relatedComponent || null,
          revision_status: "approved" as PartRevisionStatus,
        }));
        const { error: pErr } = await sbWorkshop()
          .from("repair_parts")
          .insert(rows);
        if (pErr) throw pErr;
      }
      return { jobId: input.jobId };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["job", workspaceId, res.jobId] });
      qc.invalidateQueries({
        queryKey: ["repair-parts", workspaceId, res.jobId],
      });
    },
  });
}
