import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "manager" | "worker";

export type AuthProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  initials: string;
  role: string; // job title label
  is_active: boolean;
};

type AuthState = {
  loading: boolean;
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  roles: AppRole[];
  isOwner: boolean;
  isManager: boolean;
  isWorker: boolean;
  isStaff: boolean; // manager OR owner
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [p, r] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p.data as AuthProfile) ?? null);
    setRoles(((r.data ?? []) as { role: AppRole }[]).map((x) => x.role));
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // defer DB call to avoid lock
        setTimeout(() => loadUserData(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadUserData(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const isOwner = roles.includes("owner");
    const isManager = roles.includes("manager");
    const isWorker = roles.includes("worker");
    return {
      loading,
      user,
      session,
      profile,
      roles,
      isOwner,
      isManager,
      isWorker,
      isStaff: isOwner || isManager,
      refresh,
      signOut: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [loading, user, session, profile, roles]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
