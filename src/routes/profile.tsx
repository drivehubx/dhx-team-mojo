import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  Phone,
  IdCard,
  Settings,
  ChevronRight,
  X,
  User as UserIcon,
  Camera,
  ScanLine,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useT, LanguagePicker, LANGS } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useWorkspace, WorkspaceGate } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import {
  sbCore,
  type CoreIdentification,
  type CoreFile,
  type IdType,
} from "@/integrations/supabase/shared-schema";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — DHX Body & Paint" },
      { name: "description", content: "Your profile, ID documents, and settings." },
    ],
  }),
  component: () => (
    <WorkspaceGate>
      <ProfilePage />
    </WorkspaceGate>
  ),
});

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "??";
}

function ProfilePage() {
  const { t, tr, lang } = useT();
  const { user, signOut } = useAuth();
  const { profile, workspaceId, refresh, role, isStaff } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  if (!profile || !workspaceId || !user) return null;

  const displayName = profile.full_name || "Unnamed";

  return (
    <div>
      <AppHeader title={t("page.profile.title")} />

      <div className="px-5">
        <button onClick={() => setEditOpen(true)} className="w-full text-left">
          <div className="rounded-2xl bg-card border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xl font-semibold">
              {initialsOf(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{role ?? "—"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
                <IdCard className="h-3 w-3" /> EMP-{profile.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </div>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          ID Documents
        </h2>
        <IdentificationSection
          workspaceId={workspaceId}
          profileId={profile.id}
          userId={user.id}
          canEdit={isStaff}
        />
      </section>

      <section className="mt-5 px-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t("page.profile.account")}
        </h2>
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          <button onClick={() => setEditOpen(true)} className="w-full text-left">
            <Row icon={UserIcon} label={tr("Edit Profile")} value={displayName} />
          </button>
          <Row icon={Phone} label={t("page.profile.phone")} value={profile.phone || tr("Not set")} />
          <Link to="/settings">
            <Row icon={Settings} label={t("page.profile.settings")} value="" />
          </Link>
        </ul>
      </section>

      <div className="px-5 mt-6">
        <button
          onClick={() => signOut()}
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold text-destructive"
        >
          Sign out
        </button>
      </div>

      <p className="mt-6 mb-4 text-center text-[11px] text-muted-foreground">DHX Body & Paint · v1.0</p>

      {editOpen && (
        <EditProfileModal
          profileId={profile.id}
          fullName={profile.full_name}
          phone={profile.phone ?? ""}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

type IdentRow = CoreIdentification & { file?: CoreFile | null };

function IdentificationSection({
  workspaceId,
  profileId,
  userId,
  canEdit,
}: {
  workspaceId: string;
  profileId: string;
  userId: string;
  canEdit: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Record<IdType, IdentRow | null>>({ ic: null, passport: null });
  const [scanOpen, setScanOpen] = useState<IdType | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data: idents } = await sbCore()
      .from("identification")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", profileId);
    const rows = (idents ?? []) as CoreIdentification[];
    const ids = rows.map((r) => r.id);
    let fileMap = new Map<string, CoreFile>();
    if (ids.length > 0) {
      const { data: files } = await sbCore()
        .from("files")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("owner_type", "core.identification")
        .in("owner_id", ids)
        .order("created_at", { ascending: false });
      for (const f of (files ?? []) as CoreFile[]) {
        if (!fileMap.has(f.owner_id)) fileMap.set(f.owner_id, f);
      }
    }
    const next: Record<IdType, IdentRow | null> = { ic: null, passport: null };
    for (const r of rows) {
      next[r.id_type as IdType] = { ...r, file: fileMap.get(r.id) ?? null };
    }
    setItems(next);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId, profileId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(["ic", "passport"] as IdType[]).map((type) => {
        const item = items[type];
        const label = type === "ic" ? "IC" : "Passport";
        return (
          <div key={type} className="rounded-2xl border border-border bg-card p-3.5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-primary">
                <IdCard className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {item ? item.id_number : "Not on file"}
                </p>
              </div>
              {item?.file?.url && (
                <a
                  href={item.file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="overflow-hidden rounded-lg border border-border"
                >
                  <img src={item.file.url} alt={`${label} scan`} className="h-12 w-16 object-cover" />
                </a>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => setScanOpen(type)}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary/10 text-primary px-3 py-2 text-xs font-semibold"
              >
                <ScanLine className="h-3.5 w-3.5" />
                {item ? `Re-scan ${label}` : `Scan ${label}`}
              </button>
            )}
          </div>
        );
      })}

      {scanOpen && (
        <ScanModal
          workspaceId={workspaceId}
          profileId={profileId}
          userId={userId}
          idType={scanOpen}
          initial={items[scanOpen]}
          onClose={() => setScanOpen(null)}
          onSaved={() => {
            setScanOpen(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function ScanModal({
  workspaceId,
  profileId,
  userId,
  idType,
  initial,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  profileId: string;
  userId: string;
  idType: IdType;
  initial: IdentRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [idNumber, setIdNumber] = useState(initial?.id_number ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial?.file?.url ?? null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onPick = (f: File | null) => {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!idNumber.trim()) {
      toast.error("Enter the ID number");
      return;
    }
    setSaving(true);
    try {
      // 1. Upsert identification row
      const { data: idRow, error: idErr } = await sbCore()
        .from("identification")
        .upsert(
          {
            workspace_id: workspaceId,
            profile_id: profileId,
            id_type: idType,
            id_number: idNumber.trim(),
          },
          { onConflict: "profile_id,id_type" },
        )
        .select()
        .single();
      if (idErr) throw idErr;

      // 2. If a new scan was picked, upload + insert files row
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${workspaceId}/${profileId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("staff-documents")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from("staff-documents")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 5); // 5 years
        const storageUrl = signed?.signedUrl ?? path;
        const { error: fileErr } = await sbCore().from("files").insert({
          workspace_id: workspaceId,
          owner_type: "core.identification",
          owner_id: (idRow as CoreIdentification).id,
          file_type: "id_document",
          url: storageUrl,
          status: "pending",
          uploaded_by: userId,
        });
        if (fileErr) throw fileErr;
      }
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
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
          <h2 className="text-lg font-semibold tracking-tight">
            Scan {idType === "ic" ? "IC" : "Passport"}
          </h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="h-44 w-full rounded-xl object-cover border border-border"
            />
          ) : (
            <div className="h-44 w-full rounded-xl border border-dashed border-border grid place-items-center text-muted-foreground">
              <Camera className="h-8 w-8" />
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-xl bg-secondary py-3 text-sm font-semibold"
          >
            {preview ? "Choose another image" : "Capture / choose image"}
          </button>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              {idType === "ic" ? "IC Number" : "Passport Number"}
            </span>
            <input
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={idType === "ic" ? "e.g. 900101-14-1234" : "e.g. A12345678"}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !idNumber.trim()}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProfileModal({
  profileId,
  fullName,
  phone,
  onClose,
  onSaved,
}: {
  profileId: string;
  fullName: string;
  phone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(fullName);
  const [ph, setPh] = useState(phone);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Full name is required");
      return;
    }
    setSaving(true);
    const { error } = await sbCore()
      .from("profiles")
      .update({ full_name: trimmedName, phone: ph.trim() || null })
      .eq("id", profileId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
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
          <h2 className="text-lg font-semibold tracking-tight">Edit Profile</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">Full Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted-foreground">Phone</span>
          <input
            type="tel"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
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
