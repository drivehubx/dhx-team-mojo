# DHX Team Ops — UI Build Plan

A standalone, mobile-first internal ops app for DriveHubX workshop. UI only, mock data, no backend wiring.

## Design direction

- **Theme:** Dark blue (#0B1E3F primary, #1E3A8A accent) on white surface, with light slate neutrals. Professional, minimal, lots of whitespace.
- **Typography:** Inter (body) + a tighter display weight for numbers/KPIs.
- **Mobile-first:** Designed for 390px width. Bottom tab navigation (5 tabs), sticky top header per page.
- **Components:** shadcn cards, badges, tabs, sheets, avatars. Lucide icons. Rounded-xl, soft shadows, subtle dividers.

## Information architecture

Bottom tab bar with 5 routes:

```text
[ Dashboard ] [ Jobs ] [ Salary ] [ Advance ] [ Profile ]
```

## Pages

**1. Dashboard (`/`)**
- Greeting + role chip (Owner / Painter / Body Tech / Helper — switchable via mock role pill for demo).
- 4 KPI cards in a 2×2 grid: Active Workers, Today's Jobs, Outstanding Salary (MYR), Employee Advances (MYR).
- "Today's jobs" preview list (3 items) → links to Jobs.
- "Recent activity" feed (advance requested, job completed, salary paid).

**2. Jobs (`/jobs`)**
- Status filter chips: All / In Progress / Pending QC / Completed.
- Job cards: vehicle (plate + model), thumbnail photo strip (3 mock images), assigned staff avatars, status badge, progress bar.
- Tap a card → bottom sheet with full photos grid, staff list, status timeline, notes.

**3. Salary (`/salary`)**
- Month selector (current month).
- Per-employee salary cards showing breakdown: Basic, OT, Bonus, Deduction → Net total (highlighted).
- Summary card at top: total payroll this month, paid vs outstanding.

**4. Advance (`/advance`)**
- Summary header: Total Borrowed, Total Repaid, Outstanding Balance.
- Tabs: Borrow | Repayment | Balance.
- Borrow tab: list of advance entries (employee, amount, date, reason).
- Repayment tab: repayment history.
- Balance tab: per-employee outstanding balance list with mini progress bar (repaid / borrowed).

**5. Profile (`/profile`)**
- Avatar, name, role, employee ID, contact.
- Personal stats: this month's salary, OT hours, advance balance.
- Sections: Documents, Settings, Sign out (visual only).

## Mock data

Single `src/lib/mock-data.ts` exporting:
- `employees` (5–6: 1 Owner, 2 Painters, 2 Body Techs, 1 Helper) with avatars (initials), role, contact.
- `jobs` (6–8) with vehicle, plate, status, assigned staff IDs, photo URLs (Unsplash car/workshop), progress %.
- `salaries` (current month per employee) with basic/OT/bonus/deduction.
- `advances` (borrow + repayment entries) per employee.
- `currentUser` (mock, defaults to Owner so all data visible).

## Technical notes

- Routes under `src/routes/`: `index.tsx`, `jobs.tsx`, `salary.tsx`, `advance.tsx`, `profile.tsx`.
- Shared layout in `__root.tsx`: bottom tab nav (fixed), content area with safe-area padding.
- Tokens added to `src/styles.css`: deep navy primary, ink foreground, slate muted, success/warn/destructive for status badges.
- Preview viewport set to mobile.
- No backend, no auth, no Lovable Cloud.

## Out of scope

- Real auth / role switching logic (role is a static mock pill).
- Creating/editing records (read-only UI; buttons are visual).
- Backend, persistence, file uploads.
