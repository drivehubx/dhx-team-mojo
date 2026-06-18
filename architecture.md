# Architecture — DHX Body & Paint (`dhx-team-mojo`)

## 1. Position in the DriveHubX Ecosystem

DriveHubX is a modular ecosystem of independent apps that share a controlled backend layer. This repository (`dhx-team-mojo`) is the **DHX Body & Paint** workshop operations app, part of the workshop ecosystem alongside Exomotif, GK Auto, and DHX Rebuild & Bodyworks.

```text
                      ┌────────────────────────────┐
                      │   Master Identity Layer    │
                      │   Master Vehicle Registry  │
                      │   Audit Registry           │
                      └─────────────┬──────────────┘
                                    │
        ┌───────────────────┬───────┴────────┬───────────────────┐
        │                   │                │                   │
   MY Garage           DriveHubX        Workshop Eco       External Services
  (private)         (fleet/rental)     (this layer)         (insurance, tow…)
                                              │
              ┌───────────────┬───────────────┼───────────────┐
              │               │               │               │
         Exomotif        GK Auto      DHX Body & Paint   DHX Rebuild
                                      (dhx-team-mojo)
```

## 2. Repository Topology

| Repo | Module | Backend |
|---|---|---|
| `dhx-team-mojo` (this) | DHX Body & Paint — team ops | shared Supabase `geykkgepjqelqbkbkuvk` |
| `dhx-rental` | DHX Rental — bookings, deposits | shared Supabase `geykkgepjqelqbkbkuvk` |
| `dhx-driver` | DHX Driver — driver app | shared Supabase `geykkgepjqelqbkbkuvk` |

**Principle:** *Separate repos, shared backend.* Each repo ships its own UI, routes, and server functions, but all read/write to one Supabase project. This preserves repo-level independence (deploys, releases, ownership) while keeping the ecosystem's identity, vehicle, and audit data unified.

## 3. Runtime Stack (this repo)

- **Framework:** TanStack Start v1 (React 19, Vite 7), SSR on Cloudflare Workers.
- **Routing:** File-based under `src/routes/`. `routeTree.gen.ts` is generated.
- **Styling:** Tailwind v4 via `src/styles.css`.
- **Data layer:** TanStack Query, loader → `ensureQueryData` → `useSuspenseQuery`.
- **Server logic:** `createServerFn` from `@tanstack/react-start`. Auth-gated functions use `requireSupabaseAuth` middleware.
- **Public APIs / webhooks:** `src/routes/api/public/*` (auth bypassed; verify signatures in handler).
- **i18n:** `src/lib/i18n.tsx`, all UI strings keyed.

## 4. Supabase Layer (shared)

| Concern | Detail |
|---|---|
| Project ref | `geykkgepjqelqbkbkuvk` |
| Browser client | `@/integrations/supabase/client` — publishable key, RLS as user |
| Server (user) | `requireSupabaseAuth` middleware — RLS as authenticated user |
| Server (admin) | `@/integrations/supabase/client.server` (`supabaseAdmin`) — service role, bypasses RLS, server-only, dynamic import inside handlers |
| Storage buckets | `driver-documents`, `vehicle-photos` (shared) |
| Auth | Supabase Auth — email templates managed in Supabase dashboard (shared across repos) |

## 5. Domain Boundary for This Repo

`dhx-team-mojo` owns the UI and module-specific tables for **Body & Paint team operations**:

- Workshop jobs (intake, quotation, approval, work-in-progress, QC, release)
- Team members / shifts / advances / salary (within Body & Paint scope)
- Job-level documents, photos, inspection notes
- Skills, learning, internal team profile within this module

It **consumes but does not own**:

- `auth.users`, `profiles`, `user_roles` — Master Identity
- `vehicles`, `master_vehicles` — Master Vehicle Registry
- Cross-module audit tables

See `shared-entities.md` for the full list and ownership rules.

## 6. Status & Audit

Vehicle status transitions originate in the owning module (MY Garage → DriveHubX → Workshop). This repo records workshop-side status events (`Under Repair`, QC pass/fail, release) and appends to the shared audit registry — never mutates statuses owned elsewhere.

## 7. Non-Goals

- No new Supabase project.
- No monorepo consolidation.
- No direct DB access from one module's UI to another module's private tables — cross-module reads go through agreed shared entities or future RPCs.
