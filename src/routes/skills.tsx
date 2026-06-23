import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import {
  Minus,
  Plus,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  Send,
  Video,
  FileText,
  Wrench,
  Loader2,
} from "lucide-react";
import { sbCore, sbWorkshop } from "@/integrations/supabase/shared-schema";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skills — DHX Body & Paint" },
      { name: "description", content: "Crew skill levels, gaps, assessments, and training recommendations." },
    ],
  }),
  component: SkillsPage,
});

const SKILL_CATS = ["Panel", "Paint", "QC", "SOP", "Training"] as const;
type SkillCat = (typeof SKILL_CATS)[number];

type DbStatus = "pending_manager" | "pending_owner" | "approved" | "rejected";

type CrewRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  role: "owner" | "manager" | "crew" | null;
};

type SkillCell = { current_level: number; required_level: number };

type RequestRow = {
  id: string;
  workspace_id: string;
  requester_id: string;
  skill_category: SkillCat;
  current_level: number;
  requested_level: number;
  reason: string;
  status: DbStatus;
  reviewer_id: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: string;
  workspace_id: string;
  profile_id: string;
  skill_category: SkillCat;
  level_from: number;
  level_to: number;
  reason: string | null;
  approved_by_id: string | null;
  approved_at: string;
};

const trainingRecommendations: Record<SkillCat, string> = {
  Panel: "Panel Repair & Alignment Workshop",
  Paint: "Spray Technique & Colour Mixing",
  QC: "Quality Control Inspection Cert",
  SOP: "Standard Operating Procedures Refresher",
  Training: "Onboarding & Mentorship Programme",
};

const trainingSuggestions: Record<SkillCat, { videos: string[]; sops: string[]; jobs: string[] }> = {
  Panel: {
    videos: ["Panel Alignment 101", "Dent Pulling Basics"],
    sops: ["SOP-PNL-02 Panel Replacement"],
    jobs: ["Shadow senior tech on next panel job", "Assist on rear quarter replacement"],
  },
  Paint: {
    videos: ["Spray Gun Setup", "Colour Mixing Masterclass"],
    sops: ["SOP-PNT-01 Booth Prep", "SOP-PNT-04 Blending"],
    jobs: ["Solo respray on bumper", "Shadow lead painter on bonnet"],
  },
  QC: {
    videos: ["QC Checklist Walkthrough"],
    sops: ["SOP-QC-01 Final Inspection"],
    jobs: ["Run QC on next 3 completed jobs"],
  },
  SOP: {
    videos: ["Workshop SOP Overview"],
    sops: ["SOP-GEN-00 Workshop Standards"],
    jobs: ["Document next job using SOP template"],
  },
  Training: {
    videos: ["Mentorship Best Practices"],
    sops: ["SOP-TRN-01 Onboarding"],
    jobs: ["Mentor helper on 1 job this week"],
  },
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

function gapColor(gap: number) {
  if (gap === 0) return "text-emerald-400";
  if (gap <= 1) return "text-amber-400";
  return "text-rose-400";
}

function LevelDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div key={i} className={`h-2 w-2 rounded-full ${i < level ? "bg-primary" : "bg-primary/20"}`} />
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: DbStatus }) {
  const { tr } = useT();
  const map: Record<DbStatus, { cls: string; icon: typeof Clock; label: string }> = {
    pending_manager: { cls: "bg-amber-500/15 text-amber-300", icon: Clock, label: "Manager Review" },
    pending_owner: { cls: "bg-blue-500/15 text-blue-300", icon: Clock, label: "Owner Approval" },
    approved: { cls: "bg-emerald-500/15 text-emerald-300", icon: CheckCircle2, label: "Approved" },
    rejected: { cls: "bg-rose-500/15 text-rose-300", icon: XCircle, label: "Rejected" },
  };
  const { cls, icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {tr(label)}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function SkillsPage() {
  const { tr } = useT();
  const { workspaceId, profile, role, isOwner, isManager } = useWorkspace();

  const [loading, setLoading] = useState(true);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [skills, setSkills] = useState<Map<string, Map<SkillCat, SkillCell>>>(new Map());
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const [editMode, setEditMode] = useState(false);
  const [openRequest, setOpenRequest] = useState(false);
  const [reqCat, setReqCat] = useState<SkillCat>("Paint");
  const [reqLevel, setReqLevel] = useState(0);
  const [reqReason, setReqReason] = useState("");
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const canEdit = isOwner;
  const isCrew = role === "crew";

  const skillFor = (pid: string, cat: SkillCat): SkillCell => {
    return skills.get(pid)?.get(cat) ?? { current_level: 0, required_level: 3 };
  };

  const loadAll = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [profilesRes, rolesRes, skillsRes, reqRes, histRes] = await Promise.all([
        sbCore().from("profiles").select("id, full_name, avatar_url, is_active").eq("workspace_id", workspaceId),
        sbCore().from("roles").select("profile_id, role").eq("workspace_id", workspaceId),
        sbWorkshop().from("crew_skills").select("*").eq("workspace_id", workspaceId),
        sbWorkshop()
          .from("assessment_requests")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        sbWorkshop()
          .from("assessment_history")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("approved_at", { ascending: false }),
      ]);

      const roleByProfile = new Map<string, CrewRow["role"]>();
      for (const r of (rolesRes.data ?? []) as Array<{ profile_id: string; role: CrewRow["role"] }>) {
        roleByProfile.set(r.profile_id, r.role);
      }
      const merged: CrewRow[] = ((profilesRes.data ?? []) as Array<Omit<CrewRow, "role">>).map((p) => ({
        ...p,
        role: roleByProfile.get(p.id) ?? null,
      }));
      setCrew(merged);

      const skillMap = new Map<string, Map<SkillCat, SkillCell>>();
      for (const row of (skillsRes.data ?? []) as Array<{
        profile_id: string;
        skill_category: SkillCat;
        current_level: number;
        required_level: number;
      }>) {
        if (!skillMap.has(row.profile_id)) skillMap.set(row.profile_id, new Map());
        skillMap.get(row.profile_id)!.set(row.skill_category, {
          current_level: row.current_level,
          required_level: row.required_level,
        });
      }
      setSkills(skillMap);
      setRequests((reqRes.data ?? []) as RequestRow[]);
      setHistory((histRes.data ?? []) as HistoryRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const adjust = async (pid: string, cat: SkillCat, delta: number) => {
    const cur = skillFor(pid, cat);
    const newLevel = Math.max(0, Math.min(5, cur.current_level + delta));
    if (newLevel === cur.current_level) return;
    // Optimistic
    setSkills((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(pid) ?? new Map());
      inner.set(cat, { current_level: newLevel, required_level: cur.required_level });
      next.set(pid, inner);
      return next;
    });
    const { error } = await sbWorkshop()
      .from("crew_skills")
      .upsert(
        {
          workspace_id: workspaceId,
          profile_id: pid,
          skill_category: cat,
          current_level: newLevel,
          required_level: cur.required_level || 3,
        },
        { onConflict: "workspace_id,profile_id,skill_category" },
      );
    if (error) {
      toast.error(error.message);
      void loadAll();
    }
  };

  const totalGaps = useMemo(() => {
    return crew.reduce((sum, e) => {
      return (
        sum +
        SKILL_CATS.reduce((g, c) => {
          const s = skillFor(e.id, c);
          return g + Math.max(0, s.required_level - s.current_level);
        }, 0)
      );
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew, skills]);

  const avgSkill = useMemo(() => {
    if (crew.length === 0) return 0;
    return Math.round(
      crew.reduce((sum, e) => {
        return (
          sum +
          SKILL_CATS.reduce((t, c) => t + skillFor(e.id, c).current_level, 0) / SKILL_CATS.length
        );
      }, 0) / crew.length,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crew, skills]);

  const advanceRequest = async (id: string, action: "approve" | "reject") => {
    const note = noteMap[id]?.trim() || null;
    const rpc = action === "approve" ? "approve_assessment" : "reject_assessment";
    const { error } = await sbWorkshop().rpc(rpc, { p_request_id: id, p_note: note });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(action === "approve" ? tr("Approved") : tr("Rejected"));
    setNoteMap((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
    void loadAll();
  };

  const submitRequest = async () => {
    if (!reqReason.trim() || !profile || !workspaceId) return;
    const cur = skillFor(profile.id, reqCat).current_level;
    const requested = Math.max(cur + 1, reqLevel);
    const { error } = await sbWorkshop().from("assessment_requests").insert({
      workspace_id: workspaceId,
      requester_id: profile.id,
      skill_category: reqCat,
      current_level: cur,
      requested_level: requested,
      reason: reqReason.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Request submitted"));
    setOpenRequest(false);
    setReqReason("");
    setReqLevel(0);
    void loadAll();
  };

  const crewById = useMemo(() => {
    const m = new Map<string, CrewRow>();
    for (const c of crew) m.set(c.id, c);
    return m;
  }, [crew]);

  if (loading) {
    return (
      <div>
        <AppHeader title={tr("Skills")} subtitle={tr("Capability, assessments & training")} />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader title={tr("Skills")} subtitle={tr("Capability, assessments & training")} />

      <div className="px-5 space-y-4 pb-8">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Total Gaps")}</p>
            <p className="mt-1 text-2xl font-semibold text-rose-400">{totalGaps}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Avg Skill")}</p>
            <p className="mt-1 text-2xl font-semibold text-primary">
              {avgSkill}
              <span className="text-sm text-muted-foreground">/5</span>
            </p>
          </Card>
        </div>

        {/* Edit toggle — owner only */}
        {canEdit && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {editMode ? tr("Tap +/- for quick adjust") : tr("Quick adjust available (Owner)")}
            </p>
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
              className="h-7 text-xs"
            >
              {editMode ? tr("Done") : tr("Edit")}
            </Button>
          </div>
        )}

        {/* Crew request CTA */}
        {isCrew && profile && (
          <Card className="p-3">
            {!openRequest ? (
              <Button onClick={() => setOpenRequest(true)} className="w-full h-9 text-xs">
                <Send className="h-3.5 w-3.5" /> {tr("Request Skill Assessment")}
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold">{tr("Request Assessment")}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">{tr("Category")}</p>
                    <select
                      value={reqCat}
                      onChange={(e) => setReqCat(e.target.value as SkillCat)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      {SKILL_CATS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">
                      {tr("Current {a} → Requested", { a: skillFor(profile.id, reqCat).current_level })}
                    </p>
                    <select
                      value={reqLevel || skillFor(profile.id, reqCat).current_level + 1}
                      onChange={(e) => setReqLevel(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      {[1, 2, 3, 4, 5]
                        .filter((n) => n > skillFor(profile.id, reqCat).current_level)
                        .map((n) => (
                          <option key={n} value={n}>
                            {tr("Level {n}", { n })}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                <Textarea
                  placeholder={tr("Reason / evidence (e.g. completed 10 jobs solo)")}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  className="min-h-[60px] text-xs"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={submitRequest}>
                    {tr("Submit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setOpenRequest(false)}
                  >
                    {tr("Cancel")}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Assessment Requests queue */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {tr("Assessment Requests")}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {tr("Flow: Crew → Manager → Owner")}
            </span>
          </div>
          {requests.length === 0 && (
            <Card className="p-4 text-center text-xs text-muted-foreground">{tr("No requests")}</Card>
          )}
          {requests.map((r) => {
            const emp = crewById.get(r.requester_id);
            const name = emp?.full_name ?? "—";
            const canManagerAct = isManager && r.status === "pending_manager";
            const canOwnerAct = isOwner && (r.status === "pending_manager" || r.status === "pending_owner");
            const canAct = canManagerAct || canOwnerAct;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {tr(r.skill_category)}: {r.current_level} → {r.requested_level} · {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  "{r.reason}"
                </p>
                {canAct && (
                  <>
                    <Textarea
                      placeholder={tr("Comment (optional)")}
                      className="mt-2 min-h-[40px] text-xs"
                      value={noteMap[r.id] ?? ""}
                      onChange={(e) => setNoteMap((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => advanceRequest(r.id, "approve")}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {canManagerAct && !isOwner ? tr("Approve → Owner") : tr("Final Approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs"
                        onClick={() => advanceRequest(r.id, "reject")}
                      >
                        <XCircle className="h-3 w-3" />
                        {tr("Reject")}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>

        {/* Crew skill cards */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Crew Skills")}
          </p>
          {crew.length === 0 && (
            <Card className="p-4 text-center text-xs text-muted-foreground">{tr("No crew yet")}</Card>
          )}
          {crew.map((emp) => {
            const gaps = SKILL_CATS.map((c) => {
              const s = skillFor(emp.id, c);
              return { cat: c, gap: Math.max(0, s.required_level - s.current_level) };
            });
            const hasGap = gaps.some((g) => g.gap > 0);
            const topGap = gaps.reduce((a, b) => (a.gap > b.gap ? a : b), gaps[0]);
            const teachable = SKILL_CATS.filter((c) => skillFor(emp.id, c).current_level >= 4);
            const learning = SKILL_CATS.filter((c) => skillFor(emp.id, c).current_level <= 3);
            const empHistory = history.filter((h) => h.profile_id === emp.id);

            return (
              <Card key={emp.id} className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {initialsOf(emp.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{emp.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {emp.role ? tr(emp.role.charAt(0).toUpperCase() + emp.role.slice(1)) : "—"}
                    </p>
                  </div>
                  {hasGap && (
                    <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      {tr("Gap")}
                    </span>
                  )}
                </div>

                {/* Skill rows */}
                <div className="mt-4 space-y-3">
                  {SKILL_CATS.map((cat) => {
                    const { required_level: required, current_level: current } = skillFor(emp.id, cat);
                    const gap = Math.max(0, required - current);
                    const canTeach = current >= 4;
                    return (
                      <div key={cat} className="flex items-center justify-between gap-2">
                        <div className="min-w-[60px]">
                          <p className="text-xs font-medium">{tr(cat)}</p>
                          <span
                            className={`mt-0.5 inline-block rounded px-1 text-[9px] font-semibold ${
                              canTeach
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {canTeach ? tr("Can Teach") : tr("Learning")}
                          </span>
                        </div>

                        <div className="flex flex-1 items-center gap-3">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-muted-foreground">{tr("Req")}</span>
                            <span className="text-xs font-semibold">{required}</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-muted-foreground">{tr("Cur")}</span>
                            <span className="text-xs font-semibold">{current}</span>
                          </div>
                          <LevelDots level={current} />
                          {editMode && canEdit && (
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => adjust(emp.id, cat, -1)}
                                className="grid h-5 w-5 place-items-center rounded bg-muted text-muted-foreground"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => adjust(emp.id, cat, +1)}
                                className="grid h-5 w-5 place-items-center rounded bg-primary text-primary-foreground"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <div className="min-w-[28px] text-right">
                            <span className={`text-xs font-semibold ${gapColor(gap)}`}>
                              {gap === 0 ? tr("OK") : `-${gap}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Teach / Learn summary */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {teachable.map((c) => (
                    <span
                      key={`t-${c}`}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                    >
                      <GraduationCap className="h-3 w-3" /> {tr(c)}
                    </span>
                  ))}
                  {learning.map((c) => (
                    <span
                      key={`l-${c}`}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                    >
                      <BookOpen className="h-3 w-3" /> {tr(c)}
                    </span>
                  ))}
                </div>

                {/* Training recommendation */}
                {hasGap && (
                  <div className="mt-3 rounded-lg bg-primary/5 p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                          {tr("Recommended · gap in {c}", { c: tr(topGap.cat) })}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {tr(trainingRecommendations[topGap.cat])}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-1.5 pl-5">
                      {trainingSuggestions[topGap.cat].videos.map((v) => (
                        <p key={v} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Video className="h-3 w-3 text-primary/70" /> {tr(v)}
                        </p>
                      ))}
                      {trainingSuggestions[topGap.cat].sops.map((v) => (
                        <p key={v} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <FileText className="h-3 w-3 text-primary/70" /> {tr(v)}
                        </p>
                      ))}
                      {trainingSuggestions[topGap.cat].jobs.map((v) => (
                        <p key={v} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Wrench className="h-3 w-3 text-primary/70" /> {tr(v)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assessment history */}
                {empHistory.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <History className="h-3 w-3" /> {tr("Assessment History")}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {empHistory.map((h) => (
                        <div key={h.id} className="rounded-md bg-muted/30 p-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold">
                              {tr(h.skill_category)}: {h.level_from} → {h.level_to}
                            </p>
                            <span className="text-[10px] text-muted-foreground">{fmtDate(h.approved_at)}</span>
                          </div>
                          {h.reason && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{h.reason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Permissions note */}
        <Card className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Permissions")}
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            <p><span className="font-semibold text-foreground">{tr("Owner")}:</span> {tr("Full edit · quick adjust · final approval")}</p>
            <p><span className="font-semibold text-foreground">{tr("Manager")}:</span> {tr("Review requests · comment · forward to Owner")}</p>
            <p><span className="font-semibold text-foreground">{tr("Crew")}:</span> {tr("View · request assessment")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
