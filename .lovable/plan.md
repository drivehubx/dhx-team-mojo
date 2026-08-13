# Team screen: audit fixes 1–9 + full Team Member edit

## Backend audit result (read-only checks, nothing changed)

What the existing layer already allows, verified against `core`:

| Field | Path available today | Who |
|---|---|---|
| Full name, Phone, Email, Avatar URL, Notes, Emergency contact | direct `UPDATE core.profiles` — `authenticated` has UPDATE, RLS policy `profiles_update` allows self or `core.is_owner_or_manager()` (role rank >= 70 = owner / administrator / manager) | Owner, Administrator, Manager |
| Permission Role | `core.set_member_role` | admin; refuses owner and anyone at/above your own rank |
| Positions (multiple) | `core.set_member_positions(profile_id, uuid[])` | admin |
| Engagement type | `core.set_member_engagement` (accepts null) | admin |
| Active / Inactive | `core.set_member_active` | admin; refuses self and owner |

So **all requested fields except avatar image upload are already safely editable** with no new RPC, no RLS change, no schema change.

Fields that need a backend change (NOT doing now, reporting only):
- **Avatar photo upload.** `avatar_url` text is writable, but there is no public avatar bucket; existing buckets (`staff-documents`, `dhx-docs`) are private and would need storage policies + signed-URL handling. Smallest change: one storage bucket for member avatars with an owner/admin-write, workspace-read policy. Until then the edit sheet will offer an avatar image **URL** field only.
- **`notes` / `emergency_contact`** exist on `core.profiles` but are not exposed by the `core.team_directory` view. Rather than change the shared view, the edit sheet reads those two columns straight from `core.profiles` (SELECT is workspace-scoped) and only for admins. No backend change needed.
- Observation, not a fix: `anon` holds an UPDATE grant on `core.profiles`; RLS blocks it (`current_workspace_id()` is null for anon), so it is not exploitable, but the grant is wider than needed. Flagging for the shared-backend owners; not touching it here.

Role and Position stay strictly separate — Position never affects permissions anywhere in this work.

## Work to build

### A. Audit fixes 1–9 (from the earlier audit)
1. Invite link uses `window.location.origin` instead of the hardcoded `dhx-workshop.lovable.app`.
2. WhatsApp invite number normalised to international form (leading `0` → `60`).
3. Real error states with Retry on both `/team` and `/team/$id`, instead of "no results" / "not found".
4. Position selection no longer reset by background refetches.
5. No greyed-out fake controls for non-admins — clean read-only presentation.
6. Engagement type can be cleared (tap the selected one).
7. Remove the dead `clickable` prop on `MemberCard`; always a link with the chevron.
8. Search also matches position and engagement labels.
9. Complete `head()` meta (og:title / og:description) on both routes.

Plus: consolidate the duplicated `initialsOf` helper.

### B. `/team/$id` becomes a real management screen
- Read-only profile view for everyone: avatar, name, phone, email, role badge, positions, engagement, status, activity stats. Phone and email become tap-to-call / tap-to-mail links.
- Owner/Administrator/Manager get a single **Edit** button in the header that opens one full-screen edit sheet (mobile-first), replacing today's scattered inline controls.
- Edit sheet sections:
  - **Details** — full name (required), phone, email, avatar image URL, notes, emergency contact.
  - **Permission Role** — Administrator / Manager / Supervisor / Team Member, with a short "controls access" caption. Owner shown locked and non-assignable, as the database enforces.
  - **Positions** — multi-select chips from `core.positions` (Mechanic, Painter, Panel Beater, Helper, and whatever else is active), captioned "what they do — does not affect access".
  - **Engagement type** — single select, clearable.
  - **Status** — Active / Inactive toggle; deactivation keeps its confirmation dialog. Hidden for yourself and for the owner, matching the database rules.
- One **Save Changes** button diffs against loaded values and only calls the paths that actually changed (profile update + the relevant RPCs), with per-field validation (name non-empty, email shape, avatar must be an http(s) URL), a pending state, one success toast, and a per-failure error toast naming what failed. **Cancel** discards everything.
- Because role/status rules live in the database, a rejected change surfaces the database's own message (e.g. "You cannot modify someone at or above your own System Role") rather than being pre-hidden incorrectly.

## Technical notes

Files touched: `src/routes/team.tsx`, `src/routes/team.$id.tsx`, `src/lib/team.ts` (add a `useUpdateMemberProfile` mutation + an admin-only fetch of `notes`/`emergency_contact`), a new `src/components/team-member-edit-sheet.tsx`, and a small phone-normalisation helper. `src/integrations/supabase/shared-schema.ts` gains the extra profile field types only.

No migration, no RPC change, no RLS change, no schema change, no changes to the language/learning module or other screens. If avatar upload or anything else turns out to require a backend change, I will stop and ask first.
