import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
} from "lucide-react";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Learning — DHX Team Ops" },
      { name: "description", content: "Internal training: videos, repair notes, SOPs." },
    ],
  }),
  component: LearningPage,
});

type Source = "youtube" | "facebook" | "photo" | "doc";

type Item = {
  id: string;
  title: string;
  by: string;
  duration?: string;
  source: Source;
  url?: string;
  thumb?: string;
  tag?: string;
};

const videos: Item[] = [
  {
    id: "v1",
    title: "Dent Pulling Basics — Front Fender",
    by: "Suresh K.",
    duration: "8:42",
    source: "youtube",
    thumb: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=600&q=70",
    tag: "Body",
  },
  {
    id: "v2",
    title: "Spray Gun Setup & Pressure Tuning",
    by: "Hafiz R.",
    duration: "12:05",
    source: "youtube",
    thumb: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=70",
    tag: "Paint",
  },
  {
    id: "v3",
    title: "Live: Bumper Respray Walkthrough",
    by: "Aiman Y.",
    duration: "LIVE",
    source: "facebook",
    thumb: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=600&q=70",
    tag: "Paint",
  },
];

const notes: Item[] = [
  {
    id: "n1",
    title: "Civic 2019 — Bumper Clip Locations",
    by: "Workshop notes",
    source: "photo",
    thumb: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=70",
    tag: "Reference",
  },
  {
    id: "n2",
    title: "Mixing Ratios — 2K Clear Coat",
    by: "Hafiz R.",
    source: "doc",
    tag: "Paint",
  },
  {
    id: "n3",
    title: "Common BMW 3-series Realignment Tips",
    by: "Suresh K.",
    source: "doc",
    tag: "Body",
  },
];

const sops: Item[] = [
  { id: "s1", title: "SOP-01 Vehicle Intake Checklist", by: "Owner", source: "doc", tag: "Intake" },
  { id: "s2", title: "SOP-02 Panel Beating Safety", by: "Owner", source: "doc", tag: "Safety" },
  { id: "s3", title: "SOP-03 Paint Booth Operation", by: "Owner", source: "doc", tag: "Paint" },
  { id: "s4", title: "SOP-04 QC Final Inspection", by: "Owner", source: "doc", tag: "QC" },
  { id: "s5", title: "SOP-05 Customer Handover", by: "Owner", source: "doc", tag: "Delivery" },
];

function LearningPage() {
  const { tr } = useT();
  const [viewed, setViewed] = useState<Record<string, boolean>>({ v2: true });
  const [learned, setLearned] = useState<Record<string, boolean>>({ s1: true });

  const totalItems = videos.length + notes.length + sops.length;
  const completed = Object.values(learned).filter(Boolean).length;
  const progress = Math.round((completed / totalItems) * 100);

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
    id: string,
  ) => setter((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div>
      <AppHeader title={tr("Learn")} subtitle={tr("Train, learn, level up")} />

      <div className="px-5 -mt-4 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{tr("My Learning Progress")}</p>
              <p className="text-xs text-muted-foreground">
                {tr("{a} of {b} marked learned", { a: completed, b: totalItems })}
              </p>
            </div>
            <p className="text-xl font-semibold text-primary">{progress}%</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/15">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </Card>

        <Tabs defaultValue="videos">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="videos">{tr("Videos")}</TabsTrigger>
            <TabsTrigger value="notes">{tr("Repair Notes")}</TabsTrigger>
            <TabsTrigger value="sop">{tr("SOP")}</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="space-y-3">
            <UploadRow
              hint={tr("Paste YouTube or Facebook link")}
              actions={[
                { icon: Youtube, label: tr("YouTube") },
                { icon: Facebook, label: tr("Facebook") },
              ]}
            />
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                item={v}
                viewed={!!viewed[v.id]}
                learned={!!learned[v.id]}
                onView={() => toggle(setViewed, v.id)}
                onLearn={() => toggle(setLearned, v.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="notes" className="space-y-3">
            <UploadRow
              hint={tr("Add repair note or photo")}
              actions={[{ icon: ImagePlus, label: tr("Photo") }, { icon: FileText, label: tr("Note") }]}
            />
            {notes.map((n) => (
              <DocCard
                key={n.id}
                item={n}
                viewed={!!viewed[n.id]}
                learned={!!learned[n.id]}
                onView={() => toggle(setViewed, n.id)}
                onLearn={() => toggle(setLearned, n.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="sop" className="space-y-3">
            {sops.map((s) => (
              <DocCard
                key={s.id}
                item={s}
                viewed={!!viewed[s.id]}
                learned={!!learned[s.id]}
                onView={() => toggle(setViewed, s.id)}
                onLearn={() => toggle(setLearned, s.id)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function UploadRow({
  hint,
  actions,
}: {
  hint: string;
  actions: { icon: React.ComponentType<{ className?: string }>; label: string }[];
}) {
  return (
    <Card className="flex items-center gap-2 p-2">
      <p className="flex-1 truncate px-2 text-xs text-muted-foreground">{hint}</p>
      {actions.map(({ icon: Icon, label }) => (
        <Button key={label} size="sm" variant="secondary" className="h-8 gap-1 text-[11px]">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Button>
      ))}
    </Card>
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

function VideoCard({
  item,
  viewed,
  learned,
  onView,
  onLearn,
}: {
  item: Item;
  viewed: boolean;
  learned: boolean;
  onView: () => void;
  onLearn: () => void;
}) {
  const { tr } = useT();
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => {
          onView();
          toast(tr("Opening: {a}", { a: tr(item.title) }));
        }}
        className="relative block aspect-video w-full bg-muted active:opacity-90"
        aria-label={tr("Play")}
      >
        {item.thumb && (
          <img src={item.thumb} alt={item.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-black/30">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-primary">
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>
        {item.duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {item.duration}
          </span>
        )}
      </button>
      <div className="p-3">
        <p className="text-sm font-semibold leading-snug">{tr(item.title)}</p>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{tr("by {a}", { a: item.by })}</span>
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
  onView,
  onLearn,
}: {
  item: Item;
  viewed: boolean;
  learned: boolean;
  onView: () => void;
  onLearn: () => void;
}) {
  const { tr } = useT();
  const isPhoto = item.source === "photo" && item.thumb;
  return (
    <Card className="p-3">
      <div className="flex gap-3">
        {isPhoto ? (
          <img
            src={item.thumb}
            alt={item.title}
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
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
          <p className="text-sm font-semibold leading-snug">{tr(item.title)}</p>
          <p className="text-[11px] text-muted-foreground">{tr("by {a}", { a: item.by })}</p>
          <div className="mt-1 flex items-center gap-2">
            {item.tag && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                {tr(item.tag)}
              </span>
            )}
            <SourceBadge source={item.source} />
          </div>
        </div>
      </div>
      <MarkButtons viewed={viewed} learned={learned} onView={onView} onLearn={onLearn} />
    </Card>
  );
}
