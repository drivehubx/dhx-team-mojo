import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type AdvanceRow = {
  id: string;
  employee_id: string;
  type: "borrow" | "repayment";
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  requested_by: string | null;
  approved_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type AdvanceWithProfile = AdvanceRow & {
  employee: { id: string; full_name: string; initials: string } | null;
};

const KEY = ["advances"] as const;

export function useAdvances() {
  const { user, isStaff } = useAuth();
  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: async (): Promise<AdvanceWithProfile[]> => {
      const { data, error } = await supabase
        .from("advances")
        .select("*, employee:profiles!advances_employee_id_fkey(id, full_name, initials)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdvanceWithProfile[];
    },
  });
}

export function useRequestAdvance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { amount: number; reason?: string }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("advances").insert({
        employee_id: user.id,
        type: "borrow",
        amount: input.amount,
        reason: input.reason || null,
        status: "pending",
        requested_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDecideAdvance() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { id: string; decision: "approved" | "rejected" }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("advances")
        .update({
          status: input.decision,
          approved_by: user.id,
          decided_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRecordRepayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employee_id: string; amount: number; reason?: string }) => {
      const { error } = await supabase.from("advances").insert({
        employee_id: input.employee_id,
        type: "repayment",
        amount: input.amount,
        reason: input.reason || null,
        status: "approved",
        decided_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function summarizeAdvances(list: AdvanceWithProfile[]) {
  const approvedBorrow = list.filter((a) => a.type === "borrow" && a.status === "approved");
  const repay = list.filter((a) => a.type === "repayment" && a.status === "approved");
  const totalBorrow = approvedBorrow.reduce((s, a) => s + Number(a.amount), 0);
  const totalRepay = repay.reduce((s, a) => s + Number(a.amount), 0);
  return { totalBorrow, totalRepay, outstanding: totalBorrow - totalRepay };
}

export function balanceByEmployee(list: AdvanceWithProfile[]) {
  const map = new Map<string, { name: string; initials: string; borrow: number; repay: number }>();
  for (const a of list) {
    if (a.status !== "approved") continue;
    const key = a.employee_id;
    const entry = map.get(key) ?? {
      name: a.employee?.full_name ?? "—",
      initials: a.employee?.initials ?? "??",
      borrow: 0,
      repay: 0,
    };
    if (a.type === "borrow") entry.borrow += Number(a.amount);
    else entry.repay += Number(a.amount);
    map.set(key, entry);
  }
  return Array.from(map.entries()).map(([id, v]) => ({ id, ...v, balance: v.borrow - v.repay }));
}
