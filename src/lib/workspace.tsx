import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "./auth";
import {
  sbCore,
  type AppRole,
  type CoreProfile,
} from "@/integrations/supabase/shared-schema";

export type WorkspaceStatus = "loading" | "no-auth" | "not-setup" | "ready" | "error";

export type WorkspaceState = {
  status: WorkspaceStatus;
  error: string | null;
  profile: CoreProfile | null;
  workspaceId: string | null;
  role: AppRole | null;
  isOwner: boolean;
  isManager: boolean;
  isWorker: boolean;
  isCrew: boolean;
  isStaff: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CoreProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = async (uid: string) => {
    setStatus("loading");
    setError(null);
    const { data: prof, error: profErr } = await sbCore()
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle();
    if (profErr) {
      setError(profErr.message);
      setProfile(null);
      setRole(null);
      setStatus("error");
      return;
    }
    if (!prof) {
      setProfile(null);
      setRole(null);
      setStatus("not-setup");
      return;
    }
    const { data: roleRow, error: roleErr } = await sbCore()
      .from("roles")
      .select("role")
      .eq("profile_id", uid)
      .eq("workspace_id", prof.workspace_id)
      .maybeSingle();
    if (roleErr) {
      setError(roleErr.message);
      setProfile(prof as CoreProfile);
      setRole(null);
      setStatus("error");
      return;
    }
    setProfile(prof as CoreProfile);
    setRole(((roleRow?.role as AppRole) ?? null));
    setStatus("ready");
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setRole(null);
      setStatus("no-auth");
      return;
    }
    void load(user.id);
  }, [user?.id, authLoading]);

  const value = useMemo<WorkspaceState>(() => {
    const isOwner = role === "owner";
    const isManager = role === "manager";
    const isWorker = role === "worker" || role === "crew";
    const isCrew = role === "crew" || role === "worker";
    return {
      status,
      error,
      profile,
      workspaceId: profile?.workspace_id ?? null,
      role,
      isOwner,
      isManager,
      isWorker,
      isCrew,
      isStaff: isOwner || isManager,
      refresh: async () => {
        if (user) await load(user.id);
      },
    };
  }, [status, error, profile, role, user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}

/**
 * Convenience: returns workspaceId once status==='ready', else null.
 * Components should also handle loading/not-setup states via <WorkspaceGate>.
 */
export function useWorkspaceId(): string | null {
  const { workspaceId } = useWorkspace();
  return workspaceId;
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { status, error } = useWorkspace();
  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (status === "no-auth") {
    return <Navigate to="/login" replace />;
  }
  if (status === "not-setup") {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="text-base font-semibold">Account not set up yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is not registered with a workspace yet. Please contact your
          manager to be added before you can use the app.
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h2 className="text-base font-semibold text-destructive">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }
  return <>{children}</>;
}
