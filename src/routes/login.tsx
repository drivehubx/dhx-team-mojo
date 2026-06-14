import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — DHX Team Ops" }, { name: "description", content: "Sign in to DHX Team Ops." }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t, tr } = useT();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim() || !pin.trim()) {
      toast.error(tr("Enter phone and PIN"));
      return;
    }

    localStorage.setItem("dhx:profile:phone", phone.trim());

    toast.success(tr("Signed in"));
    router.navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-navy text-navy-foreground px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-10 rounded-b-3xl">
        <p className="text-xs uppercase tracking-widest text-white/60">{t("common.brand")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{tr("Sign in")}</h1>
        <p className="mt-1 text-sm text-white/70">{tr("Welcome back. Please sign in to continue.")}</p>
      </div>

      <form onSubmit={submit} className="flex-1 px-6 py-8 space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Phone")}</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+60 12 345 6789"
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{tr("PIN")}</span>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            inputMode="numeric"
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary tracking-widest"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground"
        >
          {tr("Sign in")}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">{t("common.brand")} · v1.0</p>
      </form>
    </div>
  );
}
