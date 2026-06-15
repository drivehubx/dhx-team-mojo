import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { salaries, fmtMYR, netSalary, advanceBalance } from "@/lib/mock-data";
import {
  Phone,
  IdCard,
  FileText,
  Settings,
  ChevronRight,
  Wallet,
  Clock4,
  HandCoins,
  Languages,
  X,
  Download,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useT, LANGS, LanguagePicker } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DHX Team Ops" },
      { name: "description", content: "Your profile and personal workshop stats." },
    ],
  }),
  component: ProfilePage,
});

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
  return letters.toUpperCase() || "??";
}

function ProfilePage() {
  const { t, tr, lang } = useT();
  const { user, profile, refresh, loading } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // One-time fallback: if profile name is empty/placeholder, seed from auth metadata.
  useEffect(() => {
    if (!user || !profile || hydrated) return;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const metaName = (meta.full_name as string) || (meta.name as string) || "";
    const needsName = !profile.full_name || profile.full_name.trim() === "";
    const needsInitials = !profile.initials || profile.initials === "??";
    if (needsName || needsInitials) {
      const finalName = needsName ? (metaName || user.email?.split("@")[0] || "") : profile.full_name;
      const finalInitials = needsInitials ? deriveInitials(finalName) : profile.initials;
      if (finalName) {
        supabase
          .from("profiles")
          .update({ full_name: finalName, initials: finalInitials })
          .eq("id", user.id)
          .then(({ error }) => {
            if (!error) refresh();
          });
      }
    }
    setHydrated(true);
  }, [user, profile, hydrated, refresh]);

  const activeLang = LANGS.find((l) => l.code === lang)!;
  const mySalary = profile ? salaries.find((s) => s.employeeId === profile.id) : undefined;
  const myAdvance = profile ? advanceBalance(profile.id) : { balance: 0 };

  if (loading || !profile) {
    return (
      <div>
        <AppHeader title={t("page.profile.title")} />
        <div className="px-5">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm h-24 animate-pulse" />
        </div>
      </div>
    );
  }

  const displayName = profile.full_name || tr("Unnamed");
  const initials = profile.initials || deriveInitials(displayName);

  return (
    <div>
      <AppHeader title={t("page.profile.title")} />

      <div className="px-5">
        <button onClick={() => setEditOpen(true)} className="w-full text-left">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">{tr(profile.role)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <IdCard className="h-3 w-3" /> EMP-{profile.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </div>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("page.profile.thisMonth")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Wallet} label={t("page.profile.salary")} value={mySalary ? fmtMYR(netSalary(mySalary)) : "—"} />
          <StatCard icon={Clock4} label={t("page.profile.ot")} value={mySalary ? String(Math.round(mySalary.ot / 20)) : "0"} />
          <StatCard icon={HandCoins} label={t("page.profile.advance")} value={fmtMYR(myAdvance.balance)} />
        </div>
      </section>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("page.profile.account")}</h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <button onClick={() => setEditOpen(true)} className="w-full text-left">
            <Row icon={UserIcon} label={tr("Edit Profile")} value={displayName} />
          </button>
          <button onClick={() => setEditOpen(true)} className="w-full text-left">
            <Row icon={Phone} label={t("page.profile.phone")} value={profile.phone || tr("Not set")} />
          </button>
          <button onClick={() => setDocsOpen(true)} className="w-full text-left">
            <Row icon={FileText} label={t("page.profile.documents")} value={tr("{n} files", { n: 2 })} />
          </button>
          <button onClick={() => setPickerOpen(true)} className="w-full text-left">
            <Row
              icon={Languages}
              label={t("page.profile.preferredLanguage")}
              value={`${activeLang.flag} ${activeLang.native}`}
            />
          </button>
          <Link to="/settings">
            <Row icon={Settings} label={t("page.profile.settings")} value="" />
          </Link>
        </ul>
      </section>

      <p className="mt-6 mb-4 text-center text-[11px] text-muted-foreground">{t("common.brand")} · v1.0</p>

      {pickerOpen && <LanguagePicker onClose={() => setPickerOpen(false)} />}
      {editOpen && (
        <EditProfileModal
          fullName={profile.full_name}
          phone={profile.phone ?? ""}
          initials={profile.initials}
          userId={profile.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            refresh();
          }}
        />
      )}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
    </div>
  );
}

function EditProfileModal({
  fullName,
  phone,
  initials,
  userId,
  onClose,
  onSaved,
}: {
  fullName: string;
  phone: string;
  initials: string;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr } = useT();
  const [name, setName] = useState(fullName);
  const [ph, setPh] = useState(phone);
  const [ini, setIni] = useState(initials);
  const [saving, setSaving] = useState(false);

  // Auto-derive initials while user hasn't manually overridden
  const [iniTouched, setIniTouched] = useState(false);
  useEffect(() => {
    if (!iniTouched) setIni(deriveInitials(name));
  }, [name, iniTouched]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error(tr("Full name is required"));
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: trimmedName,
        phone: ph.trim() || null,
        initials: (ini.trim() || deriveInitials(trimmedName)).slice(0, 4).toUpperCase(),
      })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Profile updated"));
    onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{tr("Edit Profile")}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Full Name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Phone")}</span>
          <input
            type="tel"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Initials (optional)")}</span>
          <input
            value={ini}
            maxLength={4}
            onChange={(e) => {
              setIniTouched(true);
              setIni(e.target.value.toUpperCase());
            }}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary uppercase"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold"
          >
            {tr("Cancel")}
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving ? tr("Saving…") : tr("Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocsModal({ onClose }: { onClose: () => void }) {
  const { tr } = useT();
  const files = [
    { name: "IC-Copy.pdf", size: "342 KB" },
    { name: "Driving-License.pdf", size: "210 KB" },
  ];
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{tr("Documents")}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-[11px] text-muted-foreground">{f.size}</p>
              </div>
              <button
                onClick={() => toast.info(tr("Download starting"))}
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-primary"
                aria-label={tr("Download")}
              >
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-2 text-sm font-semibold tracking-tight truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 p-3.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {value && <p className="text-[11px] text-muted-foreground truncate">{value}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </li>
  );
}
