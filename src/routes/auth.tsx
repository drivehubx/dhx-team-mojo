import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { UI } from "@/lib/i18n";
import { User2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DHX Team Ops" },
      { name: "description", content: "Create your DHX Team Ops account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { lang, setUser } = useI18n();
  const labels = UI[lang ?? "en"];
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Owner" | "Manager" | "Worker">("Worker");
  const [phone, setPhone] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim().slice(0, 60);
    if (!clean) return;
    setUser({ name: clean, role, phone: phone.trim().slice(0, 24) || undefined });
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-10 flex flex-col">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
        <User2 className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold">{labels.register}</h1>
      <p className="mt-1 text-sm text-muted-foreground">DHX Team Ops</p>

      <form onSubmit={submit} className="mt-8 space-y-4 flex-1">
        <Field label={labels.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
            autoFocus
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label={labels.role}>
          <div className="grid grid-cols-3 gap-2">
            {(["Owner", "Manager", "Worker"] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-2xl border px-3 py-3 text-xs font-semibold transition-colors ${
                  role === r
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {labels[r.toLowerCase() as "owner" | "manager" | "worker"]}
              </button>
            ))}
          </div>
        </Field>

        <Field label={labels.phone}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={24}
            inputMode="tel"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-[--color-navy] px-4 py-4 text-sm font-semibold text-white shadow-lg active:scale-[0.99]"
        >
          {labels.signIn}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
