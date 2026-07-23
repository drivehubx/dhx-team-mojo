import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sbCore } from "@/integrations/supabase/shared-schema";
import type {
  AppRole,
  CoreEngagementType,
  CorePosition,
  TeamDirectoryRow,
} from "@/integrations/supabase/shared-schema";

export function useTeamDirectory() {
  return useQuery({
    queryKey: ["team-directory"],
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("team_directory")
        .select("*")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamDirectoryRow[];
    },
  });
}

export function useTeamMember(id: string | null) {
  return useQuery({
    queryKey: ["team-directory", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("team_directory")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as TeamDirectoryRow | null;
    },
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["core", "positions"],
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("positions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CorePosition[];
    },
  });
}

export function useEngagementTypes() {
  return useQuery({
    queryKey: ["core", "engagement_types"],
    queryFn: async () => {
      const { data, error } = await sbCore()
        .from("engagement_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CoreEngagementType[];
    },
  });
}

function useInvalidateMember() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.invalidateQueries({ queryKey: ["team-directory"] });
    qc.invalidateQueries({ queryKey: ["team-directory", id] });
  };
}

export function useSetMemberRole() {
  const invalidate = useInvalidateMember();
  return useMutation({
    mutationFn: async (vars: { profileId: string; role: AppRole }) => {
      const { error } = await sbCore().rpc("set_member_role", {
        p_profile_id: vars.profileId,
        p_role: vars.role,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.profileId),
  });
}

export function useSetMemberPositions() {
  const invalidate = useInvalidateMember();
  return useMutation({
    mutationFn: async (vars: { profileId: string; positionIds: string[] }) => {
      const { error } = await sbCore().rpc("set_member_positions", {
        p_profile_id: vars.profileId,
        p_position_ids: vars.positionIds,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.profileId),
  });
}

export function useSetMemberEngagement() {
  const invalidate = useInvalidateMember();
  return useMutation({
    mutationFn: async (vars: { profileId: string; engagementTypeId: string | null }) => {
      const { error } = await sbCore().rpc("set_member_engagement", {
        p_profile_id: vars.profileId,
        p_engagement_type_id: vars.engagementTypeId,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.profileId),
  });
}

export function useSetMemberActive() {
  const invalidate = useInvalidateMember();
  return useMutation({
    mutationFn: async (vars: { profileId: string; active: boolean }) => {
      const { error } = await sbCore().rpc("set_member_active", {
        p_profile_id: vars.profileId,
        p_active: vars.active,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => invalidate(v.profileId),
  });
}

export function displayRole(role: AppRole | null | undefined): string {
  if (!role) return "Team Member";
  switch (role) {
    case "owner":
      return "Owner";
    case "administrator":
      return "Administrator";
    case "manager":
      return "Manager";
    case "supervisor":
      return "Supervisor";
    case "member":
    case "worker":
    case "crew":
      return "Team Member";
  }
}

// Owner is intentionally omitted — the database rejects granting owner and
// an owner's own role cannot be reassigned here. `displayRole` still renders
// "Owner" for the badge when a team member already holds that role.
export const SYSTEM_ROLE_OPTIONS: Array<{ value: AppRole; label: string; hint: string }> = [
  { value: "administrator", label: "Administrator", hint: "Manage team, jobs, settings" },
  { value: "manager", label: "Manager", hint: "Manage team and jobs" },
  { value: "supervisor", label: "Supervisor", hint: "Oversee jobs, read-only on team" },
  { value: "member", label: "Team Member", hint: "Standard access" },
];
