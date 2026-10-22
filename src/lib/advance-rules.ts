// Pure rules for salary-advance recovery (Labour Ordinance (Sarawak) Cap. 76, s.114(8)).
// The database function workshop.save_period_deductions is the final check; this mirrors it for the UI.

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Wages earned for the cap = basic + allowances + bonus (owner decision). */
export function wagesEarned(s: { basic: number; allowances: number; bonus: number }) {
  return round2(Number(s.basic) + Number(s.allowances) + Number(s.bonus));
}

/** Room left for advance recovery after other s.114 deductions. */
export function availableForAdvance(wages: number, capPercent: number, otherS114: number) {
  return Math.max(0, round2((wages * capPercent) / 100 - (Number(otherS114) || 0)));
}

export type OutstandingAdvance = { id: string; balance: number; paid_at: string | null };

/** Suggest full available amount, oldest paid advance first, never above each balance. */
export function suggestDeductions(advances: OutstandingAdvance[], available: number) {
  const sorted = [...advances].sort((a, b) => String(a.paid_at).localeCompare(String(b.paid_at)));
  let room = round2(available);
  const out: Record<string, number> = {};
  for (const a of sorted) {
    const take = round2(Math.max(0, Math.min(a.balance, room)));
    out[a.id] = take;
    room = round2(room - take);
  }
  return out;
}

/** Returns blocking reasons (Chinese / English). Empty array = allowed. */
export function validateDeductions(input: {
  wages: number;
  capPercent: number;
  otherS114: number;
  otherDeductions: number;
  lines: Array<{ id: string; amount: number; balance: number }>;
}): string[] {
  const errs: string[] = [];
  if (!(input.wages > 0)) errs.push("需要法律审核：没有当月工资资料 / Legal review needed: no wages");
  for (const l of input.lines) {
    if (l.amount < 0) errs.push("金额不能为负数 / Amount cannot be negative");
    if (round2(l.amount) > round2(l.balance))
      errs.push(`扣除 RM ${round2(l.amount)} 超过未还余额 RM ${round2(l.balance)} / Exceeds outstanding balance`);
  }
  const total = round2(input.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const cap = round2((input.wages * input.capPercent) / 100);
  if (round2(total + input.otherS114) > cap)
    errs.push(`超过第114(8)条上限 RM ${cap}（其他第114条扣除 RM ${round2(input.otherS114)}）/ Exceeds s.114(8) limit`);
  if (round2(input.wages - input.otherDeductions - input.otherS114 - total) < 0)
    errs.push("实发工资不能为负 / Net pay cannot be negative");
  return errs;
}
