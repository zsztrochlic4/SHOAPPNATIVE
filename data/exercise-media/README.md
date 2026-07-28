# Exercise media drop folder

Put workout **form-clip videos** and **thumbnail images** here, then run one
command to publish them. They appear in the app **without an App Store release**
(same idea as the recipe pipeline).

## How to use

1. **Name each file by the exercise id.** The file name (without extension) must
   match the exercise's id. The uploader files them into that exercise's folder
   automatically (`{id}.mp4` → `exercises/{id}/video.mp4`, `{id}.jpg` →
   `exercises/{id}/thumb.jpg`). Examples:
   - `CH01.mp4` → form clip on Barbell Bench Press
   - `CH01.jpg` → thumbnail on Barbell Bench Press

   Full id → exercise list: [`docs/EXERCISE_MEDIA_CHECKLIST.md`](../../docs/EXERCISE_MEDIA_CHECKLIST.md).
   (Or upload straight in the Firebase console — see that checklist.)

2. **Supported types:**
   - Video: `.mp4` (best), `.mov`, `.webm`, `.m4v`
   - Image: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`

3. **Preview what will upload** (no login needed):
   ```
   npm run media:upload
   ```

4. **Upload for real** (needs your service-account key):
   ```
   # PowerShell:
   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
   npm run media:upload -- --apply
   ```

The files go to the public `exercises/` folder in Cloud Storage and show up on the
matching exercise the next time the app is opened.

## Notes
- The actual media files are **not committed to git** (only this README is) — they
  live in Cloud Storage, not the repo.
- To replace a clip/thumbnail, just upload a file with the same name again.
- For an exception (e.g. reusing one clip across exercises, or a file that doesn't
  follow the `{id}` name), edit the `OVERRIDES` map in `src/lib/media.ts`.
