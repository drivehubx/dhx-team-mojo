import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChevronDown, ChevronRight, Sparkles, User, Users } from "lucide-react";
import { dhxWorkshop, dhxCore } from "@/lib/dhx";
import { useT } from "@/lib/i18n";
import { useWorkspace } from "@/lib/workspace";

type VersionRow = {
  id: string;
  workspace_id: string;
  job_id: string;
  version_number: number;
  assessment_type: string;
  source: string; // 'ai' | 'human' | 'hybrid'
  assessment_json: unknown;
  created_by: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  initial_intake: "Initial Intake",
  human_corrected: "Human Corrected",
  additional_part: "Additional Part",
  final_verified: "Final Verified",
};

const SOURCE_LABEL: Record<string, string> = {
  ai: "AI",
  human: "Human",
  hybrid: "Hybrid",
};

export function BPAssessmentHistory({ jobId }: { jobId: string }) {
  const { tr } = useT();
  const { workspaceId } = useWorkspace();

  const q = useQuery({
    queryKey: ["bp-assessment-versions", workspaceId, jobId],
    enabled: !!workspaceId && !!jobId,
    queryFn: async () => {
      const { data, error } = await dhxWorkshop()
        .from("ai_assessment_versions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("job_id", jobId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as VersionRow[];
      const authorIds = Array.from(
        new Set(rows.map((r) => r.created_by).filter(Boolean) as string[]),
      );
      let names: Record<string, string> = {};
      if (authorIds.length) {
        const { data: profs } = await dhxCore()
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds);
        for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
          names[p.id] = p.full_name ?? "";
        }
      }
      return { rows, names };
    },
  });

  const rows = q.data?.rows ?? [];
  const names = q.data?.names ?? {};

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{tr("Assessment History")}</h2>
        <p className="text-xs text-muted-foreground">
          {tr("Append-only record of every assessment change.")}
        </p>
      </div>

      {q.isLoading ? (
        <div className="py-3 text-center">
          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {tr("No assessment history yet.")}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <VersionRowView
              key={r.id}
              row={r}
              authorName={r.created_by ? names[r.created_by] : ""}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VersionRowView({
  row,
  authorName,
}: {
  row: VersionRow;
  authorName: string;
}) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);

  const sourceIcon =
    row.source === "ai" ? (
      <Sparkles className="h-3 w-3" />
    ) : row.source === "hybrid" ? (
      <Users className="h-3 w-3" />
    ) : (
      <User className="h-3 w-3" />
    );

  return (
    <li className="rounded-xl border border-border bg-background">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              v{row.version_number}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {tr(TYPE_LABEL[row.assessment_type] ?? row.assessment_type)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {sourceIcon}
              {tr(SOURCE_LABEL[row.source] ?? row.source)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {new Date(row.created_at).toLocaleString()}
            {authorName ? ` · ${authorName}` : ""}
          </p>
        </div>
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto border-t border-border bg-secondary/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
{JSON.stringify(row.assessment_json, null, 2)}
        </pre>
      )}
    </li>
  );
}
