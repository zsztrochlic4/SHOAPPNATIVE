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
 * Per-exercise media overrides. Handy for demoing/reusing a clip across several
 * exercises, or when a file doesn't follow the `{id}` naming convention.
 * Paths are relative to the bucket root (e.g. `Thumbnails/squating.avif`).
 */
const OVERRIDES: Record<string, { video?: string; poster?: string }> = {
  // Uploaded test assets, shown on a few exercises to verify media end-to-end.
  squat: { video: 'exercises/squat.mp4', poster: 'Thumbnails/squating.avif' },
  bench: { video: 'exercises/squat.mp4', poster: 'Thumbnails/squating.avif' },
  incline: { video: 'exercises/squat.mp4', poster: 'Thumbnails/squating.avif' },
  shoulder: { video: 'exercises/squat.mp4', poster: 'Thumbnails/squating.avif' },
}

/** Build a public download URL for a storage path like `exercises/bench.mp4`. */
export function storageUrl(path: string): string {
  return `${BASE}/${encodeURIComponent(path)}?alt=media`
}

/** Looping form-clip URL for an exercise (upload as `exercises/{id}.mp4`). */
export function exerciseVideo(id: string): string {
  return storageUrl(OVERRIDES[id]?.video ?? `exercises/${id}.mp4`)
}

/** Poster/thumbnail URL for an exercise (upload as `exercises/{id}.jpg`). */
export function exercisePoster(id: string): string {
  return storageUrl(OVERRIDES[id]?.poster ?? `exercises/${id}.jpg`)
}
