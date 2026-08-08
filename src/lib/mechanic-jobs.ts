import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ *
 * Hand-written row types.
 * The generated types.ts does not know about these public tables yet,
 * so we cast at the query boundary (same spirit as shared-schema.ts).
 * ------------------------------------------------------------------ */

export type MechanicJobStatus =
  | "checking"
  | "repairing"
  | "waiting_parts"
  | "completed";

export const MECHANIC_JOB_STATUSES: MechanicJobStatus[] = [
  "checking",
  "repairing",
  "waiting_parts",
  "completed",
];

export const MECHANIC_JOB_STATUS_LABELS: Record<MechanicJobStatus, string> = {
  checking: "Checking",
  repairing: "Repairing",
  waiting_parts: "Waiting Parts",
  completed: "Completed",
};

export type MechanicWorkerType = "mechanic" | "helper";

export type MechanicTeamMember = {
  id: string;
  name: string;
  role: MechanicWorkerType;
  phone: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MechanicJob = {
  id: string;
  job_no: number;
  job_date: string;
  vehicle_external_id: string | null;
  registration_number: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  location: string | null;
  work_description: string;
  status: MechanicJobStatus;
  start_time: string | null;
  completed_time: string | null;
  labour_amount: number;
  parts_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MechanicJobWorker = {
  job_id: string;
  team_member_id: string;
  worker_type: MechanicWorkerType;
  created_at: string;
};

export type MechanicJobWithWorkers = MechanicJob & {
  mechanic: MechanicTeamMember | null;
  helper: MechanicTeamMember | null;
};

const sb = () => supabase as any;

/* ------------------------------- reads ---------------------------- */

export function useMechanicTeamMembers() {
  return useQuery({
    queryKey: ["mechanic-team-members"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("mechanic_team_members")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as MechanicTeamMember[];
    },
  });
}

async function hydrate(jobs: MechanicJob[]): Promise<MechanicJobWithWorkers[]> {
  if (jobs.length === 0) return [];
  const ids = jobs.map((j) => j.id);
  const { data: links, error: linkErr } = await sb()
    .from("mechanic_job_workers")
    .select("*")
    .in("job_id", ids);
  if (linkErr) throw linkErr;
  const workerLinks = (links ?? []) as MechanicJobWorker[];

  const memberIds = Array.from(new Set(workerLinks.map((w) => w.team_member_id)));
  let members: MechanicTeamMember[] = [];
  if (memberIds.length > 0) {
    const { data: mem, error: memErr } = await sb()
      .from("mechanic_team_members")
      .select("*")
      .in("id", memberIds);
    if (memErr) throw memErr;
    members = (mem ?? []) as MechanicTeamMember[];
  }
  const byId = new Map(members.map((m) => [m.id, m]));

  return jobs.map((job) => {
    const links = workerLinks.filter((w) => w.job_id === job.id);
    const mechLink = links.find((w) => w.worker_type === "mechanic");
    const helpLink = links.find((w) => w.worker_type === "helper");
    return {
      ...job,
      mechanic: mechLink ? byId.get(mechLink.team_member_id) ?? null : null,
      helper: helpLink ? byId.get(helpLink.team_member_id) ?? null : null,
    };
  });
}

export function useMechanicJobs() {
  return useQuery({
    queryKey: ["mechanic-jobs"],
    queryFn: async () => {
      const { data, error } = await sb()
        .from("mechanic_jobs")
        .select("*")
        .order("job_date", { ascending: false })
        .order("job_no", { ascending: false });
      if (error) throw error;
      return hydrate((data ?? []) as MechanicJob[]);
    },
  });
}

export function useMechanicJob(id: string | undefined) {
  return useQuery({
    queryKey: ["mechanic-job", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb()
        .from("mechanic_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [hydrated] = await hydrate([data as MechanicJob]);
      return hydrated ?? null;
    },
  });
}

/* ------------------------------ writes ---------------------------- */

export type MechanicJobInput = {
  job_date: string;
  vehicle: { id: string; plate_number: string; make: string | null; model: string | null };
  mechanicId: string;
  helperId: string | null;
  work_description: string;
  status: MechanicJobStatus;
  labour_amount: number;
  parts_amount: number;
  notes: string | null;
};

async function nextJobNo(): Promise<number> {
  const { data, error } = await sb()
    .from("mechanic_jobs")
    .select("job_no")
    .order("job_no", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as { job_no: number }[];
  const max = rows.length > 0 ? Number(rows[0].job_no) : 0;
  return (Number.isFinite(max) ? max : 0) + 1;
}

async function writeWorkers(jobId: string, mechanicId: string, helperId: string | null) {
  const rows: { job_id: string; team_member_id: string; worker_type: MechanicWorkerType }[] = [
    { job_id: jobId, team_member_id: mechanicId, worker_type: "mechanic" },
  ];
  if (helperId && helperId !== mechanicId) {
    rows.push({ job_id: jobId, team_member_id: helperId, worker_type: "helper" });
  }
  const { error } = await sb().from("mechanic_job_workers").insert(rows);
  if (error) throw error;
}

export function useCreateMechanicJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MechanicJobInput) => {
      const { data: authData } = await supabase.auth.getUser();
      const job_no = await nextJobNo();
      const { data, error } = await sb()
        .from("mechanic_jobs")
        .insert({
          job_no,
          job_date: input.job_date,
          vehicle_external_id: input.vehicle.id,
          registration_number: input.vehicle.plate_number,
          vehicle_make: input.vehicle.make,
          vehicle_model: input.vehicle.model,
          work_description: input.work_description,
          status: input.status,
          labour_amount: input.labour_amount,
          parts_amount: input.parts_amount,
          notes: input.notes,
          created_by: authData?.user?.id ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      const job = data as MechanicJob;
      await writeWorkers(job.id, input.mechanicId, input.helperId);
      return job;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mechanic-jobs"] });
    },
  });
}

export type MechanicJobUpdate = {
  id: string;
  job_date?: string;
  work_description?: string;
  status?: MechanicJobStatus;
  labour_amount?: number;
  parts_amount?: number;
  notes?: string | null;
  vehicle_external_id?: string | null;
  registration_number?: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
};

export function useUpdateMechanicJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: MechanicJobUpdate) => {
      const { error } = await sb().from("mechanic_jobs").update(patch).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ["mechanic-jobs"] });
      void qc.invalidateQueries({ queryKey: ["mechanic-job", id] });
    },
  });
}

export function useSetMechanicJobWorkers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { jobId: string; mechanicId: string; helperId: string | null }) => {
      const { error } = await sb()
        .from("mechanic_job_workers")
        .delete()
        .eq("job_id", args.jobId);
      if (error) throw error;
      await writeWorkers(args.jobId, args.mechanicId, args.helperId);
      return args.jobId;
    },
    onSuccess: (jobId) => {
      void qc.invalidateQueries({ queryKey: ["mechanic-jobs"] });
      void qc.invalidateQueries({ queryKey: ["mechanic-job", jobId] });
    },
  });
}

export function formatMYR(n: number) {
  return `RM ${Number(n || 0).toFixed(2)}`;
}
