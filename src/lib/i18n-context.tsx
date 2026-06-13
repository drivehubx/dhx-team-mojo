import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type Lang, UI } from "./i18n";

type SessionUser = { name: string; role: string; phone?: string };

type Ctx = {
  lang: Lang | null;
  user: SessionUser | null;
  showOriginal: boolean;
  ready: boolean;
  setLang: (l: Lang) => void;
  setUser: (u: SessionUser | null) => void;
  toggleShowOriginal: () => void;
  t: (key: keyof (typeof UI)["en"]) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

const LANG_KEY = "dhx.lang";
const USER_KEY = "dhx.user";
const ORIG_KEY = "dhx.showOriginal";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      const u = localStorage.getItem(USER_KEY);
      const o = localStorage.getItem(ORIG_KEY);
      if (l) setLangState(l);
      if (u) setUserState(JSON.parse(u));
      if (o) setShowOriginal(o === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  };
  const setUser = (u: SessionUser | null) => {
    setUserState(u);
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {}
  };
  const toggleShowOriginal = () => {
    setShowOriginal((v) => {
      const next = !v;
      try {
        localStorage.setItem(ORIG_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const t: Ctx["t"] = (key) => UI[lang ?? "en"][key] ?? UI.en[key];

  return (
    <I18nCtx.Provider
      value={{ lang, user, showOriginal, ready, setLang, setUser, toggleShowOriginal, t }}
    >
      {children}
    </I18nCtx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
