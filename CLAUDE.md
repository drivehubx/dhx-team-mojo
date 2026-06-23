# CLAUDE.md — dhx-team-mojo

Guidance for AI coding assistants (Claude, Lovable, Cursor, etc.) working in this repository.

## Project

- **Business name:** DHX Body & Paint
- **Repository:** `dhx-team-mojo`
- **Role in ecosystem:** Team / operations app for the DHX Body & Paint workshop unit within the DriveHubX ecosystem.
- **Stack:** TanStack Start v1 (React 19, Vite 7), Tailwind v4, Supabase (Lovable Cloud).
- **Deployment target:** Cloudflare Workers (edge) via Lovable.

## Backend — Source of Truth

| Item | Value |
|---|---|
| Supabase project ref | `geykkgepjqelqbkbkuvk` |
| Supabase URL | `https://geykkgepjqelqbkbkuvk.supabase.co` |
| Config location | `.env` (runtime) + `supabase/config.toml` (CLI) |
| Shared with | `dhx-rental`, `dhx-driver` (and other DHX module repos) |

**This is a SHARED backend.** Multiple repositories in the DriveHubX ecosystem read/write to the same Supabase project. Any schema, RLS, or auth change here affects sibling repos.

> Never change `.env`, Supabase URL, keys, or `project_id` in `supabase/config.toml` without explicit human approval. The previously stale ref `guybfeqqrawmkpthsxjh` is **not** valid — do not reintroduce it.

## Hard Rules for AI Agents

1. **Separate repos, shared backend.** Do not merge repos, do not fork the database, do not create a new Supabase project.
2. **No destructive DB ops** without explicit approval: no `DROP`, no `TRUNCATE`, no renaming shared tables, no altering shared columns.
3. **Migrations are global.** Every migration in this repo lands on the shared backend and impacts `dhx-rental` and `dhx-driver`. Coordinate before adding/changing shared entities (see `shared-entities.md`).
4. **Roles live in `core.roles`** (column: `profile_id`). Never query the old `user_roles` table — it belongs to the legacy `public` schema.
5. **Every new public table** must include `GRANT` statements + `ENABLE ROW LEVEL SECURITY` + policies in the same migration.
6. **Server logic** uses `createServerFn` (TanStack Start). Webhooks/public APIs go under `src/routes/api/public/*` with signature verification. Do not add Supabase Edge Functions for app-internal logic.
7. **Branding:** UI strings say "DHX Body & Paint". Do not reintroduce "DHX Team Ops".
8. **No code, no deploy, no migration** unless the user asks for it in the current turn.

## File Conventions

- Routes: `src/routes/*.tsx` (flat, dot-separated). Do not edit `src/routeTree.gen.ts`.
- Server functions: `src/lib/*.functions.ts` (client-safe path) + `*.server.ts` helpers.
- Supabase clients: `@/integrations/supabase/client` (browser), `@/integrations/supabase/client.server` (admin, server-only).
- i18n: `src/lib/i18n.tsx`.

## Related Documents

- `architecture.md` — ecosystem + module topology
- `migration-plan.md` — rollout steps for the Body & Paint rename / alignment
- `shared-entities.md` — tables and policies shared across DHX repos
