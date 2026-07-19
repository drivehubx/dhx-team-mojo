## Goal
Vehicles marked `status = 'sold'` in `core.vehicles` (currently 1 unit) should disappear from day-to-day lists so the workshop only sees active units. A small "Sold" link opens an archive so sold units are still reachable.

## Scope (confirmed by reading the code)
Sold status lives on `core.vehicles.status`. Places that surface vehicles today:

1. **Jobs list** — `src/routes/jobs.index.tsx` via `useJobs` (`src/lib/jobs.ts`). Jobs are hydrated with their vehicle.
2. **Home dashboard** — `src/routes/index.tsx` uses `useJobs` too.
3. **New Job wizard vehicle search** — `src/routes/jobs.new.tsx` via `useSearchVehiclesByPlate` (`src/lib/jobs.ts`).
4. **Body & Paint list** — `src/routes/bp.index.tsx` via `useBPJobs`. B&P jobs store plate/make/model on the job itself (no `vehicle_id` join), so sold-status doesn't apply here — I'll leave B&P untouched and note it in the plan.
5. **Learning / payroll / salary / advances / multilingual** — untouched (workspace non-negotiable).

## Changes

### 1. Filter helpers in `src/lib/jobs.ts`
- `useJobs(workspaceId)`: after hydration, drop jobs whose `vehicle.status === 'sold'`. Jobs with no vehicle stay visible.
- `useVehicles(workspaceId)`: default = exclude sold. Accept an optional arg `{ includeSold?: boolean }` (or a sibling hook `useSoldVehicles`) for the archive page.
- `useSearchVehiclesByPlate`: exclude sold from suggestions so staff can't accidentally open a new job against a sold car. (If they truly need to, they go through the Sold archive → "reactivate" later — out of scope for this turn.)

### 2. New archive route `src/routes/vehicles.sold.tsx`
- Lists all `core.vehicles` where `status = 'sold'` for the workspace: plate, make/model/year, sold date (uses `updated_at` as proxy — no `sold_at` column exists and we're not adding one this turn).
- Tap-through opens the vehicle's most recent job if one exists (reuses `/jobs/$id`), otherwise a read-only summary card. Non-destructive — no reactivate button in this pass.

### 3. Small "Sold" link entry points
- `src/routes/jobs.index.tsx`: add a small text-link "Sold ›" in the header row next to the job count, linking to `/vehicles/sold`.
- `src/routes/index.tsx` (home): same small "Sold" link near the jobs section header.
- Not adding it to `bp.index.tsx` since B&P jobs don't reference `core.vehicles`.

## Out of scope for this turn
- No schema changes (no new `sold_at` / `sold_price` columns, no new status enum values).
- No reactivate/unsold flow.
- B&P job list stays as-is (jobs there don't join `core.vehicles`).
- No changes to multilingual, payroll, salary, advances (workspace rule).

## Technical notes
- Filtering happens client-side after hydration for `useJobs` (jobs are already hydrated with the vehicle row, so no extra query). For `useVehicles` and `useSearchVehiclesByPlate` the filter is a `.neq('status', 'sold')` on the query.
- Query keys get a `{ includeSold }` suffix so the archive view doesn't collide with the default cache.

Confirm and I'll implement.