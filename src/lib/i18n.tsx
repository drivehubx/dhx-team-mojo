import { createContext, useContext, type ReactNode } from "react";

// The app is English-only. This file now only provides identity / interpolation helpers.

type Ctx = {
  tr: (en: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
};

const LangCtx = createContext<Ctx | null>(null);

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  let out = str;
  for (const k in vars) out = out.replaceAll(`{${k}}`, String(vars[k]));
  return out;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const tr = (en: string, vars?: Record<string, string | number>) =>
    interpolate(String(en ?? "").trim(), vars);

  return (
    <LangCtx.Provider value={{ tr, ready: true }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useT() {
  const ctx = useContext(LangCtx);
  const fallback: Ctx = {
    tr: (s: string, v?: Record<string, string | number>) => interpolate(s, v),
    ready: true,
  };
  const value = ctx ?? fallback;

  // Backwards-compat: provide `t(key)` that resolves legacy dotted keys to English copy.
  const legacyKeyMap: Record<string, string> = {
    "common.brand": "DHX Body & Paint",
    "common.viewAll": "View all",
    "common.signOut": "Sign out",
    "nav.home": "Home",
    "nav.jobs": "Jobs",
    "nav.team": "Team",
    "nav.skills": "Skills",
    "nav.learn": "Learn",
    "nav.salary": "Salary",
    "nav.advance": "Adv",
    "nav.profile": "Me",
    "page.dashboard.title": "Dashboard",
    "page.dashboard.greet": "Hi",
    "page.dashboard.todayJobs": "Today's jobs",
    "page.dashboard.recent": "Recent activity",
    "page.dashboard.activeWorkers": "Active Team Members",
    "page.dashboard.todayJobsKpi": "Today's Jobs",
    "page.dashboard.outstandingSalary": "Outstanding Salary",
    "page.dashboard.employeeAdvances": "Team Member Advances",
    "page.jobs.title": "Jobs",
    "page.jobs.subtitle": "{n} jobs shown",
    "page.team.title": "Team",
    "page.skills.title": "Skills",
    "page.learning.title": "Learn",
    "page.salary.title": "Salary",
    "page.advance.title": "Advance",
    "page.profile.title": "Profile",
    "page.profile.account": "Account",
    "page.profile.thisMonth": "This month",
    "page.profile.salary": "Salary",
    "page.profile.ot": "OT hrs",
    "page.profile.advance": "Advance",
    "page.profile.phone": "Phone",
    "page.profile.documents": "Documents",
    "page.profile.settings": "Settings",
    "page.profile.preferredLanguage": "Preferred Language",
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const norm = vars && "count" in vars ? { ...vars, n: vars.count } : vars;
    const en = legacyKeyMap[key] ?? key;
    return value.tr(en, norm as Record<string, string | number> | undefined);
  };

  return { ...value, t };
}
