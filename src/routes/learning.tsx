import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Play,
  FileText,
  ClipboardList,
  CheckCircle2,
  Eye,
  GraduationCap,
  Youtube,
  Facebook,
  ImagePlus,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import { sbWorkshop } from "@/integrations/supabase/shared-schema";
import { useWorkspace } from "@/lib/workspace";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning — DHX Body & Paint" },
      { name: "description", content: "Internal training: videos, repair notes, SOPs." },
    ],
  }),
  component: LearningPage,
});

type ItemType = "video" | "note" | "sop";
type Source = "youtube" | "facebook" | "photo" | "doc";

type LearningItem = {
  id: string;
  workspace_id: string;
  added_by_id: string | null;
  item_type: ItemType;
  source: Source;
  title: string;
  url: string | null;
  storage_path: string | null;
  tag: string | null;
  thumbnail_url: string | null;
  duration_label: string | null;
  created_at: string;
};

type ProgressEntry = { viewed: boolean; learned: boolean };

/** Extract a YouTube video id from the common URL shapes. */
function youtubeId(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (h.endsWith("youtube.com") || h.endsWith("youtube-nocookie.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts|live|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

function isValidHttpUrl(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const FB_HOSTS = ["facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch", "fb.me"];

function isFacebookUrl(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const h = new URL(raw.trim()).hostname.replace(/^www\./, "");
    return FB_HOSTS.includes(h);
  } catch {
    return false;
  }
}

function isFacebookItem(item: LearningItem): boolean {
  return item.source === "facebook" || isFacebookUrl(item.url);
}

const FB_TRACKING_PARAMS = ["fbclid", "mibextid", "rdid", "share_url", "__cft__", "__tn__", "ref"];

/** Normalise + verify a Facebook share link. Returns null when it isn't a usable FB link. */
function verifiedFacebookUrl(raw: string | null): string | null {
  if (!isValidHttpUrl(raw) || !isFacebookUrl(raw)) return null;
  try {
    const u = new URL((raw as string).trim());
    const h = u.hostname.replace(/^www\./, "");
    if (h === "m.facebook.com" || h === "web.facebook.com" || h === "facebook.com") {
      u.hostname = "www.facebook.com";
    }
    for (const p of FB_TRACKING_PARAMS) u.searchParams.delete(p);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("__cft__")) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Best available thumbnail: explicit one, else derived from YouTube. Facebook exposes none. */
function thumbFor(item: LearningItem): string | null {
  if (isFacebookItem(item)) return null;
  if (item.thumbnail_url) return item.thumbnail_url;
  const id = youtubeId(item.url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}


function LearningPage() {
  const { tr } = useT();
  const { workspaceId, profile, isStaff } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<LearningItem[]>([]);
  const [progress, setProgress] = useState<Map<string, ProgressEntry>>(new Map());

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<ItemType>("video");

  const loadAll = async () => {
    if (!workspaceId || !profile) return;
    setLoading(true);
    try {
      const [itemsRes, progressRes] = await Promise.all([
        sbWorkshop()
          .from("learning_items")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        sbWorkshop()
          .from("learning_progress")
          .select("item_id, viewed, learned")
          .eq("workspace_id", workspaceId)
          .eq("profile_id", profile.id),
      ]);
      setItems((itemsRes.data ?? []) as LearningItem[]);
      const map = new Map<string, ProgressEntry>();
      for (const p of (progressRes.data ?? []) as Array<{
        item_id: string;
        viewed: boolean;
        learned: boolean;
      }>) {
        map.set(p.item_id, { viewed: p.viewed, learned: p.learned });
      }
      setProgress(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, profile?.id]);

  const getProg = (id: string): ProgressEntry => progress.get(id) ?? { viewed: false, learned: false };

  const toggleProgress = async (item: LearningItem, field: "viewed" | "learned") => {
    const cur = getProg(item.id);
    const next: ProgressEntry =
      field === "viewed"
        ? { viewed: !cur.viewed, learned: cur.learned }
        : { viewed: cur.viewed, learned: !cur.learned };

    // Optimistic
    setProgress((m) => {
      const nm = new Map(m);
      nm.set(item.id, next);
      return nm;
    });

    const payload =
      field === "viewed"
        ? { p_item_id: item.id, p_viewed: next.viewed, p_learned: null }
        : { p_item_id: item.id, p_viewed: null, p_learned: next.learned };

    const { error } = await sbWorkshop().rpc("upsert_learning_progress", payload);
    if (error) {
      toast.error(error.message);
      setProgress((m) => {
        const nm = new Map(m);
        nm.set(item.id, cur);
        return nm;
      });
    }
  };

  const openItem = (item: LearningItem) => {
    if (!item.url) {
      toast(tr("No link attached"));
      return;
    }
    if (!isValidHttpUrl(item.url)) {
      toast.error(tr("This link looks invalid — please edit or re-add it"));
      return;
    }
    window.open(item.url, "_blank", "noopener");
  };

  const deleteItem = async (item: LearningItem) => {
    if (!window.confirm(tr("Delete this item?"))) return;
    const { error } = await sbWorkshop().from("learning_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Deleted"));
    void loadAll();
  };

  const canDelete = (item: LearningItem) =>
    isStaff || (profile && item.added_by_id === profile.id);

  const videos = useMemo(() => items.filter((i) => i.item_type === "video"), [items]);
  const notes = useMemo(() => items.filter((i) => i.item_type === "note"), [items]);
  const sops = useMemo(() => items.filter((i) => i.item_type === "sop"), [items]);

  const completed = [...progress.values()].filter((p) => p.learned).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const openAdd = (t: ItemType) => {
    setAddTab(t);
    setAddOpen(true);
  };

  return (
    <div>
      <AppHeader title={tr("Learn")} subtitle={tr("Train, learn, level up")} />

      <div className="px-5 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{tr("My Learning Progress")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("{a} of {b} marked learned", { a: completed, b: total })}
              </p>
            </div>
            <p className="text-xl font-semibold text-primary">{pct}%</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/15">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Card>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="videos">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="videos">{tr("Videos")}</TabsTrigger>
              <TabsTrigger value="notes">{tr("Repair Notes")}</TabsTrigger>
              <TabsTrigger value="sop">{tr("SOP")}</TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-3">
              <AddBar label={tr("+ Add Video")} onClick={() => openAdd("video")} />
              {videos.length === 0 && <EmptyState />}
              {videos.map((v) => (
                <VideoCard
                  key={v.id}
                  item={v}
                  viewed={getProg(v.id).viewed}
                  learned={getProg(v.id).learned}
                  onOpen={() => openItem(v)}
                  onView={() => toggleProgress(v, "viewed")}
                  onLearn={() => toggleProgress(v, "learned")}
                  onDelete={canDelete(v) ? () => deleteItem(v) : undefined}
                />
              ))}
            </TabsContent>

            <TabsContent value="notes" className="space-y-3">
              <AddBar label={tr("+ Add Note")} onClick={() => openAdd("note")} />
              {notes.length === 0 && <EmptyState />}
              {notes.map((n) => (
                <DocCard
                  key={n.id}
                  item={n}
                  viewed={getProg(n.id).viewed}
                  learned={getProg(n.id).learned}
                  onOpen={() => openItem(n)}
                  onView={() => toggleProgress(n, "viewed")}
                  onLearn={() => toggleProgress(n, "learned")}
                  onDelete={canDelete(n) ? () => deleteItem(n) : undefined}
                />
              ))}
            </TabsContent>

            <TabsContent value="sop" className="space-y-3">
              <AddBar label={tr("+ Add SOP")} onClick={() => openAdd("sop")} />
              {sops.length === 0 && <EmptyState />}
              {sops.map((s) => (
                <DocCard
                  key={s.id}
                  item={s}
                  viewed={getProg(s.id).viewed}
                  learned={getProg(s.id).learned}
                  onOpen={() => openItem(s)}
                  onView={() => toggleProgress(s, "viewed")}
                  onLearn={() => toggleProgress(s, "learned")}
                  onDelete={canDelete(s) ? () => deleteItem(s) : undefined}
                />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        type={addTab}
        workspaceId={workspaceId}
        profileId={profile?.id ?? null}
        onAdded={() => {
          setAddOpen(false);
          void loadAll();
        }}
      />
    </div>
  );
}

function EmptyState() {
  const { tr } = useT();
  return (
    <Card className="p-6 text-center text-xs text-muted-foreground">
      {tr("No items yet — be the first to add one!")}
    </Card>
  );
}

function AddBar({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button onClick={onClick} className="w-full h-9 gap-1 text-xs">
      <Plus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  type,
  workspaceId,
  profileId,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: ItemType;
  workspaceId: string | null;
  profileId: string | null;
  onAdded: () => void;
}) {
  const { tr } = useT();
  const [source, setSource] = useState<Source>("youtube");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tag, setTag] = useState("");
  const [duration, setDuration] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset + pick default source per type
    setTitle("");
    setUrl("");
    setTag("");
    setDuration("");
    setSource(type === "video" ? "youtube" : type === "note" ? "photo" : "doc");
  }, [open, type]);

  const submit = async () => {
    if (!workspaceId || !profileId) {
      toast.error(tr("Workspace not ready"));
      return;
    }
    if (!title.trim()) {
      toast.error(tr("Title is required"));
      return;
    }
    if (type === "video" && !url.trim()) {
      toast.error(tr("URL is required"));
      return;
    }
    setSubmitting(true);
    const { error } = await sbWorkshop()
      .from("learning_items")
      .insert({
        workspace_id: workspaceId,
        added_by_id: profileId,
        item_type: type,
        source,
        title: title.trim(),
        url: url.trim() || null,
        tag: tag.trim() || null,
        duration_label: duration.trim() || null,
      });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Added"));
    onAdded();
  };

  const sourceOptions: { value: Source; label: string }[] =
    type === "video"
      ? [
          { value: "youtube", label: "YouTube" },
          { value: "facebook", label: "Facebook" },
        ]
      : type === "note"
      ? [
          { value: "photo", label: tr("Photo URL") },
          { value: "doc", label: tr("Doc") },
        ]
      : [{ value: "doc", label: tr("Doc") }];

  const titleText =
    type === "video"
      ? tr("Add Video")
      : type === "note"
      ? tr("Add Repair Note")
      : tr("Add SOP");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {sourceOptions.length > 1 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">{tr("Source")}</p>
              <div className="flex gap-1 rounded-md border border-input p-1">
                {sourceOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setSource(o.value)}
                    className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                      source === o.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{tr("Title")} *</p>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {type !== "sop" && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">
                {tr("URL")} {type === "video" ? "*" : ""}
              </p>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  type === "video" ? "https://youtube.com/..." : tr("Optional link or photo URL")
                }
              />
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted-foreground mb-1">{tr("Tag")}</p>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder={tr("e.g. Paint, Body")}
            />
          </div>

          {type === "video" && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">{tr("Duration")}</p>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="8:42"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tr("Cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? tr("Adding...") : tr("Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceBadge({ source }: { source: Source }) {
  const { tr } = useT();
  const map = {
    youtube: { icon: Youtube, label: "YouTube", c: "text-rose-400" },
    facebook: { icon: Facebook, label: "Facebook", c: "text-sky-400" },
    photo: { icon: ImagePlus, label: "Photo", c: "text-emerald-400" },
    doc: { icon: FileText, label: "Doc", c: "text-amber-400" },
  } as const;
  const { icon: Icon, label, c } = map[source];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${c}`}>
      <Icon className="h-3 w-3" />
      {tr(label)}
    </span>
  );
}

function MarkButtons({
  viewed,
  learned,
  onView,
  onLearn,
}: {
  viewed: boolean;
  learned: boolean;
  onView: () => void;
  onLearn: () => void;
}) {
  const { tr } = useT();
  return (
    <div className="mt-3 flex gap-2">
      <Button
        size="sm"
        variant={viewed ? "secondary" : "outline"}
        className="h-8 flex-1 gap-1 text-[11px]"
        onClick={onView}
      >
        <Eye className="h-3.5 w-3.5" />
        {viewed ? tr("Viewed") : tr("Mark Viewed")}
      </Button>
      <Button
        size="sm"
        variant={learned ? "default" : "outline"}
        className="h-8 flex-1 gap-1 text-[11px]"
        onClick={onLearn}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {learned ? tr("Learned") : tr("Mark Learned")}
      </Button>
    </div>
  );
}

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function VideoCard({
  item,
  viewed,
  learned,
  onOpen,
  onView,
  onLearn,
  onDelete,
}: {
  item: LearningItem;
  viewed: boolean;
  learned: boolean;
  onOpen: () => void;
  onView: () => void;
  onLearn: () => void;
  onDelete?: () => void;
}) {
  const { tr } = useT();
  const thumb = thumbFor(item);
  const valid = isValidHttpUrl(item.url);
  const isFacebook = item.source === "facebook" || /facebook\.com|fb\.watch/.test(item.url ?? "");
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (!viewed) onView();
          onOpen();
        }}
        className="relative block aspect-video w-full bg-muted active:opacity-90"
        aria-label={tr("Play")}
      >
        {thumb && !imgFailed ? (
          <img
            src={thumb}
            alt={item.title}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-primary/10 text-primary">
            {isFacebook ? <Facebook className="h-8 w-8" /> : <Youtube className="h-8 w-8" />}
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-primary">
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
        {item.duration_label && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {item.duration_label}
          </span>
        )}
      </button>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm font-semibold leading-snug">{item.title}</p>
          {onDelete && <DeleteBtn onDelete={onDelete} />}
        </div>
        {!valid ? (
          <p className="mt-1 text-[11px] font-medium text-destructive">
            {tr("Invalid or missing link")}
          </p>
        ) : isFacebook ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            {tr("Facebook videos can't preview here — opens in the Facebook app")}
          </p>
        ) : null}
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          {item.tag ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              {item.tag}
            </span>
          ) : (
            <span />
          )}
          <SourceBadge source={item.source} />
        </div>

        <MarkButtons viewed={viewed} learned={learned} onView={onView} onLearn={onLearn} />
      </div>
    </Card>
  );
}

function DocCard({
  item,
  viewed,
  learned,
  onOpen,
  onView,
  onLearn,
  onDelete,
}: {
  item: LearningItem;
  viewed: boolean;
  learned: boolean;
  onOpen: () => void;
  onView: () => void;
  onLearn: () => void;
  onDelete?: () => void;
}) {
  const { tr } = useT();
  const isPhoto = item.source === "photo" && item.thumbnail_url;
  return (
    <Card className="p-3">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => {
            if (!viewed) onView();
            onOpen();
          }}
          className="flex flex-1 gap-3 text-left active:opacity-90"
        >
          {isPhoto ? (
            <img
              src={item.thumbnail_url!}
              alt={item.title}
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {item.source === "doc" ? (
                <ClipboardList className="h-6 w-6" />
              ) : (
                <FileText className="h-6 w-6" />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{item.title}</p>
            <div className="mt-1 flex items-center gap-2">
              {item.tag && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                  {item.tag}
                </span>
              )}
              <SourceBadge source={item.source} />
            </div>
          </div>
        </button>
        {onDelete && <DeleteBtn onDelete={onDelete} />}
      </div>
      <MarkButtons viewed={viewed} learned={learned} onView={onView} onLearn={onLearn} />
    </Card>
  );
}
