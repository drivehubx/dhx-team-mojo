import { describe, it, expect } from "vitest";
import { availableForAdvance, suggestDeductions, validateDeductions, wagesEarned } from "./advance-rules";

describe("advance recovery rules", () => {
  it("wages earned = basic + allowances + bonus", () => {
    expect(wagesEarned({ basic: 2000, allowances: 300, bonus: 200 })).toBe(2500);
  });
  it("50% cap minus other s114 deductions", () => {
    expect(availableForAdvance(2500, 50, 250)).toBe(1000);
    expect(availableForAdvance(1000, 50, 600)).toBe(0);
  });
  it("partial deduction: suggestion never exceeds room, rest carries forward", () => {
    const s = suggestDeductions([{ id: "a", balance: 1500, paid_at: "2026-09-01" }], 1000);
    expect(s.a).toBe(1000); // 500 carries to next month
  });
  it("oldest paid advance first", () => {
    const s = suggestDeductions(
      [
        { id: "new", balance: 300, paid_at: "2026-10-01" },
        { id: "old", balance: 400, paid_at: "2026-09-01" },
      ],
      500,
    );
    expect(s.old).toBe(400);
    expect(s.new).toBe(100);
  });
  it("blocks above outstanding balance", () => {
    const e = validateDeductions({ wages: 3000, capPercent: 50, otherS114: 0, otherDeductions: 0, lines: [{ id: "a", amount: 600, balance: 500 }] });
    expect(e.length).toBe(1);
  });
  it("blocks above 50% limit", () => {
    const e = validateDeductions({ wages: 2000, capPercent: 50, otherS114: 200, otherDeductions: 0, lines: [{ id: "a", amount: 900, balance: 2000 }] });
    expect(e.some((x) => x.includes("114(8)"))).toBe(true);
  });
  it("allows owner-lowered amount within limits", () => {
    const e = validateDeductions({ wages: 2000, capPercent: 50, otherS114: 0, otherDeductions: 0, lines: [{ id: "a", amount: 200, balance: 1500 }] });
    expect(e).toEqual([]);
  });
  it("blocks when no wages", () => {
    expect(validateDeductions({ wages: 0, capPercent: 50, otherS114: 0, otherDeductions: 0, lines: [] }).length).toBe(1);
  });
});
