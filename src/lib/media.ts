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

/** Build a public download URL for a storage path like `exercises/bench.mp4`. */
export function storageUrl(path: string): string {
  return `${BASE}/${encodeURIComponent(path)}?alt=media`
}

/** Looping form-clip URL for an exercise (upload as `exercises/{id}.mp4`). */
export function exerciseVideo(id: string): string {
  return storageUrl(`exercises/${id}.mp4`)
}

/** Poster/thumbnail URL for an exercise (upload as `exercises/{id}.jpg`). */
export function exercisePoster(id: string): string {
  return storageUrl(`exercises/${id}.jpg`)
}
