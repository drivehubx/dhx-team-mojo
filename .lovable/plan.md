## Goal

Turn the existing UI (which currently reads from `mock-data.ts` + `localStorage`) into a real multi-user workshop app on Supabase. Owner / Manager / Worker each get working buttons end-to-end.

I'll ship this in **5 phases**, each independently usable. After every phase you can actually use that workflow. We do NOT redesign any page — only wire actions, persist data, and gate by role.

---

## Phase 0 — Foundation (auth + roles + employee table)

Without this, no role-based action can be enforced.

**DB:**
- `app_role` enum: `owner | manager | worker`
- `profiles(id uuid PK → auth.users, full_name, phone, initials, active)`
- `user_roles(user_id, role)` + `has_role(_user_id, _role)` security-definer fn
- Trigger: on `auth.users` insert → create profile row
- Migrate the 6 seed employees into `profiles` (linked once owner signs up; rest invited)

**Code:**
- Replace the mock `currentUser` with `useAuth()` hook reading `supabase.auth` + role
- `_authenticated/route.tsx` already managed by integration → use it
- Role switcher in dev only; production reads `user_roles`

---

## Phase 1 — Advance (request → approve → repay)

**DB:** `advances(id, employee_id → profiles, type 'borrow'|'repayment', amount, reason, status 'pending'|'approved'|'rejected', requested_by, approved_by, created_at)`

**Server fns (`src/lib/advances.functions.ts`):**
- `listAdvances()` — role-scoped (worker sees own; manager/owner sees all)
- `requestAdvance({ amount, reason })` — worker creates pending borrow
- `approveAdvance({ id })` / `rejectAdvance({ id })` — manager/owner
- `recordRepayment({ employee_id, amount })` — manager/owner

**UI changes to `src/routes/advance.tsx`:**
- Worker view: "Request Advance" button (already exists, wire it)
- Pending approvals tab for manager/owner with Approve / Reject
- Balance tab reads live aggregate, not mock

---

## Phase 2 — Salary (adjust + mark paid + history)

**DB:** `salaries(id, employee_id, period_month date, basic, ot, bonus, deduction, advance_deduction, paid bool, paid_at)`
Auto-pulls active advance balance into `advance_deduction` at month roll.

**Server fns:**
- `getSalaryForMonth({ employee_id, month })`
- `upsertSalary({ … })` — manager/owner only
- `markSalaryPaid({ id })`
- `listSalaryHistory({ employee_id })`

**UI:** existing `salary.tsx` becomes live — Edit sheet writes to DB; Mark Paid button persists; History tab shows real months.

---

## Phase 3 — Team (assign / swap / remove / attendance / check-in)

**DB:**
- `attendance(employee_id, date, status, check_in_at, check_out_at)`
- Jobs already client-stored → migrate to `jobs` + `job_assignments` tables so Assign / Swap / Remove are real

**Server fns:**
- `checkIn()` / `checkOut()` — worker self-service
- `setAttendance({ employee_id, status })` — manager/owner
- `assignWorker({ job_id, employee_id })`, `removeWorker(...)`, `swapWorker(...)`

**UI:** the existing Assign / Swap / Remove buttons on team cards open a real picker and persist.

---

## Phase 4 — Skills (assessment submit + approve)

**DB:**
- `employee_skills(employee_id, category, current, required)`
- `assessment_requests(id, employee_id, category, current_level, requested_level, reason, status, reviewer_id, decided_at)`
- `assessment_history(...)` — written on approval

**Server fns:**
- `submitAssessment({ category, requested_level, reason })` — worker
- `decideAssessment({ id, decision: 'approve' | 'reject' })` — manager/owner, on approve updates `employee_skills` + writes history

**UI:** existing skills page approval queue and submit form become live.

---

## Out of scope (kept as-is)

- i18n strings, layouts, colors, navigation, routing — unchanged
- Jobs CRUD (already works via localStorage) — only migrated to Supabase as part of Phase 3 because Team actions touch it
- Login screen UI — already exists; only wired to `supabase.auth`

---

## Order of execution

I will start with **Phase 0 + Phase 1** in this turn (foundation is mandatory; Advance is your top priority). Each subsequent phase is a follow-up message so you can verify before we move on.

Confirm and I'll create the Phase 0 + Phase 1 migration now.