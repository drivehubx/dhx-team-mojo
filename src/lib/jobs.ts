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
  vehicle: Pick<CoreVehicle, "id" | "plate_number" | "make" | "model"> | null;
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
    sbCore().from("vehicles").select("id, plate_number, make, model").in("id", vIds),
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

export function useJobs(workspaceId: string | null) {
  return useQuery({
    queryKey: ["jobs", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("jobs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return hydrateJobs((data ?? []) as WorkshopJob[]);
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

export function useVehicles(workspaceId: string | null) {
  return useQuery({
    queryKey: ["vehicles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("vehicles")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("plate_number");
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
