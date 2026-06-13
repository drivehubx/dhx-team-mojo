import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { employees, employeeSkills, skillCategories, currentUser, trainingRecommendations } from "@/lib/mock-data";
import { useState } from "react";
import { Award, Minus, Plus, BookOpen } from "lucide-react";

export const Route = createFileRoute("/skills")({
  head: () => ({
    meta: [
      { title: "Skills — DHX Team Ops" },
      { name: "description", content: "Team skill levels, gaps, and recommended training." },
    ],
  }),
  component: SkillsPage,
});

const canEdit = currentUser.role === "Owner";

function gapColor(gap: number) {
  if (gap === 0) return "text-emerald-400";
  if (gap <= 1) return "text-amber-400";
  return "text-rose-400";
}

function LevelDots({ level, max = 5 }: { level: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${i < level ? "bg-primary" : "bg-primary/20"}`}
        />
      ))}
    </div>
  );
}

function SkillsPage() {
  const [editMode, setEditMode] = useState(false);
  const [skills, setSkills] = useState(employeeSkills);

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

  return (
    <div>
      <AppHeader title="Skills" subtitle="Team capability & gaps" />

      <div className="px-5 -mt-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total Gaps</p>
            <p className="mt-1 text-2xl font-semibold text-rose-400">{totalGaps}</p>
          </Card>
          <Card className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg Skill</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{avgSkill}<span className="text-sm text-muted-foreground">/5</span></p>
          </Card>
        </div>

        {/* Edit toggle — owner only */}
        {canEdit && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {editMode ? "Tap +/- to adjust current levels" : "View-only for workers"}
            </p>
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
              className="h-7 text-xs"
            >
              {editMode ? "Done" : "Edit"}
            </Button>
          </div>
        )}

        {/* Employee skill cards */}
        <div className="space-y-4">
          {employees.map((emp) => {
            const s = skills[emp.id];
            const gaps = skillCategories.map((c) => ({
              cat: c,
              gap: Math.max(0, s[c].required - s[c].current),
            }));
            const hasGap = gaps.some((g) => g.gap > 0);
            const topGap = gaps.reduce((a, b) => (a.gap > b.gap ? a : b), gaps[0]);

            return (
              <Card key={emp.id} className="p-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {emp.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                  {hasGap && (
                    <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                      Gap
                    </span>
                  )}
                </div>

                {/* Skill rows */}
                <div className="mt-4 space-y-3">
                  {skillCategories.map((cat) => {
                    const { required, current } = s[cat];
                    const gap = Math.max(0, required - current);
                    return (
                      <div key={cat} className="flex items-center justify-between gap-2">
                        <div className="min-w-[60px]">
                          <p className="text-xs font-medium">{cat}</p>
                        </div>

                        <div className="flex flex-1 items-center gap-3">
                          {/* Required */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-muted-foreground">Req</span>
                            <span className="text-xs font-semibold">{required}</span>
                          </div>

                          {/* Current */}
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] text-muted-foreground">Cur</span>
                            <span className="text-xs font-semibold">{current}</span>
                          </div>

                          {/* Dots */}
                          <LevelDots level={current} />

                          {/* Edit controls */}
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

                          {/* Gap */}
                          <div className="min-w-[28px] text-right">
                            <span className={`text-xs font-semibold ${gapColor(gap)}`}>
                              {gap === 0 ? "OK" : `-${gap}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recommended training */}
                {hasGap && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 p-2.5">
                    <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">Recommended</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {trainingRecommendations[topGap.cat]}
                        {topGap.gap > 1 && ` (gap ${topGap.gap})`}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
