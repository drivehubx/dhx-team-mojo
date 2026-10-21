# Salary Advance on Behalf + Disbursement + Partial Payroll Deduction — Plan v3 (Sarawak law)

Plan only. No database or app change until you approve. Legal rules must be confirmed by your accountant / JTK Sarawak before going live.

## Firm requirements (owner confirmed)
1. Partial deductions across months allowed; remaining balance carries forward automatically.
2. Payroll suggests a deduction; owner can lower it. It can never exceed the verified paid outstanding balance or the lawful limit below.
3. Approval and actual payment are separate. Approved-but-unpaid is never deducted.
4. Worker self-request and self-view unchanged.
5. Legacy approved advances excluded until reconciled one by one.
6. Everything logged; reversal with reason instead of delete.
7. Follow Sarawak Labour Ordinance (Cap. 76), with a persistent Chinese legal note under the payroll deduction section every time.

## Legal basis (as provided by owner — to be re-verified before production)
| Rule | Source | System behaviour |
|---|---|---|
| s114(2)(c): employer may deduct to recover wage advances made under s103, without interest | Labour Ordinance (Sarawak) Cap. 76 | Advance recovery is a lawful deduction type |
| s114(8): total deductions under s114 generally ≤ 50% of wages earned in that month | Same | Cap = 50% × wages earned − other s114 deductions already taken |
| s114(9): exceptions to the 50% limit | Same | Stored as named exceptions; never applied automatically — owner selects + reason, flagged "legal review needed" |
| s115: no interest on advances ≤ one month's wages | Same | No interest field exists; recovery = paid amount only |
| s103: advances > one month's wages restricted to prescribed purposes / approval | Same + JTK guidance | Blocked by default; can only proceed with recorded approval reference once exact requirements are confirmed |
| 2025 amendment, effective 1 May 2025 | JTK Sarawak FAQ | Policy record shows version + effective date |

Sources:
- Current law: https://lawnet.sarawak.gov.my/lawnet_file/Ordinance/ORD_F-LABOUR%20LawNet%28Watermark%29FRO.pdf
- JTK Sarawak FAQ (2025 amendment): https://www.jtkswk.gov.my/v2/?page_id=997
- JTK Sarawak director approvals guidance: https://www.jtkswk.gov.my/v2/?lang=en&page_id=3768

Not yet verified by me: exact s114(9) exception wording, exact s103 prescribed purposes and approval process. These stay "blocked / legal review needed" until confirmed.

## Deduction classification (no blind 50%)
Each deduction line has a type:
- `s114_advance_recovery` — counts toward the 50% cap
- `s114_other` (e.g. other s114 items the owner enters) — counts toward cap
- `statutory` (EPF / SOCSO / EIS / PCB) — **not** counted until legally classified; shown separately
- `unclassified` — blocks save with "legal review needed"

## Calculation shown on the salary screen
```text
Monthly wages earned                         RM A
50% general limit (s114(8))                  RM A x 0.5
Other s114 deductions this month           - RM B
Available for advance recovery               RM C = max(0, A x 0.5 - B)
Outstanding paid advances (total)            RM D
Suggested deduction                          RM min(C, D, instalment if set)
Carried forward after this month             RM D - entered amount
```
- Save is **blocked** if: entered > advance balance; total s114 > cap (without an approved exception); net pay < 0; wage data missing; unclassified deduction present; advance > one month's wages without recorded s103 approval.
- **Warning** (not block) when close to the cap or an exception is used.
- If data is insufficient → "需要法律审核 / Legal review needed / Semakan undang-undang diperlukan".

## Persistent legal note (always below the deduction section)
Chinese main text, with English and Malay citation lines. Content:
- 依据《砂拉越劳工法令》第76章第114(2)(c)条，雇主可扣除依第103条发放的预支工资，不得收取利息（第115条）。
- 第114(8)条：每月依第114条的扣除总额一般不得超过当月所得工资的50%（第114(9)条例外除外）。
- 本月可扣：RM C。超过部分系统会阻止，原因如上。
- 未扣完的余额自动结转到下个月；老板可以调低本月扣除金额。
- EPF/SOCSO/EIS/PCB 未经法律分类，不计入此上限。
- Citation: "Labour Ordinance (Sarawak) Cap. 76, s.103, s.114(2)(c), s.114(8)-(9), s.115 / Ordinan Buruh (Sarawak) Bab 76".
- "最后法律审核日期 / Last legal review: <date>" from the policy record.
- When a save is blocked, the specific reason is shown in Chinese right above the note.

## Owner-only legal policy config
- Settings page section "工资扣除法规 / Deduction policy": cap percentage (default 50), effective date, law version, exception list, source links, last legal review date, reviewer name, note text (zh/en/ms).
- Only owner can edit; every change goes to the audit log with old/new values.
- If last review date is missing or older than 12 months → yellow banner "请复核法规".

## Lifecycle and deduction mechanics (unchanged from v2)
```text
pending -> approved -> paid -> partially_settled -> settled
        \-> rejected     \-> reversed (reason, before any deduction)
```
- Oldest paid advance first; one line per advance per salary; saving again replaces that period's lines atomically; locked after salary marked paid.

## Database changes (one additive migration, workshop schema only)
- `workshop.advances` add: created_by, entry_mode, payment_method (cash/bank/duitnow), paid_amount, paid_at, paid_by, payment_reference, instalment_amount, exceeds_one_month (computed at payment), s103_approval_ref, is_legacy, reconciled_at/by, reversed_at/by, reverse_reason. Status adds paid / partially_settled / settled / reversed.
- New `workshop.advance_deductions` (advance_id, salary_id, period, amount, created_by); unique (advance_id, salary_id).
- New `workshop.salary_deduction_lines` (salary_id, type, label, amount, exception_code, exception_reason).
- `workshop.salaries` add: wages_earned, advance_deduction_total; unique (workspace, person, period) after duplicate check.
- New `workshop.deduction_policy` (one active row per workspace, versioned) and `workshop.advance_events` audit log.
- Existing approved advances → `is_legacy = true`.
- Database functions with row locks enforce the cap and balance rules (the screen only explains; the database is the final check).

## Build phases
1. Confirm — the decisions below; accountant/JTK review of s103 and s114(9); recheck data and sibling app usage.
2. Database — migration + tests: unpaid/legacy never deducted; partial + carry-over correct; over-balance blocked; over-50% blocked; other s114 deductions reduce room; statutory not counted; missing wages → blocked; >1 month advance without approval blocked; double save no double deduction; concurrent saves safe; only owner edits policy and it is audited.
3. Advance screen — add for Team Member, mark paid, reconcile legacy, tabs, supervisor mismatch fix.
4. Salary screen — calculation panel, editable suggestions, block/warn messages, persistent Chinese legal note.
5. Settings — owner-only policy config with audit.
6. Ledger + audit views; unit tests for the cap math; phone check with Ngah's case.

## Essential remaining decisions
1. Who may add on behalf / mark paid / edit deductions: owner only, or owner + administrator + manager? (Policy editing is owner only regardless.)
2. Default suggestion: full available amount (within cap and balance), or a fixed instalment per advance?
3. What counts as "wages earned" for the 50%: basic + allowances + bonus, or basic + allowances only? (Accountant to confirm.)

## Technical notes
- `createServerFn` + `requireSupabaseAuth` calling database functions; 2-decimal rounding in the database.
- `SELECT ... FOR UPDATE` plus unique constraints against double deduction.
- Note text stored per language in the policy row; added to existing i18n without changing the multilingual/learning system.
