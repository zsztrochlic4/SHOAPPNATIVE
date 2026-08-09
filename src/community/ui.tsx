/**
 * Shared presentational bits for the community hub: rank badges, streak + score
 * indicators and number formatting. Kept together so the leaderboard and group
 * screens render identical-looking rows.
 */
import { View, Text } from 'react-native'
import { Flame } from 'lucide-react-native'
import { useColors } from '../theme'

/* -------------------------------- reactions -------------------------------- */

/** The fixed set of emoji reactions offered on group activity events. Order is
 *  the order they appear in the picker and as count pills. */
export const REACTION_EMOJIS = ['💪', '🔥', '👏', '🙌', '⚡', '🏆'] as const

/* --------------------------------- numbers --------------------------------- */

/** "18,400" — thousands-separated integer. */
export function formatKg(kg: number): string {
  return Math.round(kg).toLocaleString('en-US')
}

/** Compact weight for tight leaderboard columns: "18.4k" above 10,000, else the
 *  thousands-separated figure. Always suffixed with the unit by the caller. */
export function formatKgCompact(kg: number): string {
  const n = Math.round(kg)
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

/* ------------------------------- odometer band ----------------------------- */

/** Mirror of selectors.weeklyIndex banding for a raw 0..100 score, so a member's
 *  odometer chip is coloured on the same scale as the dashboard gauge. */
export function odometerColor(score: number, c: ReturnType<typeof useColors>): string {
  if (score >= 62) return c.brand400
  if (score >= 44) return c.brand500
  if (score >= 28) return c.accentOrange
  return c.danger
}

/* --------------------------------- rank badge ------------------------------ */

const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#F5C518', fg: '#1a1500' }, // gold
  2: { bg: '#C7CDD6', fg: '#14181f' }, // silver
  3: { bg: '#D08B4E', fg: '#1c1206' }, // bronze
}

/** Rank indicator: a filled medal disc for the top three, a muted "#n" otherwise. */
export function RankBadge({ rank, size = 30 }: { rank: number; size?: number }) {
  const medal = MEDAL[rank]
  if (medal) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: medal.bg }}
        className="items-center justify-center"
      >
        <Text style={{ color: medal.fg, fontSize: size * 0.42 }} className="font-black">{rank}</Text>
      </View>
    )
  }
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Text className="text-[13px] font-bold text-secondary">{rank}</Text>
    </View>
  )
}

/* ------------------------------- streak flame ------------------------------ */

/** Flame + day count. Brightens once a streak is genuinely established. */
export function StreakFlame({ days, size = 15 }: { days: number; size?: number }) {
  const colors = useColors()
  const hot = days >= 7
  const color = hot ? colors.accentOrange : 'rgba(255,255,255,0.4)'
  return (
    <View className="flex-row items-center gap-1">
      <Flame size={size} color={color} fill={hot ? color : 'none'} />
      <Text className="text-[13px] font-bold" style={{ color: hot ? colors.fg : 'rgba(255,255,255,0.6)' }}>{days}</Text>
    </View>
  )
}
