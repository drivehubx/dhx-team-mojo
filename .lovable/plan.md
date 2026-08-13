# Team Screen Audit — findings and proposed fixes

Scope: `src/routes/team.tsx` (list + Add Team Member dialog) and `src/routes/team.$id.tsx` (member detail), plus the shared hooks in `src/lib/team.ts`.

## What is working well

- Both routes are gated by `WorkspaceGate`, admin-only actions (Add Team Member, role/position/engagement edits, deactivate) are correctly behind `isAdmin` from `useWorkspace`.
- All writes go through `core` RPCs (`invite_crew`, `set_member_role`, `set_member_positions`, `set_member_engagement`, `set_member_active`) — no direct table writes, no admin key in the browser.
- Terminology is consistently "Team Member"; owner role is correctly non-reassignable in the UI.
- Mobile-first layout, semantic tokens only (no hardcoded colours), sensible query invalidation after each mutation.

## Issues found

### 1. Hardcoded invite URL (highest priority)
`team.tsx` lines 298 and 307 build the activation link from a literal `https://dhx-workshop.lovable.app`. This breaks the workspace rule against hardcoded domains and produces the wrong link on the custom domain and in preview.
Fix: derive the origin at runtime (`window.location.origin`) so the invite link always matches where the app is actually running.

### 2. WhatsApp invite number is not normalised
`phone.replace(/\D/g, "")` sends a local number such as `016-349-3499` to `wa.me/0163493499`, which WhatsApp rejects.
Fix: normalise Malaysian local numbers to international form (leading `0` → `60`) before building the `wa.me` link; leave already-international numbers untouched.

### 3. Load errors are shown as "no results"
The list ignores `dir.error`; a failed fetch renders "No team members match these filters." Same on the detail page, where an error renders "Team member not found."
Fix: render a distinct error state with a Retry button on both screens.

### 4. Unsaved position edits get silently reset
`team.$id.tsx` `useEffect` depends on `q.data?.positions`, a fresh array on every refetch, so any background refetch wipes in-progress selections.
Fix: key the effect on the member id (and a stable signature of the saved positions) so it only re-syncs when the saved data actually changes.

### 5. Non-admins get no explanation for disabled controls
Role / position / engagement buttons render greyed out at `opacity-70` with no reason given — this is the grey, "dead" look on these cards.
Fix: show a single short read-only notice for non-admins and drop the greyed-out interactive styling so the sections read as information, not broken buttons.

### 6. Engagement type cannot be cleared
The RPC accepts `null` but the UI only allows selecting a value.
Fix: allow tapping the selected engagement to clear it.

### 7. Dead prop
`MemberCard` takes `clickable`, but the only call site passes `true`; the `!clickable` branch (and the conditional chevron you selected) is unreachable.
Fix: remove the prop and always render as a link with the chevron.

### 8. Search misses positions
Search covers name / phone / email only.
Fix: include position labels and engagement label in the haystack.

### 9. Metadata gaps
`/team` has title + description but no `og:title`/`og:description`; `/team/$id` has only a title.
Fix: complete the `head()` meta on both routes.

### 10. Minor
- `initialsOf` is duplicated in both files while `src/components/Avatar.tsx` exists — consolidate.
- Team screens are English-only while the rest of the app is multilingual. Flagging only; I will not touch the language module or add translations unless you ask.

## Technical notes

Changes are confined to `src/routes/team.tsx`, `src/routes/team.$id.tsx`, and possibly a small shared helper for phone normalisation. No database migration, no RPC change, no backend or schema change, no change to the learning/language module.

## Suggested order

1. Items 1–3 (invite link, WhatsApp number, error states) — correctness bugs.
2. Items 4–6 (position reset, read-only clarity, clearable engagement) — behaviour.
3. Items 7–9 (cleanup, search, metadata).
