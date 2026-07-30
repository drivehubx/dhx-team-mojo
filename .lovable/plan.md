# Facebook video cards — open verified share link, explain no embed

Scope: `src/routes/learning.tsx` only. Frontend/presentation change. No DB, no schema, no changes to the language/learning data model.

## What changes

1. **Facebook detection**
   Add a small helper that treats an item as Facebook when `source === "facebook"` or the URL host matches `facebook.com`, `m.facebook.com`, `fb.watch`, or `fb.me`.

2. **Verified share link**
   Before opening, normalise and verify the link:
   - must be a valid `http`/`https` URL (existing `isValidHttpUrl`)
   - must be a recognised Facebook host from the list above
   - normalise `m.facebook.com` / `web.facebook.com` to `www.facebook.com` and strip tracking params (`fbclid`, `mibextid`, `rdid`, etc.) so the shared link is clean
   If it fails verification, no navigation happens — an error toast says the link is invalid and should be re-added.

3. **Always open in a new tab**
   Verified Facebook links open with `window.open(url, "_blank", "noopener,noreferrer")`. Tapping the card still marks the item as viewed as it does today.

4. **Clear explanation on the card**
   Replace the current one-line Facebook note with an explicit, translated notice: Facebook blocks in-app embedding, so the video opens on Facebook in a new tab. Card body shows a Facebook icon tile (no thumbnail attempt, since Facebook does not expose one) plus an "Opens on Facebook" affordance on the play button area.

5. **Invalid Facebook links**
   Cards whose link fails verification show the existing destructive "Invalid or missing link" style message, with wording pointing at editing/re-adding the link.

All new strings go through `tr()`, matching the existing pattern.

## Not in scope
- No changes to YouTube handling, progress tracking, add/delete flows, or dictionaries beyond the new `tr()` keys falling back to English.
