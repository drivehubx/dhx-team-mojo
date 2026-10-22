import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Scale } from "lucide-react";
import { useDeductionPolicy, useSaveDeductionPolicy } from "@/lib/advances";
import { LEGAL_SOURCES } from "@/components/advance-deduction-panel";

const cls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** Owner-only. Every save is written to the advance audit log by the database. */
export function DeductionPolicyEditor({ workspaceId }: { workspaceId: string }) {
  const q = useDeductionPolicy(workspaceId);
  const save = useSaveDeductionPolicy();
  const [f, setF] = useState({
    cap_percent: 50,
    law_version: "Labour Ordinance (Sarawak) Cap. 76 — amended, effective 1 May 2025",
    effective_date: "2025-05-01",
    last_review_date: "",
    reviewer_name: "",
    note_zh: "",
    note_en: "",
    note_ms: "",
  });

  useEffect(() => {
    const p = q.data;
    if (!p) return;
    setF({
      cap_percent: Number(p.cap_percent),
      law_version: p.law_version,
      effective_date: p.effective_date ?? "",
      last_review_date: p.last_review_date ?? "",
      reviewer_name: p.reviewer_name ?? "",
      note_zh: p.note_zh ?? "",
      note_en: p.note_en ?? "",
      note_ms: p.note_ms ?? "",
    });
  }, [q.data]);

  const stale = !f.last_review_date || Date.now() - new Date(f.last_review_date).getTime() > 365 * 86400000;

  const onSave = async () => {
    if (!(f.cap_percent > 0 && f.cap_percent <= 50)) return toast.error("上限必须在 0–50% 之间 / Cap must be 0–50%");
    try {
      await save.mutateAsync({ ...f, source_links: LEGAL_SOURCES, exceptions: q.data?.exceptions ?? [] } as any);
      toast.success("法规设定已保存 / Policy saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: k === "cap_percent" ? parseFloat(e.target.value) || 0 : e.target.value }));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          工资扣除法规 / Deduction policy (owner)
        </h2>
      </div>
      {stale && <p className="rounded-lg bg-warning/15 p-2 text-xs text-warning">请复核法规 / Please review the law (no review in last 12 months)</p>}
      <label className="block text-xs text-muted-foreground">Cap % (s.114(8), max 50)
        <input type="number" value={f.cap_percent} onChange={set("cap_percent")} className={cls} /></label>
      <label className="block text-xs text-muted-foreground">Law version
        <input value={f.law_version} onChange={set("law_version")} className={cls} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">Effective date
          <input type="date" value={f.effective_date} onChange={set("effective_date")} className={cls} /></label>
        <label className="block text-xs text-muted-foreground">Last legal review / 最后审核
          <input type="date" value={f.last_review_date} onChange={set("last_review_date")} className={cls} /></label>
      </div>
      <label className="block text-xs text-muted-foreground">Reviewer (accountant / JTK)
        <input value={f.reviewer_name} onChange={set("reviewer_name")} className={cls} /></label>
      <label className="block text-xs text-muted-foreground">Extra note 中文
        <textarea rows={2} value={f.note_zh} onChange={set("note_zh")} className={cls} /></label>
      <label className="block text-xs text-muted-foreground">Extra note English
        <textarea rows={2} value={f.note_en} onChange={set("note_en")} className={cls} /></label>
      <label className="block text-xs text-muted-foreground">Extra note Bahasa Melayu
        <textarea rows={2} value={f.note_ms} onChange={set("note_ms")} className={cls} /></label>
      <p className="text-[11px] text-muted-foreground">s.114(9) exceptions are not applied automatically. 每次修改都会记录在审计日志。</p>
      <button onClick={onSave} disabled={save.isPending}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {save.isPending ? "Saving…" : "Save policy"}
      </button>
    </section>
  );
}
