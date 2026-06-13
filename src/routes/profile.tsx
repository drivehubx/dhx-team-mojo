import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { currentUser, salaries, fmtMYR, netSalary, advanceBalance } from "@/lib/mock-data";
import { Phone, IdCard, FileText, Settings, LogOut, ChevronRight, Wallet, Clock4, HandCoins, Languages } from "lucide-react";
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

function ProfilePage() {
  const { t, lang } = useT();
  const [pickerOpen, setPickerOpen] = useState(false);
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
            <p className="text-xs text-muted-foreground">{currentUser.role}</p>
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
          <Row icon={Phone} label={t("page.profile.phone")} value={currentUser.phone} />
          <Row icon={FileText} label={t("page.profile.documents")} value="2 files" />
          <button onClick={() => setPickerOpen(true)} className="w-full text-left">
            <Row
              icon={Languages}
              label={t("page.profile.preferredLanguage")}
              value={`${activeLang.flag} ${activeLang.native}`}
            />
          </button>
          <Row icon={Settings} label={t("page.profile.settings")} value="" />
        </ul>
      </section>

      <div className="mt-6 px-5">
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm font-semibold text-destructive">
          <LogOut className="h-4 w-4" /> {t("common.signOut")}
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">{t("common.brand")} · v1.0</p>
      </div>

      {pickerOpen && <LanguagePicker onClose={() => setPickerOpen(false)} />}
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
