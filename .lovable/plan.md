# Clean Reset & Production-Ready State

## 0. Confirmation required (destructive)
This plan **deletes every existing auth user, profile, role, salary, advance, driver, vehicle, rental, payment, and storage object**. Schema (tables, policies, functions) is kept. The first email that signs up after the reset becomes Owner.

If you want to preserve any specific account (e.g. your own login), tell me the email before approving.

## 1. Database migration (single migration, requires approval)

### 1a. Wipe demo data
- Truncate: `salaries`, `advances`, `payments`, `rentals`, `drivers`, `vehicles`, `mc_parkour_scores`, `dhx_dodge_scores`, `user_roles`, `profiles`.
- Delete all `auth.users` rows.
- Empty storage buckets `driver-documents` and `vehicle-photos`.

### 1b. Add `documents` bucket + profile docs table
- Private bucket `profile-documents`.
- Table `profile_documents (id, owner_id, name, path, size, mime, created_at)` with RLS: owner reads/writes own; owner-role reads all.

### 1c. Fix `handle_new_user` trigger (first-user-becomes-owner)
The trigger already does this, but it's not firing for all users (3 of 5 users have no role row). After truncation this is moot, but I'll re-create the trigger explicitly to be safe.

### 1d. Keep existing RLS — it's already correct
- `salaries` SELECT: own row OR owner/manager — ✅
- `advances` SELECT: own row OR staff — ✅
- `user_roles`: owner ALL, user can read own — ✅
- `profiles` SELECT: authenticated true — ✅

The real bug was missing role rows, not the policies. After reset + working trigger, Owner sees all rows.

## 2. Frontend changes

### 2a. Remove all mock-data usage from live pages
- `src/routes/team.tsx`: switch from `employees`/`workerMeta` mock to `profiles` + `user_roles` from Supabase.
- `src/routes/jobs.new.tsx` and `src/routes/jobs.$id.tsx`: load assignable workers from `profiles` filtered by active + worker role.
- `src/routes/profile.tsx`: replace mock `salaries`/`advanceBalance` reads with Supabase queries scoped to current user.
- `src/routes/advance.tsx`: already Supabase-backed — no change.
- `src/routes/salary.tsx`: already Supabase-backed — no change (will work once roles exist).

### 2b. Profile documents (upload / list / download / empty state)
Replace stubbed "2 files" with a real document drawer:
- List from `profile_documents` for `auth.uid()`.
- Upload via `supabase.storage.from('profile-documents').upload(...)` + insert row.
- Download via signed URL.
- Empty state when zero docs.

### 2c. Owner team management (new section under `/team`)
Owner-only panel with:
- Create worker (invite by email via `supabase.auth.admin.inviteUserByEmail` — needs a server function with `supabaseAdmin`).
- Edit name/phone (update `profiles`).
- Change role (insert/delete in `user_roles`: owner ↔ manager ↔ worker, single-role per user).
- Disable / enable (`profiles.is_active`).
- Delete user (server fn → `supabaseAdmin.auth.admin.deleteUser`).
- Reset password (server fn → `supabaseAdmin.auth.admin.generateLink('recovery')`, return link or email).

All admin operations go through `createServerFn` with `requireSupabaseAuth` + `has_role(uid,'owner')` check before invoking `supabaseAdmin`.

## 3. Files touched
- new migration in `supabase/migrations/`
- new `src/lib/admin.functions.ts` (server fns: invite, delete, set-role, reset-password)
- `src/routes/team.tsx` (rewrite — real data, owner mgmt panel)
- `src/routes/jobs.new.tsx`, `src/routes/jobs.$id.tsx` (real worker picker)
- `src/routes/profile.tsx` (real docs, real stats)
- delete/ignore `src/lib/mock-data.ts` (kept only for types until removed)

## 4. After approval
1. Run the reset migration (you approve it).
2. Push frontend changes.
3. You sign up — your account becomes Owner automatically.
4. Verify empty state across all pages.

## 5. Notes / risks
- Deleting auth users invalidates current sessions; everyone is signed out.
- Storage objects deletion is irreversible.
- If you want me to **keep one owner account** through the reset, say which email and I'll exclude it from the wipe.

**Reply "go" to proceed, or tell me which account to preserve.**