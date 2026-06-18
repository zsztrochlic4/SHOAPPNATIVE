/** Date helpers — all dates handled as local 'YYYY-MM-DD' keys. */

/** The app's "today". Fixed so the seeded 40-day history lines up with the demo. */
export const TODAY = new Date('2026-06-07T09:41:00')

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromKey(key: string): Date {
  return new Date(key + 'T00:00:00')
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Key for `n` days before TODAY (n=0 → today). */
export function dayKey(n: number): string {
  return toKey(addDays(TODAY, -n))
}

export const todayKey = toKey(TODAY)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function shortDate(key: string): string {
  const d = fromKey(key)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function weekday(key: string): string {
  return WEEKDAYS[fromKey(key).getDay()]
}

export function longDate(key: string): string {
  const d = fromKey(key)
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** Human relative label: Today / Yesterday / Mon 12 etc. */
export function relativeLabel(key: string): string {
  if (key === todayKey) return 'Today'
  if (key === dayKey(1)) return 'Yesterday'
  return shortDate(key)
}

/** The 7 day keys (Mon..Sun) of the week containing TODAY. */
export function currentWeekKeys(): string[] {
  const dow = (TODAY.getDay() + 6) % 7 // Mon = 0
  const monday = addDays(TODAY, -dow)
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(monday, i)))
}
