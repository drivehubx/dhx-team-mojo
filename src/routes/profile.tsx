import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { currentUser, salaries, fmtMYR, netSalary, advanceBalance } from "@/lib/mock-data";
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
} from "lucide-react";
import { toast } from "sonner";
import { useT, LANGS, LanguagePicker } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DHX Team Ops" },
      { name: "description", content: "Your profile and personal workshop stats." },
    ],
  }),
  component: ProfilePage,
});

const PHONE_KEY = "dhx:profile:phone";

function ProfilePage() {
  const { t, tr, lang } = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [phone, setPhone] = useState(currentUser.phone);

  useEffect(() => {
    const stored = localStorage.getItem(PHONE_KEY);
    if (stored) setPhone(stored);
  }, []);

  const savePhone = (next: string) => {
    setPhone(next);
    localStorage.setItem(PHONE_KEY, next);
    setPhoneOpen(false);
    toast.success(tr("Phone updated"));
  };

  const mySalary = salaries.find((s) => s.employeeId === currentUser.id);
  const myAdvance = advanceBalance(currentUser.id);
  const activeLang = LANGS.find((l) => l.code === lang)!;

  return (
    <div>
      <AppHeader title={t("page.profile.title")} />

      <div className="px-5 -mt-4">
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
            {currentUser.initials}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">{tr(currentUser.role)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <IdCard className="h-3 w-3" /> EMP-{currentUser.id.toUpperCase()}
            </p>
          </div>
        </div>
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
          <button onClick={() => setPhoneOpen(true)} className="w-full text-left">
            <Row icon={Phone} label={t("page.profile.phone")} value={phone} />
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
      {phoneOpen && <PhoneEditor current={phone} onClose={() => setPhoneOpen(false)} onSave={savePhone} />}
      {docsOpen && <DocsModal onClose={() => setDocsOpen(false)} />}
    </div>
  );
}

function PhoneEditor({
  current,
  onClose,
  onSave,
}: {
  current: string;
  onClose: () => void;
  onSave: (v: string) => void;
}) {
  const { tr } = useT();
  const [value, setValue] = useState(current);
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
          <h2 className="text-lg font-semibold tracking-tight">{tr("Edit Phone")}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Phone")}</span>
          <input
            type="tel"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold"
          >
            {tr("Cancel")}
          </button>
          <button
            onClick={() => onSave(value.trim())}
            disabled={!value.trim()}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {tr("Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocsModal({ onClose }: { onClose: () => void }) {
  const { tr } = useT();
  // Names of files intentionally untranslated.
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
            <li
              key={f.name}
              className="flex items-center gap-3 rounded-2xl border border-border p-3"
            >
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
