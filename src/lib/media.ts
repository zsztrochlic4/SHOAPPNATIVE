import { storageBucket } from './firebase'

/**
 * Public URLs for media stored in Cloud Storage.
 *
 * Objects under `exercises/` are world-readable (see storage.rules), so we can
 * link them with a plain, cacheable URL — no per-file token or async lookup.
 * Upload files from the Firebase console into an `exercises/` folder named by
 * exercise id (e.g. `exercises/bench.mp4`, `exercises/bench.jpg`) and they show
 * up automatically on that exercise.
 */
const BASE = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o`

/**
 * The squat poster lives under `Thumbnails/`, which (unlike `exercises/`) is NOT world-readable in
 * storage.rules, so a plain tokenless URL 403s. The stable download token makes it public without a
 * rules change. (Move the file under `exercises/` and drop the token if you'd rather it be public.)
 */
const SQUAT_POSTER = `${BASE}/${encodeURIComponent('Thumbnails/squating.avif')}?alt=media&token=79348317-78ff-4839-9ced-e8bd21769f62`

/**
 * Per-exercise media overrides. Handy for demoing/reusing a clip across several exercises, or when a
 * file doesn't follow the `{id}` naming convention. A `poster` that already starts with `http` is used
 * verbatim; otherwise it's a bucket-relative path resolved to a public URL.
 */
const OVERRIDES: Record<string, { video?: string; poster?: string }> = {
  // Barbell Back Squat (backend DB id) — the real uploaded image + form clip.
  QD01: { video: 'exercises/squat.mp4', poster: SQUAT_POSTER },
  // Demo-catalogue ids reused for the same clip while other media is uploaded.
  squat: { video: 'exercises/squat.mp4', poster: SQUAT_POSTER },
  bench: { video: 'exercises/squat.mp4', poster: SQUAT_POSTER },
  incline: { video: 'exercises/squat.mp4', poster: SQUAT_POSTER },
  shoulder: { video: 'exercises/squat.mp4', poster: SQUAT_POSTER },
}

/** Build a public download URL for a storage path like `exercises/bench.mp4`. */
export function storageUrl(path: string): string {
  return `${BASE}/${encodeURIComponent(path)}?alt=media`
}

const resolvePoster = (p: string): string => (p.startsWith('http') ? p : storageUrl(p))

/** Looping form-clip URL for an exercise (upload as `exercises/{id}.mp4`). */
export function exerciseVideo(id: string): string {
  return storageUrl(OVERRIDES[id]?.video ?? `exercises/${id}.mp4`)
}

/** Poster/thumbnail URL for an exercise (upload as `exercises/{id}.jpg`). */
export function exercisePoster(id: string): string {
  const o = OVERRIDES[id]?.poster
  return o ? resolvePoster(o) : storageUrl(`exercises/${id}.jpg`)
}

/** The uploaded poster URL for an exercise IF one is configured, else null — so callers can prefer
 *  a real photo over the generic muscle-group placeholder image. */
export function posterOverrideUrl(id: string): string | null {
  const o = OVERRIDES[id]?.poster
  return o ? resolvePoster(o) : null
}

/** True when an exercise has a real uploaded form clip configured (not the `{id}.mp4` convention
 *  guess), so the UI can decide whether to surface a video affordance. */
export function hasVideoOverride(id: string): boolean {
  return !!OVERRIDES[id]?.video
}
