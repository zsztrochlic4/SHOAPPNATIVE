import type { Units } from '../store/types'

const KG_TO_LB = 2.2046226218
const L_TO_OZ = 33.814

/** Convert a weight in kg to the user's unit value (number only). */
export function weightVal(kg: number, units: Units): number {
  return units === 'imperial' ? kg * KG_TO_LB : kg
}

export function weightUnit(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg'
}

/** Display a kg weight in the chosen units, e.g. "72.4 kg" / "159.6 lb". */
export function fmtWeight(kg: number, units: Units, dp = 1): string {
  const v = weightVal(kg, units)
  return `${v.toFixed(dp)} ${weightUnit(units)}`
}

/** Display just the number portion of a kg weight in chosen units. */
export function fmtWeightNum(kg: number, units: Units, dp = 1): string {
  return weightVal(kg, units).toFixed(dp)
}

/** Parse a user-entered weight (in their units) back into kg for storage. */
export function toKg(value: number, units: Units): number {
  return units === 'imperial' ? value / KG_TO_LB : value
}

export function fmtVolume(kg: number, units: Units): string {
  if (units === 'imperial') return `${Math.round(kg * KG_TO_LB).toLocaleString()} lb`
  return `${Math.round(kg).toLocaleString()} kg`
}

export function fmtFluid(litres: number, units: Units): string {
  if (units === 'imperial') return `${Math.round(litres * L_TO_OZ)} oz`
  return `${litres.toFixed(1)} L`
}

export function fluidUnit(units: Units): string {
  return units === 'imperial' ? 'oz' : 'L'
}

export function pct(n: number, d: number): number {
  if (d <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)))
}

export function compactNum(n: number): string {
  return n.toLocaleString()
}
