import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ZH } from "./dict.zh";
import { MS } from "./dict.ms";
import { ID } from "./dict.id";
import { sbCore } from "@/integrations/supabase/shared-schema";
import { useAuth } from "@/lib/auth";

export type Lang = "en" | "zh" | "ms" | "id";

/** Bumped whenever the AI translation prompt/contract changes. Stored on new
 * repair_parts rows in ai_translation_version. Never mutate historical rows. */
export const TRANSLATION_VERSION = 1;

export const LANGS: { code: Lang; label: string; flag: string; native: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English", native: "English" },
  { code: "ms", flag: "🇲🇾", label: "Bahasa Melayu", native: "Bahasa Melayu" },
  { code: "id", flag: "🇮🇩", label: "Bahasa Indonesia", native: "Bahasa Indonesia" },
  { code: "zh", flag: "🇨🇳", label: "中文（简体）", native: "中文（简体）" },
];

type Dict = Record<string, string>;
const dicts: Record<Lang, Dict> = { en: {}, zh: ZH, ms: MS, id: ID };

const STORAGE_KEY = "dhx_lang";

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "zh" || v === "ms" || v === "id";
}

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  let out = str;
  for (const k in vars) out = out.replaceAll(`{${k}}`, String(vars[k]));
  return out;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void | Promise<void>;
  tr: (en: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
};

const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);
  const [needsChoice, setNeedsChoice] = useState(false);
  const reconciledFor = useRef<string | null>(null);

  // Instant-paint from localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
    setReady(true);
  }, []);

  // Reconcile with profile.settings.language once auth user is known.
  useEffect(() => {
    if (!user) {
      reconciledFor.current = null;
      return;
    }
    if (reconciledFor.current === user.id) return;
    reconciledFor.current = user.id;

    void (async () => {
      const { data: prof } = await sbCore()
        .from("profiles")
        .select("workspace_id, settings")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof) return;

      const settings = (prof.settings ?? {}) as Record<string, any>;
      const profileLang = settings.language;
      if (isLang(profileLang)) {
        applyLang(profileLang);
        return;
      }

      // Ron special-case: voiceLang starts with "zh" → default zh.
      const voice: string | undefined = settings?.assistant?.voiceLang;
      if (typeof voice === "string" && voice.toLowerCase().startsWith("zh")) {
        await writeProfileLang(user.id, "zh");
        applyLang("zh");
        return;
      }

      // Workspace default.
      let wsDefault: Lang | null = null;
      if (prof.workspace_id) {
        const { data: ws } = await sbCore()
          .from("workspaces")
          .select("settings")
          .eq("id", prof.workspace_id)
          .maybeSingle();
        const wsSettings = (ws?.settings ?? {}) as Record<string, any>;
        const d = wsSettings?.defaults?.language;
        if (isLang(d)) wsDefault = d;
      }

      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (wsDefault) {
        applyLang(wsDefault);
      } else if (!isLang(stored)) {
        setNeedsChoice(true);
      }
    })();
  }, [user?.id]);

  const applyLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, l);
    setNeedsChoice(false);
  };

  const setLang = useCallback(
    async (l: Lang) => {
      applyLang(l);
      if (user) {
        await writeProfileLang(user.id, l);
      }
    },
    [user?.id],
  );

  const tr = useCallback(
    (en: string, vars?: Record<string, string | number>) => {
      const source = String(en ?? "").trim();
      if (lang === "en") return interpolate(source, vars);
      const dict = dicts[lang];
      const found =
        dict[source] ?? dict[source.replace(/\s+/g, " ")] ?? dict[source.replace(/[:：]$/, "")];
      return interpolate(found || source, vars);
    },
    [lang],
  );

  const value = useMemo<Ctx>(() => ({ lang, setLang, tr, ready }), [lang, setLang, tr, ready]);

  return (
    <LangCtx.Provider value={value}>
      {children}
      {ready && needsChoice && (
        <LanguageModal
          onChoose={(l) => {
            void setLang(l);
          }}
        />
      )}
    </LangCtx.Provider>
  );
}

async function writeProfileLang(profileId: string, l: Lang) {
  try {
    const { data: prof } = await sbCore()
      .from("profiles")
      .select("settings")
      .eq("id", profileId)
      .maybeSingle();
    const settings = ((prof?.settings ?? {}) as Record<string, any>) || {};
    settings.language = l;
    await sbCore().from("profiles").update({ settings }).eq("id", profileId);
  } catch {
    // Non-fatal — cache still updated.
  }
}

// Legacy dotted keys → English source string.
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

export function useT() {
  const ctx = useContext(LangCtx);
  const fallback: Ctx = {
    lang: "en",
    setLang: () => {},
    tr: (s: string, v?: Record<string, string | number>) => interpolate(String(s ?? "").trim(), v),
    ready: true,
  };
  const value = ctx ?? fallback;

  const t = (key: string, vars?: Record<string, string | number>) => {
    const norm = vars && "count" in vars ? { ...vars, n: vars.count } : vars;
    const en = legacyKeyMap[key] ?? key;
    return value.tr(en, norm as Record<string, string | number> | undefined);
  };

  return { ...value, t };
}

function LanguageModal({ onChoose }: { onChoose: (l: Lang) => void }) {
  const { tr, lang } = useT();
  const [selected, setSelected] = useState<Lang>(lang);
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">DHX Body & Paint</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {tr("Choose your language")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr("Select your preferred language to continue.")}
        </p>
        <ul className="mt-5 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => setSelected(l.code)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                  selected === l.code ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {l.flag}
                </span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {selected === l.code && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
        <button
          disabled={!selected}
          onClick={() => selected && onChoose(selected)}
          className="mt-5 w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          {tr("Continue")}
        </button>
      </div>
    </div>
  );
}

export function LanguagePicker({ onClose }: { onClose: () => void }) {
  const { lang, setLang, tr } = useT();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold tracking-tight">{tr("Preferred Language")}</h2>
        <ul className="mt-4 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => {
                  void setLang(l.code);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${
                  lang === l.code ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {l.flag}
                </span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {lang === l.code && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function tStatus(
  t: (k: string, v?: Record<string, string | number>) => string,
  status: string,
): string {
  return t(status);
}

export function Translatable({
  en,
  translated: translatedProp,
  className,
  as: As = "span",
}: {
  en: string;
  /** Optional explicit translation (e.g. AI-provided) overriding the dictionary. */
  translated?: string | null;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  const { tr, lang } = useT();
  const [showOriginal, setShowOriginal] = useState(false);
  const dictTranslated = tr(en);
  const translated =
    translatedProp && translatedProp.trim().length > 0 ? translatedProp : dictTranslated;
  const isTranslated = lang !== "en" && translated !== en;
  if (!isTranslated) {
    return <As className={className}>{en}</As>;
  }
  return (
    <As
      className={`${className ?? ""} ${
        isTranslated
          ? "cursor-pointer underline decoration-dotted decoration-muted-foreground/30 underline-offset-4"
          : ""
      }`}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        setShowOriginal((v) => !v);
      }}
      title={tr(showOriginal ? "Show Translation" : "Show Original")}
    >
      {showOriginal ? en : translated}
    </As>
  );
}
