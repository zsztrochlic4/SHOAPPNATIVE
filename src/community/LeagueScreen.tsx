/**
 * The League tab: the headline competitive surface. Leads with the user's own
 * weekly standing (tier, rank, points, days left, promotion/demotion status),
 * a forgiving-streak card (Recommendation 2), then the ranked cohort with clearly
 * labelled promotion / safe / demotion zones. A "My league / Global" toggle keeps
 * the full streak board one tap away, and a "How leagues work" sheet keeps it
 * legible. Browse-first: no username → the browseable global board + claim prompt.
 */
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Trophy, Snowflake, Moon, Info, ChevronRight, ArrowUp, ArrowDown, ShieldCheck, Clock, UserPlus, Users } from 'lucide-react-native'
import { useStore } from '../store/store'
import { myLeaderStats, streakRisk } from '../store/selectors'
import { todayKey } from '../lib/date'
import { shareText } from '../lib/share'
import { useColors, brand } from '../theme'
import { Avatar } from '../components/Avatar'
import { Sheet } from '../components/Sheet'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { RankBadge, StreakFlame } from './ui'
import { GlobalLeaderboard } from './GlobalLeaderboard'
import { TIERS, tierOf, weekKey, daysLeftInWeek, simulateLeague, zoneFor, type Tier, type LeagueRow, type Zone } from './league'
import { COMMUNITY_BACKEND } from './backendConfig'

type LeagueStatus = 'loading' | 'ready' | 'error'
interface LeagueData { rows: LeagueRow[]; youRank: number; zone: Zone; tier: Tier; status: LeagueStatus; reload: () => void }

/**
 * League standings source. With the backend off (default) this is the local
 * simulation, computed synchronously — identical to before. With the backend on
 * it pushes the user's honest weekly points, then reads the real cohort standings
 * for their tier, with loading/error states.
 */
function useLeagueData(me: ReturnType<typeof myLeaderStats>, storedTier: number, freezeTokens: number, enabled: boolean): LeagueData {
  const local = useMemo<LeagueData>(() => {
    const t = tierOf(storedTier)
    const r = simulateLeague(me, t, weekKey())
    return { rows: r.rows, youRank: r.youRank, zone: r.zone, tier: t, status: 'ready', reload: () => {} }
  }, [me, storedTier])

  const [remote, setRemote] = useState<LeagueData | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!COMMUNITY_BACKEND || !enabled) { setRemote(null); return }
    let cancelled = false
    const reload = () => setNonce((n) => n + 1)
    setRemote((prev) => ({ ...(prev ?? local), status: 'loading', reload }))
    ;(async () => {
      try {
        // Firebase adapter loaded on demand, only when the flag is on.
        const backend = await import('./backend')
        if (!backend.isCommunityBackendOn()) { if (!cancelled) setRemote(null); return }
        const sync = await backend.syncStatsRemote({
          points: me.odometer, streakCurrent: me.streakCurrent, streakBest: me.streakBest, freezeTokens,
          // Full metric set so the server doesn't fan out zeros to group members (audit F-011).
          volume7: me.volume7, volume30: me.volume30, sessionsThisWeek: me.sessionsThisWeek,
        })
        const raw = await backend.loadLeagueStandingsRemote(sync.weekKey, sync.tier)
        if (cancelled) return
        const tier = tierOf(sync.tier)
        const rows: LeagueRow[] = raw.map((r, i) => ({ rank: i + 1, username: r.username, points: r.points, isYou: r.isYou, zone: zoneFor(i + 1, tier, raw.length) }))
        const you = rows.find((r) => r.isYou)
        setRemote({ rows, youRank: you?.rank ?? 0, zone: you?.zone ?? 'safe', tier, status: 'ready', reload })
      } catch {
        if (!cancelled) setRemote((prev) => ({ ...(prev ?? local), status: 'error', reload }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, me.odometer, me.streakCurrent, me.streakBest, freezeTokens, storedTier])

  // Flag off → always the local simulation; on → remote once ready, local until then.
  return COMMUNITY_BACKEND && remote ? remote : local
}

export function LeagueScreen({ onClaimUsername }: { onClaimUsername: () => void }) {
  const { state, dispatch } = useStore()
  const me = useMemo(() => myLeaderStats(state), [state])
  const [view, setView] = useState<'league' | 'global'>('league')
  const [howOpen, setHowOpen] = useState(false)
  const freezeTokens = state.community.freezeTokens ?? 0
  const storedTier = state.community.league?.tier ?? 0

  // Weekly freeze grant — idempotent, only fires when a new week has started.
  useEffect(() => {
    dispatch({ type: 'GRANT_WEEKLY_FREEZE', weekKey: weekKey() })
  }, [dispatch])

  // Hooks must run before any early return.
  const data = useLeagueData(me, storedTier, freezeTokens, !!me.username)

  // No username yet: browse the global streak board and claim when ready.
  if (!me.username) return <GlobalLeaderboard onClaimUsername={onClaimUsername} />

  return (
    <View>
      {/* view toggle */}
      <View className="mb-4 flex-row gap-2 rounded-2xl bg-ink-700 p-1">
        {(['league', 'global'] as const).map((v) => {
          const active = view === v
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              accessibilityRole="button"
              accessibilityLabel={v === 'league' ? 'My league' : 'Global streaks'}
              accessibilityState={{ selected: active }}
              className={`flex-1 items-center rounded-xl py-2 ${active ? 'bg-brand-400' : ''} active:opacity-80`}
            >
              <Text className={`text-[13px] font-bold ${active ? 'text-black' : 'text-secondary'}`}>{v === 'league' ? 'My league' : 'Global streaks'}</Text>
            </Pressable>
          )
        })}
      </View>

      {view === 'global' ? (
        <GlobalLeaderboard onClaimUsername={onClaimUsername} />
      ) : data.status === 'loading' ? (
        <LeagueLoading />
      ) : data.status === 'error' ? (
        <LeagueError onRetry={data.reload} />
      ) : (
        <>
          <LeagueHero tier={data.tier} rank={data.youRank} points={me.odometer} cohort={data.rows.length} zone={data.zone} onHow={() => setHowOpen(true)} />
          <StreakCard />
          {data.rows.length < LOW_POP_COHORT && <LeagueFillingCard count={data.rows.length} />}
          <LeagueStandings rows={data.rows} tier={data.tier} />
        </>
      )}

      <HowLeaguesSheet open={howOpen} onClose={() => setHowOpen(false)} />
    </View>
  )
}

/* ----------------------------- loading / error ----------------------------- */

function LeagueLoading() {
  return (
    <View>
      <Skeleton width="100%" height={92} radius={16} />
      <View className="mt-3"><Skeleton width="100%" height={78} radius={16} /></View>
      <View className="mt-4 gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <Skeleton width={28} height={28} radius={14} />
            <Skeleton width={36} height={36} radius={18} />
            <View className="flex-1"><Skeleton width="45%" height={13} radius={5} /></View>
            <Skeleton width={30} height={16} radius={5} />
          </View>
        ))}
      </View>
    </View>
  )
}

function LeagueError({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="mt-6 items-center rounded-2xl border border-dashed border-white/15 px-6 py-12">
      <Text className="font-bold text-white">Couldn't load your league</Text>
      <Text className="mt-1 max-w-[240px] text-center text-[13px] text-secondary">Check your connection and try again.</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading league" className="btn-primary mt-4 px-5 py-2.5 active:opacity-90">
        <Text className="text-sm font-semibold text-black">Try again</Text>
      </Pressable>
    </View>
  )
}

/* ------------------------------ low-population ----------------------------- */

// A full cohort is ~25. Below this the tier hasn't filled enough to feel like a
// real competition (only reachable on the live backend — the local simulation
// always seeds a full board), so we reassure rather than show a thin, sad list.
const LOW_POP_COHORT = 6

/** Shown when the live league has only a handful of real members. Reframes the
 *  sparse board as "filling up" and gives one concrete action (invite friends)
 *  instead of leaving the standings looking empty next to the demo-seeded feel. */
function LeagueFillingCard({ count }: { count: number }) {
  const toast = useToast()
  const invite = async () => {
    const res = await shareText(
      "I'm competing on StrengthHub — join my league and let's climb together.",
      'StrengthHub',
    )
    if (res === 'copied') toast('Invite copied to clipboard')
    else if (res === 'failed') toast("Couldn't open share")
  }
  return (
    <View className="mt-4 rounded-2xl border border-dashed border-white/15 bg-ink-800 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${brand[400]}1a` }}>
          <Users size={18} color={brand[400]} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white">Your league is filling up</Text>
          <Text className="mt-0.5 text-[13px] leading-snug text-secondary">
            {count <= 1
              ? "You're first in — new lifters land here every day. Invite a friend and climb together."
              : `${count} lifters so far. More join your league as StrengthHub grows.`}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={invite}
        accessibilityRole="button"
        accessibilityLabel="Invite friends to StrengthHub"
        className="mt-3 flex-row items-center justify-center gap-2 rounded-xl bg-brand-400 py-2.5 active:opacity-90"
      >
        <UserPlus size={16} color="#000" />
        <Text className="text-[14px] font-bold text-black">Invite friends</Text>
      </Pressable>
    </View>
  )
}

/* --------------------------------- hero ------------------------------------ */

function LeagueHero({ tier, rank, points, cohort, zone, onHow }: {
  tier: ReturnType<typeof tierOf>
  rank: number
  points: number
  cohort: number
  zone: Zone
  onHow: () => void
}) {
  const days = daysLeftInWeek()
  const nextTier = TIERS[Math.min(TIERS.length - 1, tier.key + 1)]
  const status =
    zone === 'promote' ? { text: `In the promotion zone — hold it to reach ${nextTier.name}!`, color: brand[400] }
    : zone === 'demote' ? { text: 'In the drop zone — one good session moves you up.', color: '#F5A524' }
    : { text: `Reach rank ${tier.promote} or better to promote to ${nextTier.name}.`, color: 'rgba(255,255,255,0.6)' }

  return (
    <View className="overflow-hidden rounded-2xl border p-4" style={{ borderColor: `${tier.color}66`, backgroundColor: `${tier.color}14` }}>
      <View className="flex-row items-center gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${tier.color}26` }}>
          <Trophy size={26} color={tier.color} />
        </View>
        <View className="flex-1">
          <Text className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: tier.color }}>{tier.name} League</Text>
          <View className="flex-row items-end gap-1.5">
            <Text className="text-[30px] font-black leading-tight text-white">#{rank}</Text>
            <Text className="mb-1.5 text-[13px] font-semibold text-secondary">of {cohort}</Text>
          </View>
        </View>
        <View className="items-end">
          <View className="flex-row items-center gap-1">
            <Clock size={12} color="rgba(255,255,255,0.45)" />
            <Text className="text-[12px] font-bold text-secondary">{days}d left</Text>
          </View>
          <Text className="mt-1 text-[12px] text-secondary">{points} pts</Text>
        </View>
      </View>
      <Text className="mt-3 text-[13px] font-semibold" style={{ color: status.color }}>{status.text}</Text>
      <Pressable onPress={onHow} accessibilityRole="button" accessibilityLabel="How leagues work" className="mt-2 flex-row items-center gap-1 active:opacity-70">
        <Info size={13} color="rgba(255,255,255,0.45)" />
        <Text className="text-[12px] font-semibold text-secondary">How leagues work</Text>
      </Pressable>
    </View>
  )
}

/* ----------------------------- streak card (Rec 2) ------------------------- */

function StreakCard() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const me = useMemo(() => myLeaderStats(state), [state])
  const tokens = state.community.freezeTokens ?? 0
  const risk = streakRisk(state)
  const restingToday = (state.community.restDays ?? []).includes(todayKey)

  const protect = () => {
    dispatch({ type: 'USE_STREAK_FREEZE', dateKey: risk.dayKey })
    toast('Streak protected — nice save')
  }
  const toggleRest = () => {
    dispatch({ type: 'TOGGLE_REST_DAY', dateKey: todayKey })
    toast(restingToday ? 'Rest day removed' : 'Rest day banked — recovery is training')
  }

  return (
    <View className="mt-3 rounded-2xl border border-white/8 bg-ink-800 p-4">
      <View className="flex-row items-center gap-3">
        <StreakFlame days={me.streakCurrent} size={20} />
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-white">{me.streakCurrent}-day streak</Text>
          <Text className="text-[12px] text-secondary">Best {me.streakBest} · rest days &amp; freezes keep it alive</Text>
        </View>
        <View className="flex-row items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1">
          <Snowflake size={13} color="#6AD1E3" />
          <Text className="text-[12px] font-bold text-white/70">{tokens}</Text>
        </View>
      </View>

      <View className="mt-3 flex-row gap-2">
        {risk.atRisk && tokens > 0 && (
          <Pressable onPress={protect} accessibilityRole="button" accessibilityLabel="Use a freeze to protect yesterday" className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-400 py-2.5 active:opacity-90">
            <Snowflake size={14} color="#000" />
            <Text className="text-[13px] font-bold text-black">Protect yesterday</Text>
          </Pressable>
        )}
        <Pressable
          onPress={toggleRest}
          accessibilityRole="button"
          accessibilityLabel={restingToday ? 'Remove rest day' : 'Mark today a rest day'}
          accessibilityState={{ selected: restingToday }}
          className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 active:opacity-90 ${restingToday ? 'bg-brand-400/20' : 'border border-white/10 bg-white/5'}`}
        >
          <Moon size={14} color={restingToday ? brand[400] : 'rgba(255,255,255,0.7)'} />
          <Text className={`text-[13px] font-bold ${restingToday ? 'text-brand-300' : 'text-white/80'}`}>{restingToday ? 'Resting today' : 'Rest day'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ------------------------------- standings --------------------------------- */

const ZONE_LABEL: Record<Zone, { label: string; color: string; Icon: typeof ArrowUp }> = {
  promote: { label: 'Promotion zone', color: '#7ED957', Icon: ArrowUp },
  safe: { label: 'Holding', color: 'rgba(255,255,255,0.45)', Icon: ShieldCheck },
  demote: { label: 'Drop zone', color: '#F5A524', Icon: ArrowDown },
}

function LeagueStandings({ rows, tier }: { rows: LeagueRow[]; tier: ReturnType<typeof tierOf> }) {
  const items: React.ReactNode[] = []
  let prevZone: Zone | null = null
  for (const r of rows) {
    if (r.zone !== prevZone) {
      const z = ZONE_LABEL[r.zone]
      const ZIcon = z.Icon
      items.push(
        <View key={`z-${r.zone}`} className="mb-1 mt-3 flex-row items-center gap-1.5">
          <ZIcon size={12} color={z.color} />
          <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ color: z.color }}>
            {z.label}{r.zone === 'safe' ? ` in ${tier.name}` : ''}
          </Text>
        </View>,
      )
      prevZone = r.zone
    }
    items.push(<StandingRow key={r.username} row={r} />)
  }
  return (
    <View className="mt-4">
      <Text className="mb-1 section-title">This week's standings</Text>
      {items}
    </View>
  )
}

function StandingRow({ row }: { row: LeagueRow }) {
  const you = !!row.isYou
  const accent = row.zone === 'promote' ? '#7ED957' : row.zone === 'demote' ? '#F5A524' : 'rgba(255,255,255,0.5)'
  return (
    <View
      className="mb-1.5 flex-row items-center gap-3 rounded-2xl border p-3"
      style={you ? { borderColor: `${brand[400]}66`, backgroundColor: `${brand[400]}12` } : { borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <RankBadge rank={row.rank} size={28} />
      <Avatar name={row.username} size={36} />
      <Text numberOfLines={1} className={`flex-1 font-bold leading-tight ${you ? 'text-brand-300' : 'text-white'}`}>@{row.username}{you ? ' (You)' : ''}</Text>
      <View className="items-end">
        <Text className="text-[16px] font-black" style={{ color: you ? brand[400] : accent }}>{row.points}</Text>
        <Text className="text-[10px] font-semibold text-tertiary">pts</Text>
      </View>
    </View>
  )
}

/* --------------------------- how leagues work ------------------------------ */

function HowLeaguesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="How leagues work">
      <View className="gap-3">
        <HowRow n="1" title="Compete for the week" body="You're placed in a league with others at your level — up to ~25 as it fills. Your score this week is your dashboard odometer — how consistently you hit your goals. It's about showing up, not how much you lift." />
        <HowRow n="2" title="Climb the ladder" body="Every Monday the league resets. Finish near the top and you promote to the next tier — Bronze, Silver, Gold, Platinum, Diamond. The higher you go, the tougher the climb." />
        <HowRow n="3" title="Mind the drop zone" body="Finish in the bottom few and you slip down a tier. It's easy to climb straight back — a couple of good days does it." />
        <HowRow n="4" title="Streaks are forgiving" body="A planned rest day or a freeze token keeps your streak alive through an off day. Rest is part of training — no guilt, no all-or-nothing." />
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {TIERS.map((t) => (
          <View key={t.key} className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: `${t.color}1f` }}>
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            <Text className="text-[11px] font-bold text-white/80">{t.name}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  )
}

function HowRow({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View className="flex-row gap-3">
      <View className="h-6 w-6 items-center justify-center rounded-full bg-brand-400/20">
        <Text className="text-[12px] font-black text-brand-300">{n}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="mt-0.5 text-[13px] leading-snug text-secondary">{body}</Text>
      </View>
    </View>
  )
}
