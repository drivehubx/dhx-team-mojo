import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dhxCore, dhxWorkshop, dhxStorage } from "@/lib/dhx";
import { supabase } from "@/integrations/supabase/client";
import { upsertCustomerLane } from "@/lib/customer-vehicles";
import { isExternalWorkSource } from "@/lib/vehicle-lane";

export type BPSource =
  | "walk_in"
  | "internal_fleet"
  | "insurance"
  | "dealer"
  | "referral"
  | "rental_damage"
  | "classics"
  | "my_garage";

export const BP_SOURCE_OPTIONS: { value: BPSource; label: string }[] = [
  { value: "walk_in", label: "Walk-in" },
  { value: "internal_fleet", label: "Internal Fleet" },
  { value: "insurance", label: "Insurance" },
  { value: "dealer", label: "Dealer" },
  { value: "referral", label: "Referral" },
  { value: "rental_damage", label: "Rental Damage" },
  { value: "classics", label: "Classics" },
  { value: "my_garage", label: "My Garage" },
];

export type BPRepairStage =
  | "queued"
  | "disassembly"
  | "panel_repair"
  | "putty"
  | "primer"
  | "paint"
  | "assembly"
  | "polish"
  | "qc"
  | "completed";

export const BP_STAGES: BPRepairStage[] = [
  "queued",
  "disassembly",
  "panel_repair",
  "putty",
  "primer",
  "paint",
  "assembly",
  "polish",
  "qc",
  "completed",
];

export const BP_STAGE_LABEL: Record<BPRepairStage, string> = {
  queued: "Queued",
  disassembly: "Disassembly",
  panel_repair: "Panel Repair",
  putty: "Putty",
  primer: "Primer",
  paint: "Paint",
  assembly: "Assembly",
  polish: "Polish",
  qc: "QC",
  completed: "Completed",
};

export type BPJob = {
  id: string;
  workspace_id: string;
  vehicle_id: string | null;
  customer_vehicle_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  plate_number: string | null;
  car_make: string | null;
  car_model: string | null;
  damage_description: string | null;
  estimate_amount: number | null;
  estimate_approved: boolean;
  sell_price: number | null;
  paint_cost: number | null;
  labour_cost: number | null;
  parts_cost: number | null;
  other_cost: number | null;
  total_cost: number | null;
  profit: number | null;
  invoice_no: string | null;
  invoiced_at: string | null;
  ready_date: string | null;
  job_type: string | null;
  source: string | null;
  repair_stage: BPRepairStage;
  status: string;
  created_at: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  duplicate_status: "duplicate" | "archived_duplicate" | null;
  merged_into_job_id: string | null;
  duplicate_override_reason: string | null;
};

export type DuplicateCandidate = {
  id: string;
  status: string | null;
  repair_stage: string | null;
  plate_number: string | null;
  customer_name: string | null;
  created_at: string;
  created_by: string | null;
  photo_count: number;
  has_ai: boolean;
  match_kind: string;
};

export function roRef(id: string): string {
  return "RO-" + id.slice(0, 8).toUpperCase();
}


export type BPDocType = "before" | "after";

export type BPPhoto = {
  id: string;
  doc_type: BPDocType;
  storage_path: string;
  signedUrl: string | null;
  created_at: string;
};

// Canonical job-photo lane, shared with /jobs (src/lib/jobs.ts) and the AI
// assessment reads: bucket `job-photos`, core.files.owner_type = "workshop.jobs".
const JOB_PHOTOS_BUCKET = "job-photos";

async function signPaths(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await dhxStorage
    .from(JOB_PHOTOS_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  }
  return out;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "jpg";
}

// ---- Queries ----

export type BPListFilter = "active" | "archived" | "cancelled";

export function useBPJobs(
  workspaceId: string | null,
  filter: BPListFilter = "active",
) {
  return useQuery({
    queryKey: ["bp-jobs", workspaceId, filter],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = dhxWorkshop()
        .from("jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("job_type", "body_paint");
      if (filter === "active") {
        qb = qb.is("archived_at", null).neq("status", "cancelled");
      } else if (filter === "archived") {
        qb = qb.not("archived_at", "is", null);
      } else {
        qb = qb.eq("status", "cancelled").is("archived_at", null);
      }
      const { data, error } = await qb.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BPJob[];
    },
  });
}


export function useBPJob(workspaceId: string | null, id: string) {
  return useQuery({
    queryKey: ["bp-job", workspaceId, id],
    enabled: !!workspaceId && !!id,
    queryFn: async () => {
      const { data, error } = await dhxWorkshop()
        .from("jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as BPJob | null;
    },
  });
}

export function useBPPhotos(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["bp-photos", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async (): Promise<BPPhoto[]> => {
      const { data, error } = await dhxCore()
        .from("files")
        .select("id, doc_type, storage_path, url, created_at")
        .eq("workspace_id", workspaceId)
        .eq("owner_type", "workshop.jobs")
        .eq("owner_id", jobId)
        .in("doc_type", ["before", "after"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const paths = rows.map((r) => r.storage_path).filter(Boolean);
      const signed = await signPaths(paths);
      return rows.map((r) => ({
        id: r.id,
        doc_type: r.doc_type as BPDocType,
        storage_path: r.storage_path,
        signedUrl: r.storage_path ? signed[r.storage_path] ?? null : null,
        created_at: r.created_at,
      }));
    },
  });
}

// ---- Mutations ----

export type CreateBPJobInput = {
  customer_name: string;
  customer_phone: string;
  plate_number: string;
  car_make: string;
  car_model: string;
  source: BPSource;
  damage_description: string;
  estimate_amount?: number | null;
  before_photos: File[];
  asDraft?: boolean;
  duplicate_override_reason?: string | null;
};

async function uploadPhotos(
  workspaceId: string,
  jobId: string,
  docType: BPDocType,
  files: File[],
) {
  const { data: userRes } = await supabase.auth.getUser();
  const uploadedBy = userRes.user?.id ?? null;

  for (const file of files) {
    const uuid =
      (globalThis.crypto as any)?.randomUUID?.() ??
      Math.random().toString(36).slice(2);
    const path = `${workspaceId}/${jobId}/${docType}/${uuid}.${extOf(file.name)}`;
    const { error: upErr } = await dhxStorage
      .from(JOB_PHOTOS_BUCKET)
      .upload(path, file, { contentType: file.type || undefined });
    if (upErr) throw upErr;
    const { error: fErr } = await dhxCore().from("files").insert({
      workspace_id: workspaceId,
      owner_type: "workshop.jobs",
      owner_id: jobId,
      file_type: file.type || "image/jpeg",
      doc_type: docType,
      url: path,
      storage_path: path,
      status: "approved",
      uploaded_by: uploadedBy,
    });
    if (fErr) throw fErr;
  }
}

export function useCreateBPJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBPJobInput) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const payload: Record<string, unknown> = {
        workspace_id: workspaceId,
        customer_name: input.customer_name || null,
        customer_phone: input.customer_phone || null,
        plate_number: input.plate_number || null,
        car_make: input.car_make || null,
        car_model: input.car_model || null,
        source: input.source,
        damage_description: input.damage_description || null,
        repair_stage: "queued",
        status: input.asDraft ? "draft" : "open",
        job_type: "body_paint",
      };
      if (!input.asDraft && input.estimate_amount != null) {
        payload.estimate_amount = input.estimate_amount;
      }
      if (isExternalWorkSource(input.source)) {
        const { customer_vehicle_id } = await upsertCustomerLane({
          workspaceId,
          plate_number: input.plate_number,
          car_make: input.car_make,
          car_model: input.car_model,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
        });
        payload.customer_vehicle_id = customer_vehicle_id;
      }
      if (input.duplicate_override_reason && input.duplicate_override_reason.trim()) {
        payload.duplicate_override_reason = input.duplicate_override_reason.trim();
      }
      const { data: job, error } = await dhxWorkshop()
        .from("jobs")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      const jobRow = job as BPJob;
      if (input.before_photos.length) {
        await uploadPhotos(workspaceId, jobRow.id, "before", input.before_photos);
      }
      return jobRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] }),
  });
}

export function useUploadBPPhotos(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; docType: BPDocType; files: File[] }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      await uploadPhotos(workspaceId, input.jobId, input.docType, input.files);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-photos", workspaceId, vars.jobId] });
    },
  });
}

export type BPCosts = {
  paint_cost: number | null;
  labour_cost: number | null;
  parts_cost: number | null;
  other_cost: number | null;
  sell_price: number | null;
};

export function useUpdateBPCosts(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string } & BPCosts) => {
      const { jobId, ...costs } = input;
      const { data, error } = await dhxWorkshop()
        .from("jobs")
        .update(costs)
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;
      return data as BPJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, vars.jobId] });
    },
  });
}

export function useApproveBPQuote(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await dhxWorkshop()
        .from("jobs")
        .update({
          estimate_approved: true,
          estimate_approved_by: userRes.user?.id ?? null,
        })
        .eq("id", jobId)
        .select()
        .single();
      if (error) throw error;
      return data as BPJob;
    },
    onSuccess: (_d, jobId) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, jobId] });
    },
  });
}

export function useAdvanceBPStage(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; nextStage: BPRepairStage }) => {
      const patch: Record<string, unknown> = { repair_stage: input.nextStage };
      if (input.nextStage === "completed") patch.completed_at = new Date().toISOString();
      const { data, error } = await dhxWorkshop()
        .from("jobs")
        .update(patch)
        .eq("id", input.jobId)
        .select()
        .single();
      if (error) throw error;
      return data as BPJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, vars.jobId] });
    },
  });
}

export function useCreateBPInvoice(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; ready_date: string | null }) => {
      const invoiceNo = "INV-" + input.jobId.slice(0, 8).toUpperCase();
      const { data, error } = await dhxWorkshop()
        .from("jobs")
        .update({
          invoice_no: invoiceNo,
          invoiced_at: new Date().toISOString(),
          ready_date: input.ready_date,
        })
        .eq("id", input.jobId)
        .select()
        .single();
      if (error) throw error;
      return data as BPJob;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, vars.jobId] });
    },
  });
}

// ---- Owner data-maintenance ----

export function useJobDeleteBlockReason(workspaceId: string | null, jobId: string) {
  return useQuery({
    queryKey: ["bp-job-delete-block", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await dhxWorkshop().rpc("job_delete_block_reason", {
        p_job_id: jobId,
      });
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}

export function useArchiveBPJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; reason: string }) => {
      const { error } = await dhxWorkshop().rpc("archive_job", {
        p_job_id: input.jobId,
        p_reason: input.reason || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, vars.jobId] });
    },
  });
}

export function useRestoreBPJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await dhxWorkshop().rpc("restore_job", { p_job_id: jobId });
      if (error) throw error;
    },
    onSuccess: (_d, jobId) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, jobId] });
    },
  });
}

export function useHardDeleteBPJob(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { jobId: string; confirmation: string; reason: string }) => {
      const { error } = await dhxWorkshop().rpc("hard_delete_job", {
        p_job_id: input.jobId,
        p_confirmation: input.confirmation,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
    },
  });
}

export function useAdminOverride() {
  return useMutation({
    mutationFn: async (input: {
      entityType: string;
      entityId: string;
      action: string;
      reason: string;
      confirmation: string;
    }) => {
      const { error } = await dhxCore().rpc("admin_override", {
        p_entity_type: input.entityType,
        p_entity_id: input.entityId,
        p_action: input.action,
        p_reason: input.reason,
        p_confirmation: input.confirmation,
      });
      if (error) throw error;
    },
  });
}

// ---- Duplicate prevention ----

export async function findDuplicateJobs(
  vehicleId: string | null,
  plate: string | null,
): Promise<DuplicateCandidate[]> {
  const { data, error } = await dhxWorkshop().rpc("find_duplicate_jobs", {
    p_vehicle_id: vehicleId,
    p_plate: plate,
  });
  if (error) throw error;
  return (data ?? []) as DuplicateCandidate[];
}

export function useFindDuplicateJobs(
  workspaceId: string | null,
  vehicleId: string | null,
  plate: string | null,
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ["bp-find-duplicates", workspaceId, vehicleId, plate],
    enabled: !!workspaceId && (opts.enabled ?? true) && !!(vehicleId || (plate && plate.trim())),
    queryFn: () => findDuplicateJobs(vehicleId, plate),
  });
}

export function useMarkJobDuplicate(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      retainedJobId: string;
      reason: string;
    }) => {
      const { error } = await dhxWorkshop().rpc("mark_job_duplicate", {
        p_job_id: input.jobId,
        p_retained_job_id: input.retainedJobId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["bp-jobs", workspaceId] });
      qc.invalidateQueries({ queryKey: ["bp-job", workspaceId, vars.jobId] });
    },
  });
}
