# Shared Entities — DriveHubX Backend (`geykkgepjqelqbkbkuvk`)

This document lists database entities that are **shared across DHX repos** (`dhx-team-mojo`, `dhx-rental`, `dhx-driver`, …) and the rules for changing them.

> Golden rule: changes to shared entities require coordination across all consuming repos. A migration landing in one repo affects every repo pointing at the same Supabase project.

## 1. Ownership Model

| Layer | Owns | Consumers |
|---|---|---|
| **Master Identity** | `auth.users`, `profiles`, `user_roles`, `app_role` enum, `has_role()` | all repos |
| **Master Vehicle Registry** | `vehicles` (and future `master_vehicles`, linkage tables) | all repos |
| **Audit Registry** | cross-module audit/event tables | all repos |
| **Module-private** | tables prefixed or scoped to a single module (e.g. workshop jobs for Body & Paint) | only that module's repo |

## 2. Confirmed Shared Tables (current state)

> Verified against runtime project `geykkgepjqelqbkbkuvk`. Update this table whenever a shared entity is added or changed.

| Table | Purpose | Owning concept | Notes |
|---|---|---|---|
| `profiles` | per-user profile (display name, locale, etc.) | Master Identity | **No role column.** Roles live in `user_roles`. |
| `user_roles` | `(user_id, role)` with `app_role` enum | Master Identity | Read via `has_role(uid, role)` security-definer function. Grants: `authenticated` SELECT, `service_role` ALL. |
| `drivers` | driver records | DriveHubX / DHX Driver | Read by Rental + Driver apps. |
| `vehicles` | fleet vehicle records | Master Vehicle Registry | Read by all DHX modules; writes coordinated. |
| `rentals` | rental bookings | DHX Rental | Other repos read-only. |
| `advances` | cash advances | DHX Rental / Ops | Body & Paint module may read for staff in its scope. |
| `salaries` | salary records | Ops | Module-scoped writes. |

Storage buckets (shared):

| Bucket | Purpose |
|---|---|
| `driver-documents` | driver licence, ID, etc. |
| `vehicle-photos` | vehicle photos across modules |

## 3. Module-Private (this repo, `dhx-team-mojo`)

Body & Paint–specific tables (jobs, quotations, QC inspections, parts usage, body-shop photos) are owned by this repo. They may reference shared keys (`vehicle_id`, `user_id`) but their schema and RLS are managed here.

> When adding a module-private table, prefer a clear name prefix (e.g. `bp_jobs`, `bp_quotations`) to make ownership obvious in the shared schema.

## 4. RLS & Grants Pattern (mandatory)

Every new public-schema table — shared or module-private — must include in the same migration:

```sql
CREATE TABLE public.<name> (...);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;
GRANT ALL ON public.<name> TO service_role;
-- GRANT SELECT ON public.<name> TO anon;  -- only for truly public data

ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY ... ON public.<name> ...;
```

Role checks in policies use `public.has_role(auth.uid(), 'admin')` — never query `user_roles` directly inside a policy.

## 5. Change Protocol for Shared Entities

1. **Propose** the change in the shared coordination channel with: SQL diff, affected repos, rollback.
2. **Get ack** from at least one maintainer per consuming repo.
3. **Land** the migration in exactly one repo; record the migration filename and date below.
4. **Sibling repos** pull and regenerate Supabase types.
5. **Log** the change in §6.

## 6. Shared-Entity Change Log

| Date | Repo | Migration | Summary | Coordinated with |
|---|---|---|---|---|
| 2026-06-15 | (existing) | initial schema | profiles, user_roles, drivers, vehicles, rentals, advances, salaries | n/a |
| _add entries here_ | | | | |

## 7. Anti-Patterns (do not do)

- ❌ Adding a `role` column to `profiles`.
- ❌ Reading another module's private tables directly from this repo's UI.
- ❌ Bypassing RLS in browser code with admin keys.
- ❌ Renaming a shared table or column without coordination.
- ❌ Creating a parallel Supabase project to "isolate" a module — use schema + RLS instead.
