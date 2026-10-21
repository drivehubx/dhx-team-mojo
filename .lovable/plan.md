# Salary Advance on Behalf + Disbursement + Partial Payroll Deduction — Plan v2

Plan only. No database or app change until you approve.

## Firm requirements (owner confirmed)
1. Partial deductions across multiple months are allowed; the remaining balance carries forward automatically to the next payroll.
2. Payroll suggests a deduction per advance; the owner can edit it. It can never exceed:
   - the verified outstanding balance of a **paid** advance, and
   - the lawful deduction limit for that pay period (see Decision 2).
3. Approval and actual payment are separate steps. Approved but unpaid = never deducted.
4. Worker self-request and self-view stay exactly as now.
5. Legacy approved advances are excluded from auto-deduction until the owner reconciles them one by one.
6. Every change is logged; nothing is deleted — mistakes are reversed with a reason.

## Current state (verified earlier)
- Advances: pending/approved/rejected only; no payment fields; database only allows creating for yourself.
- Salaries: one manual "deductions" number; no link to advances; no EPF/SOCSO/EIS/PCB fields.
- Approve rights: database owner/manager; app also shows approve to supervisors (mismatch to fix).
- Audit query showed 0 rows in both tables — re-check before migrating.

## Advance lifecycle
```text
pending -> approved -> paid -> partially_settled -> settled
        \-> rejected     \-> reversed (reason, before any deduction)
```
Balance = paid amount − sum of deductions. Status moves to `settled` only when balance reaches 0.

## Payroll deduction rules
- For a salary period, list all paid, non-legacy advances with balance > 0, oldest first.
- Suggested amount = min(instalment if set else remaining balance, remaining balance, room left under the deduction cap).
- Owner may lower or raise each line, but the save is rejected if any line > its balance, or the total > the cap, or net pay would drop below 0.
- Whatever is not deducted stays as balance and appears again next period automatically.
- One deduction line per advance per salary row (unique); saving again replaces that period's lines atomically, so no double deduction.
- Once a salary is marked paid, its deduction lines are locked; corrections go through a reversal line next period.

## Database changes (one additive migration, workshop schema only)
- `workshop.advances` add: created_by, entry_mode (self/on_behalf), payment_method (cash/bank/duitnow), paid_amount, paid_at, paid_by, payment_reference, instalment_amount, is_legacy, reconciled_at, reconciled_by, reversed_at, reversed_by, reverse_reason.
- Status values add: paid, partially_settled, settled, reversed.
- New `workshop.advance_deductions`: advance_id, salary_id, period, amount, created_by, created_at; unique (advance_id, salary_id); amount > 0.
- `workshop.salaries` add: advance_deduction_total (kept separate from manual "deductions"); unique (workspace_id, profile_id, period) after checking for duplicates.
- New `workshop.advance_events` audit log (unless an existing core audit table is confirmed usable).
- Existing approved rows set `is_legacy = true`.
- Server-side functions with row locks: create_on_behalf, record_payment, reconcile_legacy, save_period_deductions, reverse_advance. Roles checked against `core.roles`.
- Self-request rule kept; policies moved to signed-in users only.

## Build phases
1. **Confirm** — your answers below; recheck data and that Rental/Driver apps don't use these tables.
2. **Database** — migration + database tests: self-request still works; worker can't create for others; unpaid never deducted; legacy never deducted; partial deduction leaves correct balance and carries over; over-balance and over-cap rejected; double save doesn't double deduct; two people saving at once can't exceed balance.
3. **Advance screen** — "Add for Team Member" (person, amount, reason, method, paid date, operator auto); "Mark as paid"; tabs Pending / Approved-unpaid / Outstanding / Settled / Rejected; legacy "Reconcile" action; fix supervisor mismatch.
4. **Salary screen** — outstanding advances list with editable suggested amounts, cap shown, carry-forward shown; manual deductions unchanged.
5. **Ledger + audit** — per Team Member: advances, payments, monthly deductions, running balance; worker sees own only.
6. **Tests + phone check** — unit tests for suggestion/cap/carry-over math; you try Ngah's case.

## Essential remaining decisions (only these)
1. **Who can add on behalf / mark paid / edit deductions** — owner only, or owner + administrator + manager?
2. **Deduction cap** — Malaysian Employment Act limits advance-related deductions (commonly applied as total deductions not above 50% of monthly wages). Confirm we use a 50%-of-gross cap per period, stored as a setting, or give the figure your accountant uses.
3. **Default suggestion** — full remaining balance (within cap) or a fixed instalment entered per advance?

Everything else uses safe defaults: on-behalf entries by an authorised owner count as approved; statutory EPF/SOCSO/EIS/PCB stay outside the app; reversal instead of delete.

## Technical notes
- `createServerFn` + `requireSupabaseAuth` calling database functions; rounding to 2 decimals in the database.
- `SELECT ... FOR UPDATE` on advances during save; unique constraint as second guard.
- Multilingual and learning features untouched.
