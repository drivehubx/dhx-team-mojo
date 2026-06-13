import { createFileRoute } from "@tanstack/react-router";
import { useT } from "@/lib/i18n";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  employees,
  employeeSkills,
  skillCategories,
  currentUser,
  trainingRecommendations,
  assessmentRequests as initialRequests,
  assessmentHistory,
  lastAssessmentDate,
  trainingSuggestions,
  getEmployee,
  type AssessmentRequest,
  type SkillCategory,
} from "@/lib/mock-data";
import { useMemo, useState } from "react";
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
  CalendarDays,
} from "lucide-react";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skills — DHX Team Ops" },
      { name: "description", content: "Team skill levels, gaps, assessments, and training recommendations." },
    ],
  }),
  component: SkillsPage,
});

type Role = "Owner" | "Manager" | "Worker";
// Role simulation — Owner is currentUser; allow toggling for demo
const baseRole: Role = currentUser.role === "Owner" ? "Owner" : "Worker";

const canEditFor = (role: Role) => role === "Owner";

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

function StatusPill({ status }: { status: AssessmentRequest["status"] }) {
  const { tr } = useT();
  const map = {
    "Pending Manager": { cls: "bg-amber-500/15 text-amber-300", icon: Clock, label: "Manager Review" },
    "Pending Owner": { cls: "bg-blue-500/15 text-blue-300", icon: Clock, label: "Owner Approval" },
    Approved: { cls: "bg-emerald-500/15 text-emerald-300", icon: CheckCircle2, label: "Approved" },
    Rejected: { cls: "bg-rose-500/15 text-rose-300", icon: XCircle, label: "Rejected" },
  } as const;
  const { cls, icon: Icon, label } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {tr(label)}
    </span>
  );
}

function SkillsPage() {
  const { tr } = useT();
  const [role, setRole] = useState<Role>(baseRole);
  const [editMode, setEditMode] = useState(false);
  const [skills, setSkills] = useState(employeeSkills);
  const [requests, setRequests] = useState<AssessmentRequest[]>(initialRequests);

  // Request form
  const [openRequest, setOpenRequest] = useState(false);
  const [reqCat, setReqCat] = useState<SkillCategory>("Paint");
  const [reqLevel, setReqLevel] = useState(0);
  const [reqReason, setReqReason] = useState("");

  // For demo workers: pick a non-owner to represent "me"
  const workerSelf = useMemo(() => employees.find((e) => e.role !== "Owner") ?? employees[0], []);
  const meId = role === "Worker" ? workerSelf.id : currentUser.id;

  const canEdit = canEditFor(role);

  const adjust = (empId: string, cat: string, delta: number) => {
    setSkills((prev) => {
      const next = { ...prev };
      const emp = { ...next[empId] };
      const skill = { ...emp[cat as keyof typeof emp] };
      skill.current = Math.max(0, Math.min(5, skill.current + delta));
      emp[cat as keyof typeof emp] = skill;
      next[empId] = emp;
      return next;
    });
  };

  const totalGaps = employees.reduce((sum, e) => {
    const s = skills[e.id];
    return sum + skillCategories.reduce((g, c) => g + Math.max(0, s[c].required - s[c].current), 0);
  }, 0);

  const avgSkill = Math.round(
    employees.reduce((sum, e) => {
      const s = skills[e.id];
      return sum + skillCategories.reduce((t, c) => t + s[c].current, 0) / skillCategories.length;
    }, 0) / employees.length,
  );

  const advanceRequest = (id: string, action: "approve" | "reject") => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (action === "reject") return { ...r, status: "Rejected", reviewer: role };
        if (role === "Manager" && r.status === "Pending Manager")
          return { ...r, status: "Pending Owner", reviewer: "Manager" };
        if (role === "Owner") return { ...r, status: "Approved", reviewer: "Owner" };
        return r;
      }),
    );
  };

  const submitRequest = () => {
    if (!reqReason.trim()) return;
    const cur = skills[meId][reqCat].current;
    const newReq: AssessmentRequest = {
      id: `ar${Date.now()}`,
      employeeId: meId,
      category: reqCat,
      currentLevel: cur,
      requestedLevel: Math.max(cur + 1, reqLevel),
      reason: reqReason,
      date: "Today",
      status: "Pending Manager",
    };
    setRequests((prev) => [newReq, ...prev]);
    setOpenRequest(false);
    setReqReason("");
    setReqLevel(0);
  };

  return (
    <div>
      <AppHeader title={tr("Skills")} subtitle={tr("Capability, assessments & training")} />

      <div className="px-5 -mt-4 space-y-4 pb-8">
        {/* Role switcher (demo) */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 p-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tr("Viewing as")}</p>
          <div className="flex gap-1">
            {(["Owner", "Manager", "Worker"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  role === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {tr(r)}
              </button>
            ))}
          </div>
        </div>

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

        {/* Worker request CTA */}
        {role === "Worker" && (
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
                      onChange={(e) => setReqCat(e.target.value as SkillCategory)}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      {skillCategories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">
                      {tr("Current {a} → Requested", { a: skills[meId][reqCat].current })}
                    </p>
                    <select
                      value={reqLevel || skills[meId][reqCat].current + 1}
                      onChange={(e) => setReqLevel(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      {[1, 2, 3, 4, 5]
                        .filter((n) => n > skills[meId][reqCat].current)
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
              {tr("Flow: Worker → Manager → Owner")}
            </span>
          </div>
          {requests.length === 0 && (
            <Card className="p-4 text-center text-xs text-muted-foreground">{tr("No requests")}</Card>
          )}
          {requests.map((r) => {
            const emp = getEmployee(r.employeeId);
            const canManagerAct = role === "Manager" && r.status === "Pending Manager";
            const canOwnerAct = role === "Owner" && r.status === "Pending Owner";
            const canAct = canManagerAct || canOwnerAct;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{emp.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {r.category}: {r.currentLevel} → {r.requestedLevel} · {r.date}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <p className="mt-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                  "{r.reason}"
                </p>
                {canAct && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => advanceRequest(r.id, "approve")}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {canManagerAct ? tr("Approve → Owner") : tr("Final Approve")}
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
                )}
                {role === "Manager" && r.status === "Pending Manager" && (
                  <Textarea
                    placeholder={tr("Comment (optional)")}
                    className="mt-2 min-h-[40px] text-xs"
                  />
                )}
              </Card>
            );
          })}
        </div>

        {/* Employee skill cards */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tr("Team Skills")}
          </p>
          {employees.map((emp) => {
            const s = skills[emp.id];
            const gaps = skillCategories.map((c) => ({
              cat: c,
              gap: Math.max(0, s[c].required - s[c].current),
            }));
            const hasGap = gaps.some((g) => g.gap > 0);
            const topGap = gaps.reduce((a, b) => (a.gap > b.gap ? a : b), gaps[0]);
            const teachable = skillCategories.filter((c) => s[c].current >= 4);
            const learning = skillCategories.filter((c) => s[c].current <= 3);
            const empHistory = assessmentHistory.filter((h) => h.employeeId === emp.id);

            return (
              <Card key={emp.id} className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {emp.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{tr(emp.role)}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {lastAssessmentDate[emp.id]
                        ? tr("Last assessed: {d}", { d: lastAssessmentDate[emp.id] })
                        : tr("Last assessed: —")}
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
                  {skillCategories.map((cat) => {
                    const { required, current } = s[cat];
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

                {/* Training recommendation (expanded with videos/SOP/jobs) */}
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
                              {tr(h.category)}: {h.from} → {h.to}
                            </p>
                            <span className="text-[10px] text-muted-foreground">{h.date}</span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {tr(h.reason)} · {tr("by {a}", { a: h.approvedBy })}
                          </p>
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
            <p><span className="font-semibold text-foreground">{tr("Worker")}:</span> {tr("View · request assessment")}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
