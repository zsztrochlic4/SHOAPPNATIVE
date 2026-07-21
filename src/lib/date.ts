/** Date helpers. All dates handled as local 'YYYY-MM-DD' keys. */

/**
 * The clock.
 *
 * The demo (seeded "Alex" history) is pinned to a frozen instant so the 40-day
 * history and the curated week narrative always line up. Real onboarded users
 * run on the live device clock, so the greeting, "today", the week strip and the
 * workout-day mapping all track real local time.
 *
 * `todayKey` is exported as a live binding: `setLiveClock` / `refreshClock`
 * reassign it, and every importer sees the new value on its next read (ESM live
 * bindings). Anything time-relative (`dayKey`, `currentWeekKeys`, `currentHour`)
 * reads the mutable `_now`, so it re-derives automatically.
 */
export const DEMO_NOW = new Date('2026-06-07T09:41:00')

let _live = false
let _now: Date = DEMO_NOW

export function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Live-updating key for "today". Reassigned by setLiveClock / refreshClock. */
export let todayKey = toKey(_now)

/** The current "now" instant (frozen in demo, live otherwise). */
export function now(): Date {
  return _now
}

/** Current hour 0–23 in device local time (frozen at 9 in demo). */
export function currentHour(): number {
  return _now.getHours()
}

/** Point the clock at real device time (live) or the frozen demo instant. */
export function setLiveClock(live: boolean): boolean {
  _live = live
  return refreshClock()
}

/**
 * Recompute "now" from the active source. Call on app launch, on app-foreground,
 * and across a date rollover. Returns true if the day key changed, so callers can
 * force a re-render.
 */
export function refreshClock(): boolean {
  const prev = todayKey
  _now = _live ? new Date() : DEMO_NOW
  todayKey = toKey(_now)
  return todayKey !== prev
}

export function fromKey(key: string): Date {
  return new Date(key + 'T00:00:00')
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Key for `n` days before now (n=0 → today). */
export function dayKey(n: number): string {
  return toKey(addDays(_now, -n))
}

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

/** The 7 day keys (Mon..Sun) of the week containing now. */
export function currentWeekKeys(): string[] {
  const dow = (_now.getDay() + 6) % 7 // Mon = 0
  const monday = addDays(_now, -dow)
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(monday, i)))
}
