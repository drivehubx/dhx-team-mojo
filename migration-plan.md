# Migration Plan — DHX Team Ops → DHX Body & Paint

Scope: rename and align this repository (`dhx-team-mojo`) to the **DHX Body & Paint** brand and confirm correct wiring to the shared Supabase backend (`geykkgepjqelqbkbkuvk`). No data migration. No new backend. No deploy in this plan.

## 0. Status Snapshot (already done)

- ✅ All in-repo "DHX Team Ops" strings replaced with "DHX Body & Paint" (i18n + routes).
- ✅ `supabase/config.toml` `project_id` aligned to runtime ref `geykkgepjqelqbkbkuvk` (stale `guybfeqqrawmkpthsxjh` removed).
- ✅ `.env` runtime values verified — pointing to `geykkgepjqelqbkbkuvk`.
- ✅ `package.json` `name` is generic; no DHX branding to update there.
- ✅ No `README.md` exists yet.

## 1. Documentation (this turn)

- Add `CLAUDE.md`, `architecture.md`, `migration-plan.md`, `shared-entities.md`.
- No code, no migrations.

## 2. Branding Pass (pending approval)

| Item | Action | Owner | Risk |
|---|---|---|---|
| `package.json` `name` → `dhx-body-and-paint` | optional rename | dev | none (local only) |
| `README.md` | create with project summary + link to docs | dev | none |
| Favicon / app icon | swap to Body & Paint mark | design | none |
| `<title>` / OG metadata in `src/routes/__root.tsx` and leaf routes | update to "DHX Body & Paint — …" | dev | low |
| Supabase project **display name** (dashboard) | rename to "DHX Body & Paint (shared)" or "DriveHubX Shared" — cosmetic only | admin | none (does not affect ref/URL/keys) |
| Supabase Auth **email templates** | update sender name + body to "DHX Body & Paint" — **shared across all DHX repos**, coordinate with `dhx-rental` and `dhx-driver` owners | admin | medium (affects sibling repos' emails) |

## 3. Cross-Repo Coordination (before any shared change)

Before any schema, RLS, auth, or email-template change on `geykkgepjqelqbkbkuvk`:

1. Post intent in the shared coordination channel.
2. Confirm `dhx-rental` and `dhx-driver` maintainers ack.
3. Land migration in one repo only; sibling repos pull and regenerate types.
4. Record change in `shared-entities.md` with date + owning repo.

## 4. Explicitly Out of Scope

- ❌ Creating a new Supabase project.
- ❌ Splitting the backend per module.
- ❌ Data export / re-import.
- ❌ Key rotation.
- ❌ Auth provider changes.
- ❌ Deployment / publish.

## 5. Rollback

All changes in §1–§2 are reversible by git revert. No database state is touched, so no DB rollback is required.

## 6. Acceptance Criteria

- [ ] Four docs present at repo root.
- [ ] Zero references to "DHX Team Ops" or `guybfeqqrawmkpthsxjh` anywhere in tracked files.
- [ ] Runtime still reads `geykkgepjqelqbkbkuvk`.
- [ ] Sibling repos unaffected (no shared-entity change in this pass).
