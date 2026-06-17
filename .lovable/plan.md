## Rename display brand: DHX Team Ops → DHX Body & Paint

Update the user-facing brand name everywhere it currently reads "DHX Team Ops" in English. Translations in Chinese / Malay / Indonesian dictionaries keep "DHX Team Ops" as the brand string (per your choice), so the brand only changes in the English source.

No backend, no schema, no Supabase config changes. Pure presentation update.

### Files to edit

1. **`src/lib/i18n.tsx`**
   - Line 1124: `"common.brand": "DHX Team Ops"` → `"DHX Body & Paint"`
   - Line 1176: header text in `LanguageModal` → `"DHX Body & Paint"`
   - Lines 19, 372, 710 (ZH/MS/ID dicts): keep the EN key `"DHX Team Ops"` mapping as-is for now — but since we're changing the source string, replace the key with `"DHX Body & Paint"` on both sides so the dictionary still resolves. (Net: no visible change in non-EN.)

2. **Route `head().meta` titles** — replace `"… — DHX Team Ops"` with `"… — DHX Body & Paint"`:
   - `src/routes/index.tsx` (title + description)
   - `src/routes/login.tsx` (title + description)
   - `src/routes/jobs.index.tsx`
   - `src/routes/jobs.new.tsx`
   - `src/routes/jobs.$id.tsx`
   - `src/routes/team.tsx`
   - `src/routes/skills.tsx`
   - `src/routes/learning.tsx`
   - `src/routes/salary.tsx`
   - `src/routes/advance.tsx`
   - `src/routes/profile.tsx`
   - `src/routes/settings.tsx`

### Not changing
- `.env`, `supabase/config.toml`, project ref, keys
- Database, RLS, roles
- Nav structure, routes, components beyond text
- The literal `"DHX"` short label in `login.tsx` header and `"DHX · v1.0"` footer (already short brand)

### Verification
- Build passes
- Header shows "DHX Body & Paint" above page title on every screen
- Browser tab titles read e.g. "Dashboard — DHX Body & Paint"
