import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Scale } from "lucide-react";
import {
  useAdvances,
  useAdvanceDeductions,
  useDeductionPolicy,
  useSavePeriodDeductions,
  type AdvanceWithProfile,
} from "@/lib/advances";
import {
  availableForAdvance,
  round2,
  suggestDeductions,
  validateDeductions,
  wagesEarned,
} from "@/lib/advance-rules";

const fmt = (n: number) => new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n || 0);

export const LEGAL_SOURCES = [
  "https://lawnet.sarawak.gov.my/lawnet_file/Ordinance/ORD_F-LABOUR%20LawNet%28Watermark%29FRO.pdf",
  "https://www.jtkswk.gov.my/v2/?page_id=997",
  "https://www.jtkswk.gov.my/v2/?lang=en&page_id=3768",
];

type Salary = {
  id: string;
  basic: number;
  allowances: number;
  bonus: number;
  deductions: number;
  paid: boolean;
  other_s114_deductions?: number;
};

export function AdvanceDeductionPanel({
  workspaceId,
  profileId,
  salary,
  canEdit,
}: {
  workspaceId: string;
  profileId: string;
  salary: Salary | null;
  canEdit: boolean;
}) {
  const policyQ = useDeductionPolicy(workspaceId);
  const advQ = useAdvances(workspaceId, { mineOnly: true, userId: profileId });
  const all = (advQ.data ?? []) as AdvanceWithProfile[];
  const paid = all.filter((a) => a.paid_at && !a.is_legacy && ["paid", "partially_settled", "settled"].includes(a.status));
  const legacyCount = all.filter((a) => a.is_legacy).length;
  const dedQ = useAdvanceDeductions(workspaceId, paid.map((a) => a.id));
  const save = useSavePeriodDeductions();

  const capPct = Number(policyQ.data?.cap_percent ?? 50);
  const wages = salary ? wagesEarned(salary) : 0;
  const [otherS114, setOtherS114] = useState<number>(Number(salary?.other_s114_deductions ?? 0));
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [touched, setTouched] = useState(false);

  // balance excluding this salary's own lines (so re-saving replaces, never doubles)
  const rows = useMemo(() => {
    const deds = dedQ.data ?? [];
    return paid
      .map((a) => {
        const others = deds.filter((d) => d.advance_id === a.id && d.salary_id !== salary?.id);
        const mine = deds.find((d) => d.advance_id === a.id && d.salary_id === salary?.id);
        return {
          a,
          balance: round2(Number(a.paid_amount ?? 0) - others.reduce((s, d) => s + Number(d.amount), 0)),
          current: mine ? Number(mine.amount) : null,
        };
      })
      .filter((r) => r.balance > 0 || r.current !== null);
  }, [paid, dedQ.data, salary?.id]);

  const available = availableForAdvance(wages, capPct, otherS114);
  const outstanding = round2(rows.reduce((s, r) => s + r.balance, 0));

  useEffect(() => {
    if (touched || dedQ.isLoading) return;
    const hasSaved = rows.some((r) => r.current !== null);
    if (hasSaved) {
      setAmounts(Object.fromEntries(rows.map((r) => [r.a.id, r.current ?? 0])));
    } else {
      setAmounts(suggestDeductions(rows.map((r) => ({ id: r.a.id, balance: r.balance, paid_at: r.a.paid_at ?? null })), available));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, available, dedQ.isLoading]);

  const total = round2(Object.values(amounts).reduce((s, n) => s + (Number(n) || 0), 0));
  const errors = salary
    ? validateDeductions({
        wages,
        capPercent: capPct,
        otherS114,
        otherDeductions: Number(salary.deductions) || 0,
        lines: rows.map((r) => ({ id: r.a.id, amount: Number(amounts[r.a.id]) || 0, balance: r.balance })),
      })
    : [];
  const carry = round2(outstanding - total);
  const reviewDate = policyQ.data?.last_review_date ?? null;
  const reviewStale = !reviewDate || Date.now() - new Date(reviewDate).getTime() > 365 * 86400000;
  const legalReview = !salary || wages <= 0 || reviewStale;

  const onSave = async () => {
    if (!salary) return;
    if (errors.length) return toast.error(errors[0]);
    try {
      await save.mutateAsync({
        salaryId: salary.id,
        otherS114,
        lines: rows.map((r) => ({ advance_id: r.a.id, amount: Number(amounts[r.a.id]) || 0 })),
      });
      toast.success("预支扣除已保存 / Advance deductions saved");
      setTouched(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          预支扣除 / Advance recovery
        </h2>
      </div>

      {!salary ? (
        <p className="text-sm text-muted-foreground">请先保存本月工资记录 / Save this month's salary first.</p>
      ) : advQ.isLoading || dedQ.isLoading ? (
        <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">当月工资 Wages earned</dt><dd className="text-right">{fmt(wages)}</dd>
            <dt className="text-muted-foreground">{capPct}% 一般上限 s.114(8)</dt><dd className="text-right">{fmt(round2((wages * capPct) / 100))}</dd>
            <dt className="text-muted-foreground">其他第114条扣除 Other s.114</dt>
            <dd className="text-right">
              <input
                type="number" inputMode="decimal" min={0} disabled={!canEdit || salary.paid}
                value={otherS114}
                onChange={(e) => { setTouched(true); setOtherS114(Math.max(0, parseFloat(e.target.value) || 0)); }}
                className="w-24 rounded border border-border bg-background px-2 py-1 text-right disabled:opacity-60"
              />
            </dd>
            <dt className="font-semibold">本月可扣 Available</dt><dd className="text-right font-semibold">{fmt(available)}</dd>
            <dt className="text-muted-foreground">未还预支 Outstanding (paid)</dt><dd className="text-right">{fmt(outstanding)}</dd>
          </dl>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">没有已付款未还清的预支 / No paid outstanding advances.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.a.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5">
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold">付款 {r.a.paid_at} · {fmt(Number(r.a.paid_amount))}</p>
                    <p className="text-muted-foreground">余额 Balance {fmt(r.balance)}</p>
                  </div>
                  <input
                    type="number" inputMode="decimal" min={0} max={r.balance} step="0.01"
                    disabled={!canEdit || salary.paid}
                    value={amounts[r.a.id] ?? 0}
                    onChange={(e) => { setTouched(true); setAmounts((m) => ({ ...m, [r.a.id]: Math.max(0, parseFloat(e.target.value) || 0) })); }}
                    className="w-28 rounded-lg border border-border bg-card px-2 py-2 text-right text-sm disabled:opacity-60"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between text-sm">
            <span>本月扣除 This month</span><span className="font-semibold text-destructive">−{fmt(total)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>结转下月 Carried forward</span><span>{fmt(carry)}</span>
          </div>

          {errors.length > 0 && (
            <ul className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive space-y-1">
              {errors.map((e) => <li key={e}>⛔ {e}</li>)}
            </ul>
          )}
          {legacyCount > 0 && (
            <p className="text-xs text-warning">有 {legacyCount} 笔旧记录未核对，不会自动扣除 / Legacy advances excluded until reconciled.</p>
          )}

          {canEdit && !salary.paid && (
            <button
              onClick={onSave}
              disabled={save.isPending || errors.length > 0}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "保存扣除 / Save deductions"}
            </button>
          )}
          {salary.paid && <p className="text-xs text-muted-foreground">工资已发放，扣除已锁定 / Salary paid — locked.</p>}
        </>
      )}

      <LegalNote available={available} capPct={capPct} reviewDate={reviewDate} legalReview={legalReview}
        noteZh={policyQ.data?.note_zh ?? null} lawVersion={policyQ.data?.law_version ?? null} />
    </section>
  );
}

function LegalNote({
  available, capPct, reviewDate, legalReview, noteZh, lawVersion,
}: {
  available: number; capPct: number; reviewDate: string | null; legalReview: boolean; noteZh: string | null; lawVersion: string | null;
}) {
  return (
    <aside className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-[11px] leading-relaxed space-y-1.5">
      {legalReview && (
        <p className="font-semibold text-warning">
          ⚠ 需要法律审核 / Legal review needed / Semakan undang-undang diperlukan
        </p>
      )}
      <p className="font-semibold">法律说明（砂拉越）</p>
      <p>• 依据《砂拉越劳工法令》第76章第114(2)(c)条，雇主可从工资中扣回依第103条发放的预支工资，且不得收取利息（第115条）。</p>
      <p>• 第114(8)条：每月依第114条的扣除总额一般不得超过当月所得工资的{capPct}%（第114(9)条的例外除外，例外须经法律确认，系统不会自动套用）。</p>
      <p>• 本月可扣：{fmt(available)}。超过可扣金额、超过未还余额、或会令实发工资为负数的扣除，系统会阻止保存——因为这些扣除不符合上述法律。</p>
      <p>• 未扣完的余额会自动结转到下个月；老板可以调低本月的扣除金额。</p>
      <p>• 只有已经实际付款的预支才会被扣除；只批准未付款的不会扣。旧记录须先核对。</p>
      <p>• 预支超过一个月工资须符合第103条规定并有批准编号。</p>
      <p>• EPF / SOCSO / EIS / PCB 未经法律分类，不计入此上限。</p>
      {noteZh && <p>• {noteZh}</p>}
      <p className="text-muted-foreground">
        Labour Ordinance (Sarawak) Cap. 76, s.103, s.114(2)(c), s.114(8)–(9), s.115 · Ordinan Buruh (Sarawak) Bab 76
        {lawVersion ? ` · ${lawVersion}` : ""}
      </p>
      <p className="text-muted-foreground">
        最后法律审核日期 / Last legal review / Semakan terakhir: {reviewDate ?? "未审核 / not reviewed"}
      </p>
      <p className="text-muted-foreground break-all">
        {LEGAL_SOURCES.map((s, i) => (
          <a key={s} href={s} target="_blank" rel="noreferrer" className="underline mr-2">[{i + 1}]</a>
        ))}
      </p>
    </aside>
  );
}
