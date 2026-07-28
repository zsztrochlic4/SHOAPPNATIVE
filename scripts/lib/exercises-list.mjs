// Shared: read the exercise id + name list from the generated exercise DB, and
// the folder-name mapping used across the media scripts + the app (src/lib/media.ts).
// Folder = the exercise's readable NAME (verified path-safe: no slashes).

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function readExercises() {
  const p = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'backend', 'data', 'exercises.ts')
  const src = readFileSync(p, 'utf8')
  const ids = [...src.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1])
  const names = [...src.matchAll(/"name":\s*"([^"]+)"/g)].map((m) => m[1])
  const muscles = [...src.matchAll(/"muscleGroup":\s*"([^"]+)"/g)].map((m) => m[1])
  return ids.map((id, i) => ({ id, name: names[i] || id, muscle: muscles[i] || '' }))
}

/** Storage folder name for an exercise. Keep in sync with folderFor() in src/lib/media.ts. */
export const folderFor = (name) => name
