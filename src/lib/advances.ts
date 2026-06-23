import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sbCore,
  sbWorkshop,
  type WorkshopAdvance,
  type CoreProfile,
  type AdvanceStatus,
} from "@/integrations/supabase/shared-schema";

export type AdvanceWithProfile = WorkshopAdvance & {
  profile?: Pick<CoreProfile, "id" | "full_name" | "avatar_url"> | null;
};

export function useAdvances(workspaceId: string | null, opts: { mineOnly?: boolean; userId?: string }) {
  return useQuery({
    queryKey: ["advances", workspaceId, opts.mineOnly ? `mine:${opts.userId}` : "all"],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = sbWorkshop()
        .from("advances")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (opts.mineOnly && opts.userId) q = q.eq("profile_id", opts.userId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as WorkshopAdvance[];
      const ids = Array.from(new Set(rows.map((r) => r.profile_id)));
      if (ids.length === 0) return [] as AdvanceWithProfile[];
      const { data: profs } = await sbCore()
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: (map.get(r.profile_id) as any) ?? null })) as AdvanceWithProfile[];
    },
  });
}

export function useRequestAdvance(workspaceId: string | null, userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason?: string }) => {
      if (!workspaceId || !userId) throw new Error("Workspace not ready");
      const { data, error } = await sbWorkshop()
        .from("advances")
        .insert({
          workspace_id: workspaceId,
          profile_id: userId,
          amount,
          reason: reason || null,
          status: "pending" as AdvanceStatus,
        })
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopAdvance;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advances", workspaceId] }),
  });
}

export function useDecideAdvance(workspaceId: string | null, reviewerId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      const { data, error } = await sbWorkshop()
        .from("advances")
        .update({
          status: decision,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId,
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkshopAdvance;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["advances", workspaceId] }),
  });
}
