import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sbCore } from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/activate")({
  head: () => ({
    meta: [{ title: "Activate account — DHX Body & Paint" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ActivatePage,
});

type Invitation = {
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
};

function ActivatePage() {
  const { token } = Route.useSearch();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoadError("Invalid or expired link");
        setLoading(false);
        return;
      }
      const { data, error } = await sbCore()
        .rpc("get_invitation_by_token", { p_token: token });
      if (cancelled) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row) {
        setLoadError("Invalid or expired link");
      } else {
        const inv = row as Invitation;
        setInvitation(inv);
        setMethod(inv.phone ? "phone" : "email");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match.");
      return;
    }
    if (!invitation) return;

    setSubmitting(true);
    try {
      let signupEmail: string;
      if (method === "phone") {
        if (!invitation.phone) throw new Error("No phone on invitation");
        const digits = invitation.phone.replace(/\D/g, "");
        signupEmail = `${digits}@dhx.local`;
      } else {
        if (!invitation.email) throw new Error("No email on invitation");
        signupEmail = invitation.email;
      }

      // Call edge function — handles user creation + profile/role setup server-side
      const res = await fetch(
        "https://geykkgepjqelqbkbkuvk.supabase.co/functions/v1/activate-account",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email: signupEmail, password }),
        }
      );
      const result = await res.json();

      if (!res.ok) {
        if (result.error === "already_activated") {
          // Account exists and is activated — just sign in
        } else {
          throw new Error(result.error ?? "Activation failed");
        }
      }

      // Sign in to establish session
      const { error: siErr } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password,
      });
      if (siErr) throw new Error("Account set up. Please go to login and sign in with your phone and password.");

      void router.navigate({ to: "/", replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Activation failed");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Invalid or expired link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This activation link is not valid. Please ask your manager for a new invite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.status === "activated") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Already activated</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This account has already been activated. Please log in.
            </p>
            <Button asChild className="w-full">
              <Link to="/login">Go to login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Invitation unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This invitation is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasEmail = !!invitation.email;
  const hasPhone = !!invitation.phone;

  const form = (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Password</Label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          placeholder="At least 8 characters"
        />
      </div>
      <div className="space-y-2">
        <Label>Confirm Password</Label>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
        />
      </div>
      {submitError && (
        <p className="text-sm text-destructive">{submitError}</p>
      )}
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Activate Account
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-sm w-full">
        <CardHeader>
          <CardTitle>Hi, {invitation.full_name}!</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set a password to activate your account.
          </p>
        </CardHeader>
        <CardContent>
          {hasEmail && hasPhone ? (
            <Tabs value={method} onValueChange={(v) => setMethod(v as "phone" | "email")}>
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="phone">Phone</TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              <TabsContent value="phone" className="space-y-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={invitation.phone ?? ""} disabled />
                </div>
                {method === "phone" && form}
              </TabsContent>
              <TabsContent value="email" className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={invitation.email ?? ""} disabled />
                </div>
                {method === "email" && form}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{hasPhone ? "Phone" : "Email"}</Label>
                <Input
                  value={(hasPhone ? invitation.phone : invitation.email) ?? ""}
                  disabled
                />
              </div>
              {form}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
