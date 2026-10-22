import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  sbCore,
  sbWorkshop,
  type WorkshopAdvance,
  type CoreProfile,
  type AdvanceStatus,
} from "@/integrations/supabase/shared-schema";

export type AdvanceWithProfile = WorkshopAdvance & AdvanceExtra & {
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

// ---------------- On-behalf, payment, deductions, policy ----------------

export type AdvanceExtra = {
  created_by?: string | null;
  entry_mode?: "self" | "on_behalf";
  payment_method?: "cash" | "bank" | "duitnow" | null;
  paid_amount?: number | null;
  paid_at?: string | null;
  paid_by?: string | null;
  payment_reference?: string | null;
  s103_approval_ref?: string | null;
  is_legacy?: boolean;
  reverse_reason?: string | null;
};

export type DeductionPolicy = {
  workspace_id: string;
  cap_percent: number;
  law_version: string;
  effective_date: string | null;
  exceptions: Array<{ code: string; label: string }>;
  source_links: string[];
  last_review_date: string | null;
  reviewer_name: string | null;
  note_zh: string | null;
  note_en: string | null;
  note_ms: string | null;
  updated_at: string;
};

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["advances"] });
  qc.invalidateQueries({ queryKey: ["advance-deductions"] });
  qc.invalidateQueries({ queryKey: ["advance-events"] });
};

export function useCreateAdvanceOnBehalf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      profileId: string; amount: number; reason?: string; method?: string | null;
      paidAt?: string | null; reference?: string; s103Ref?: string;
    }) => {
      const { data, error } = await sbWorkshop().rpc("create_advance_on_behalf", {
        p_profile: p.profileId, p_amount: p.amount, p_reason: p.reason ?? null,
        p_method: p.method ?? null, p_paid_at: p.paidAt || null,
        p_reference: p.reference ?? null, p_s103_ref: p.s103Ref ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRecordAdvancePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; method: string; paidAt: string; reference?: string; s103Ref?: string }) => {
      const { error } = await sbWorkshop().rpc("record_advance_payment", {
        p_id: p.id, p_method: p.method, p_paid_at: p.paidAt,
        p_reference: p.reference ?? null, p_s103_ref: p.s103Ref ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReverseAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; reason: string }) => {
      const { error } = await sbWorkshop().rpc("reverse_advance", { p_id: p.id, p_reason: p.reason });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export type AdvanceDeduction = { id: string; advance_id: string; salary_id: string; period: string; amount: number; created_at: string };

export function useAdvanceDeductions(workspaceId: string | null, advanceIds: string[]) {
  return useQuery({
    queryKey: ["advance-deductions", workspaceId, advanceIds.slice().sort().join(",")],
    enabled: !!workspaceId && advanceIds.length > 0,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("advance_deductions").select("*").in("advance_id", advanceIds).order("period");
      if (error) throw error;
      return (data ?? []) as AdvanceDeduction[];
    },
  });
}

export function useSavePeriodDeductions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { salaryId: string; lines: Array<{ advance_id: string; amount: number }>; otherS114: number }) => {
      const { data, error } = await sbWorkshop().rpc("save_period_deductions", {
        p_salary_id: p.salaryId, p_lines: p.lines, p_other_s114: p.otherS114,
      });
      if (error) throw error;
      return data as { total: number; cap: number; wages: number; other_s114: number };
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeductionPolicy(workspaceId: string | null) {
  return useQuery({
    queryKey: ["deduction-policy", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("deduction_policy").select("*").eq("workspace_id", workspaceId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as DeductionPolicy | null;
    },
  });
}

export function useSaveDeductionPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<DeductionPolicy>) => {
      const { error } = await sbWorkshop().rpc("upsert_deduction_policy", { p });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deduction-policy"] });
      qc.invalidateQueries({ queryKey: ["advance-events"] });
    },
  });
}

export type AdvanceEvent = { id: string; advance_id: string | null; salary_id: string | null; event: string; details: any; actor_id: string | null; created_at: string };

export function useAdvanceEvents(workspaceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["advance-events", workspaceId],
    enabled: !!workspaceId && enabled,
    queryFn: async () => {
      const { data, error } = await sbWorkshop()
        .from("advance_events").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as AdvanceEvent[];
    },
  });
}
