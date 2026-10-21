# Salary Advance on Behalf + Disbursement + Payroll Deduction — Audit and Plan

Audit only. Nothing changes until you approve each phase.

## 1. Findings (verified this turn)

**workshop.advances**: id, workspace_id, profile_id, amount, reason, status (pending/approved/rejected), requested_at, reviewed_at, reviewed_by, created_at.
- No fields for: created-by (who keyed it in), payment method, paid date, paid-by, paid amount, settled amount, cancel/void.
- "Approved" is the last state. There is no way today to say the money was actually handed over.

**workshop.salaries**: one row per person per period: basic, allowances, bonus, deductions (one number), paid (yes/no), notes.
- No EPF / SOCSO / EIS / PCB fields. Statutory deductions are not in the system; "deductions" is one manual number.
- No link between a salary row and which advances it repaid, so duplicate deduction cannot be detected.
- Uniqueness on (workspace, person, period): not confirmed.

**Access rules (RLS)**
- Advance create: only for yourself (`profile_id = auth.uid()`). So owner on-behalf entry is blocked today by the database — the change cannot be done in the screen alone.
- Advance view: own records, or owner/manager.
- Advance approve/edit: owner/manager. Delete: owner only.
- Salary write: owner only. Salary view: own, or owner/manager.
- Gap: the app treats Supervisors as "staff" (sees the Pending/Approve tab), but the database only lets owner/manager approve — supervisors would get an error.
- Policies are written for role `public`, not `authenticated` (works, but untidy).

**Legacy data**: the audit query returned no rows in either table. Must be re-confirmed before migrating (possible permission view limit).

**Payroll process today**: owner types basic/allowances/bonus/deductions by hand per period; net = basic + allowances + bonus − deductions. Advances are not linked automatically.

## 2. Unresolved questions (need your answer)

1. Who may create on behalf and record payment: owner only, or owner + administrator + manager? Supervisors?
2. On-behalf entry by owner: auto-approved, or still needs a second person to approve?
3. Default deduction per month: full remaining balance, or a fixed instalment set per advance (e.g. RM 100/month)?
4. If net pay would go below zero (or below a minimum), carry the rest to next month? Minimum take-home?
5. EPF/SOCSO/EIS/PCB: done outside (accountant/payroll software)? If yes, this system stays "advance deduction only" and we do not compute statutory amounts.
6. Any old approved advances already repaid in cash or already deducted manually? Plan: mark all existing approved ones as "legacy — not auto-deducted" unless you tick them individually.
7. Can a paid advance be cancelled? Proposal: never delete — only reverse with a reason.

## 3. Proposed design (minimal)

```text
pending -> approved -> paid -> (partially settled) -> settled
        \-> rejected        \-> reversed (with reason)
```

- Approval and payment are separate steps with separate people/timestamps.
- Only **paid** advances with a remaining balance are offered to payroll.
- Each deduction is a separate ledger line tied to one salary period, so the same money is never deducted twice.

### Database changes (one migration, additive only — no drops, no renames)
- `workshop.advances` add: created_by, entry_mode (self / on_behalf), payment_method (cash / bank / duitnow), paid_at (date), paid_by, payment_reference, is_legacy (default false), reversed_at, reversed_by, reverse_reason, instalment_amount (optional).
- Extend status values with `paid`, `settled`, `reversed` (keep existing values).
- New `workshop.advance_deductions`: advance_id, salary_id, period, amount, created_by, created_at; unique (advance_id, salary_id).
- `workshop.salaries`: add `advance_deduction_total`; unique (workspace_id, profile_id, period) if no duplicates exist.
- Mark all existing approved rows `is_legacy = true` (excluded from auto-deduct).
- Server-side functions (transaction + row lock to prevent double clicks / two people at once):
  - `create_advance_on_behalf(profile, amount, reason, method, paid_at, operator)`
  - `record_advance_payment(advance, method, paid_at, reference)` — only from `approved`
  - `apply_advance_deductions(salary_id, lines[])` — locks advances, checks remaining balance, writes ledger lines, updates statuses; re-running for the same salary is rejected or replaces lines safely
  - `reverse_advance(advance, reason)`
- Access: self-insert rule stays as is; on-behalf, payment and deduction only via the functions above, checked against `core.roles` for the allowed roles. Policies moved to `authenticated`.
- Audit: write every create/approve/pay/deduct/reverse to the existing core audit table (to verify it exists first; otherwise a small `workshop.advance_events` table).

This is a shared backend — the change touches only `workshop.*` advance/salary objects; Rental and Driver apps are not expected to use them, to confirm before running.

## 4. Phased build

**Phase 0 — confirm (no changes)**: answer questions above; re-check row counts, duplicate salary periods, audit table, whether sibling apps read `workshop.advances`.

**Phase 1 — database**: run the migration above; tests in SQL for: self-request still works; worker cannot create for others; approved-not-paid never deducted; legacy never auto-deducted; partial deduction leaves correct balance; same salary cannot deduct twice; two parallel deductions cannot exceed balance.

**Phase 2 — Advance screen**:
- Keep the worker's own "Request Advance" and "My history" exactly as now.
- Owner/admin: "Add for Team Member" — pick person, amount, optional reason, method (Cash/Bank/DuitNow), paid date, operator shown automatically. Option "already paid now".
- Approved tab gets "Mark as paid" button.
- Tabs: Pending / Approved (unpaid) / Paid (outstanding) / Settled / Rejected.
- Fix the supervisor mismatch (hide approve buttons for roles the database refuses).

**Phase 3 — Salary screen**:
- When opening a period, show "Outstanding paid advances" with suggested amount each (editable down, never above balance); carry the rest forward.
- Deduction saved through the server function; manual "other deductions" stays separate.
- Statutory: unchanged (manual) unless you answer Q5 otherwise.

**Phase 4 — Ledger and audit**:
- Per Team Member ledger: each advance, paid date, method, deductions by month, balance left. Worker sees only their own.
- Audit list for owner.

**Phase 5 — tests and check**: unit tests for balance/carryover math and status rules; run on preview; you test on phone with Ngah's case.

## Technical notes
- Use `createServerFn` + `requireSupabaseAuth` calling the database functions; no edge functions.
- Money in numeric, rounded to 2 decimals in the function, never in the browser only.
- Concurrency: `SELECT ... FOR UPDATE` on advances inside the deduction function; unique constraint on the ledger as a second guard.
- Multilingual/learning features untouched.
