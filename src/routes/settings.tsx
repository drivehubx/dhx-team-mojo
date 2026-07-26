import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Languages,
  Camera,
  ShieldCheck,
  ListChecks,
  FileSignature,
} from "lucide-react";
import { toast } from "sonner";
import { useT, LanguagePicker, LANGS, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { sbCore } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — DHX Body & Paint" },
      { name: "description", content: "Personal preferences and workshop settings." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <SettingsPage />
    </WorkspaceGate>
  ),
});

type PartsMode = "photo_first" | "manual" | "both";
type AiSettings = {
  partsDetection: boolean;
  humanApproval: boolean;
  partsMode: PartsMode;
  quotationApproval: boolean;
};
const DEFAULT_AI: AiSettings = {
  partsDetection: true,
  humanApproval: true,
  partsMode: "photo_first",
  quotationApproval: true,
};

function SettingsPage() {
  const router = useRouter();
  const { tr, lang } = useT();
  const { user } = useAuth();
  const { workspaceId, isAdmin } = useWorkspace();
  const [personalLangOpen, setPersonalLangOpen] = useState(false);
  const currentLang = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div>
      <header className="sticky top-0 z-40 bg-navy text-navy-foreground pb-5 pt-[max(env(safe-area-inset-top),1rem)] px-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.history.back()}
            aria-label={tr("Back")}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">DHX Body & Paint</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{tr("Settings")}</h1>
          </div>
        </div>
      </header>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {tr("Personal")}
        </h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <button onClick={() => setPersonalLangOpen(true)} className="w-full text-left">
            <SettingRow
              icon={Languages}
              label={tr("Preferred Language")}
              value={currentLang.native}
            />
          </button>
        </ul>
      </section>

      {isAdmin && workspaceId && user && (
        <WorkspaceSection workspaceId={workspaceId} actorId={user.id} />
      )}

      <p className="mt-8 mb-4 text-center text-[11px] text-muted-foreground">
        DHX Body & Paint · v1.0
      </p>

      {personalLangOpen && <LanguagePicker onClose={() => setPersonalLangOpen(false)} />}
    </div>
  );
}

function WorkspaceSection({ workspaceId, actorId }: { workspaceId: string; actorId: string }) {
  const { tr } = useT();
  const [loaded, setLoaded] = useState(false);
  const [defaultLang, setDefaultLang] = useState<Lang>("en");
  const [ai, setAi] = useState<AiSettings>(DEFAULT_AI);
  const [rawSettings, setRawSettings] = useState<Record<string, any>>({});
  const [defaultLangPickerOpen, setDefaultLangPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await sbCore()
        .from("workspaces")
        .select("settings")
        .eq("id", workspaceId)
        .maybeSingle();
      const s = ((data?.settings ?? {}) as Record<string, any>) || {};
      setRawSettings(s);
      const dl = s?.defaults?.language;
      if (dl === "en" || dl === "zh" || dl === "ms" || dl === "id") setDefaultLang(dl);
      const cur = (s?.ai ?? {}) as Partial<AiSettings>;
      setAi({ ...DEFAULT_AI, ...cur });
      setLoaded(true);
    })();
  }, [workspaceId]);

  const persist = async (
    next: { defaultLang?: Lang; ai?: AiSettings },
    changed: Record<string, [any, any]>,
  ) => {
    setSaving(true);
    try {
      // Re-fetch current settings to merge safely (never overwrite siblings).
      const { data: fresh } = await sbCore()
        .from("workspaces")
        .select("settings")
        .eq("id", workspaceId)
        .maybeSingle();
      const current = ((fresh?.settings ?? {}) as Record<string, any>) || {};
      const merged: Record<string, any> = { ...current };
      if (next.defaultLang) {
        merged.defaults = { ...(current.defaults ?? {}), language: next.defaultLang };
      }
      if (next.ai) {
        merged.ai = { ...(current.ai ?? {}), ...next.ai };
      }
      const { error } = await sbCore()
        .from("workspaces")
        .update({ settings: merged })
        .eq("id", workspaceId);
      if (error) throw error;
      setRawSettings(merged);

      await sbCore().from("audit").insert({
        workspace_id: workspaceId,
        actor_profile_id: actorId,
        action: "workspace_settings_changed",
        entity_type: "workspace",
        entity_id: workspaceId,
        metadata: { changed },
      });
      toast.success(tr("Saved"));
    } catch (e: any) {
      toast.error(e?.message ?? tr("Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const changeDefaultLang = async (l: Lang) => {
    if (l === defaultLang) return;
    const prev = defaultLang;
    setDefaultLang(l);
    await persist({ defaultLang: l }, { "defaults.language": [prev, l] });
  };

  const updateAi = async (patch: Partial<AiSettings>, changed: Record<string, [any, any]>) => {
    const next = { ...ai, ...patch };
    setAi(next);
    await persist({ ai: next }, changed);
  };

  const defaultLangLabel =
    LANGS.find((l) => l.code === defaultLang)?.native ?? defaultLang;

  return (
    <section className="mt-5 px-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {tr("Workshop")}
      </h2>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {tr("These settings apply to everyone in this workshop.")}
      </p>

      <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
        <button
          onClick={() => setDefaultLangPickerOpen(true)}
          disabled={!loaded || saving}
          className="w-full text-left disabled:opacity-60"
        >
          <SettingRow
            icon={Languages}
            label={tr("Default language for new users")}
            value={defaultLangLabel}
          />
        </button>

        <ToggleRow
          icon={Camera}
          label={tr("AI Parts Detection")}
          hint={tr("Scan photos to suggest parts.")}
          checked={ai.partsDetection}
          disabled={!loaded || saving}
          onChange={(v) =>
            updateAi({ partsDetection: v }, { "ai.partsDetection": [ai.partsDetection, v] })
          }
        />

        <div className="flex items-center gap-3 p-3.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {tr("Human approval required")} — {tr("Always on for AI suggestions")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {tr("AI suggestions must always be confirmed by a person. This cannot be turned off.")}
            </p>
          </div>
        </div>


        <ChoiceRow
          icon={ListChecks}
          label={tr("Parts Request mode")}
          value={ai.partsMode}
          disabled={!loaded || saving}
          options={[
            { value: "photo_first", label: tr("Photo First") },
            { value: "manual", label: tr("Manual") },
            { value: "both", label: tr("Both") },
          ]}
          onChange={(v) =>
            updateAi(
              { partsMode: v as PartsMode },
              { "ai.partsMode": [ai.partsMode, v] },
            )
          }
        />

        <ToggleRow
          icon={FileSignature}
          label={tr("Quotation revision approval required")}
          hint={tr("Revised quotes must be re-approved.")}
          checked={ai.quotationApproval}
          disabled={!loaded || saving}
          onChange={(v) =>
            updateAi(
              { quotationApproval: v },
              { "ai.quotationApproval": [ai.quotationApproval, v] },
            )
          }
        />
      </ul>

      {defaultLangPickerOpen && (
        <DefaultLanguagePicker
          value={defaultLang}
          onClose={() => setDefaultLangPickerOpen(false)}
          onChoose={(l) => {
            setDefaultLangPickerOpen(false);
            void changeDefaultLang(l);
          }}
        />
      )}
      {/* Suppress unused warning for rawSettings which is retained for future merges. */}
      <span className="hidden" aria-hidden>
        {Object.keys(rawSettings).length}
      </span>
    </section>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Languages;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
      </div>
      {value && (
        <span className="text-xs text-muted-foreground truncate max-w-[45%] text-right">
          {value}
        </span>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  icon: typeof Languages;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function ChoiceRow({
  icon: Icon,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  icon: typeof Languages;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`rounded-xl border px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DefaultLanguagePicker({
  value,
  onClose,
  onChoose,
}: {
  value: Lang;
  onClose: () => void;
  onChoose: (l: Lang) => void;
}) {
  const { tr } = useT();
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold tracking-tight">
          {tr("Default language for new users")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr("Applied when a team member has not chosen a language yet.")}
        </p>
        <ul className="mt-4 space-y-2">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                onClick={() => onChoose(l.code)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${
                  value === l.code ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {l.flag}
                </span>
                <span className="flex-1 text-sm font-medium">{l.native}</span>
                {value === l.code && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
