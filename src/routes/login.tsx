import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { useT, LanguagePicker } from "@/lib/i18n";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — DHX Body & Paint" }, { name: "description", content: "Sign in to DHX Body & Paint." }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { tr } = useT();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void router.navigate({ to: "/", replace: true });
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (mode === "signup") {
      setLoginMethod("email");
    }
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const signInEmail = loginMethod === "phone"
      ? `${phone.replace(/\D/g, "")}@dhx.local`
      : email.trim();

    if (!signInEmail || !password.trim()) {
      toast.error(tr("Enter email and password"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: { full_name: fullName.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success(tr("Account created. You can sign in now."));
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: signInEmail,
          password,
        });
        if (error) {
          if (
            loginMethod === "phone" &&
            error.message?.toLowerCase().includes("invalid login credentials")
          ) {
            toast.error(tr("Phone number or password is incorrect."));
          } else {
            throw error;
          }
          return;
        }
        toast.success(tr("Signed in"));
        void router.navigate({ to: "/", replace: true });
      }
    } catch (err: any) {
      toast.error(err?.message ?? tr("Sign in failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-navy text-navy-foreground px-6 pt-[max(env(safe-area-inset-top),2rem)] pb-10 rounded-b-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/60">DHX</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {mode === "signin" ? tr("Sign in") : tr("Create account")}
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {mode === "signin"
                ? tr("Welcome back. Please sign in to continue.")
                : tr("First account becomes Owner.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            aria-label={tr("Preferred Language")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
          >
            <Languages className="h-5 w-5" />
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="flex-1 px-6 py-8 space-y-4">
        {mode === "signup" && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{tr("Full name")}</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ron Tan"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
        )}
        {mode === "signin" && (
          <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                loginMethod === "email"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tr("Email")}
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("phone")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                loginMethod === "phone"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tr("Phone")}
            </button>
          </div>
        )}
        {mode === "signin" && loginMethod === "phone" ? (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{tr("Phone")}</span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+601X-XXXXXXX"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{tr("Email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
        )}
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{tr("Password")}</span>
          <input
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? tr("Please wait…") : mode === "signin" ? tr("Sign in") : tr("Create account")}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full text-center text-xs text-muted-foreground underline"
        >
          {mode === "signin" ? tr("No account? Create one") : tr("Have an account? Sign in")}
        </button>

        <p className="text-center text-[11px] text-muted-foreground">DHX · v1.0</p>
      </form>
      {langOpen && <LanguagePicker onClose={() => setLangOpen(false)} />}
    </div>
  );
}
