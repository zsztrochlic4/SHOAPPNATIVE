/**
 * The League tab: the headline competitive surface. Leads with the user's own
 * weekly standing (tier, rank, points, days left, promotion/demotion status),
 * a forgiving-streak card (Recommendation 2), then the ranked cohort with clearly
 * labelled promotion / safe / demotion zones. A "My league / Global" toggle keeps
 * the full streak board one tap away, and a "How leagues work" sheet keeps it
 * legible. Browse-first: no username → the browseable global board + claim prompt.
 */
import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Moon, Flame, Info, ChevronRight, ChevronDown, ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, UserPlus, Users } from 'lucide-react-native'
import { useStore } from '../store/store'
import { myLeaderStats, buildDayRecords, targetsFrom } from '../store/selectors'
import { todayKey, deviceTimezone } from '../lib/date'
import type { DayRecord, ScoringTargets } from './scoring'
import { shareText } from '../lib/share'
import { useColors, brand } from '../theme'
import { Avatar } from '../components/Avatar'
import { Sheet } from '../components/Sheet'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { RankBadge } from './ui'
import { GlobalLeaderboard } from './GlobalLeaderboard'
import { TIERS, tierOf, weekKey, monthlyResetKey, daysLeftInMonth, simulateLeague, zoneFor, type Tier, type LeagueRow, type Zone } from './league'
import { COMMUNITY_BACKEND } from './backendConfig'

type LeagueStatus = 'loading' | 'ready' | 'error'
/** Competitive-integrity status of the user's own standing (F-003). `ok` ranks
 *  normally; `provisional`/`held` are rank-withheld and shown as "under review". */
type Integrity = 'ok' | 'provisional' | 'held'
interface LeagueData { rows: LeagueRow[]; youRank: number; zone: Zone; tier: Tier; status: LeagueStatus; integrity: Integrity; reload: () => void }

/** DEV-ONLY: force the "under review" state for visual QA while COMMUNITY_BACKEND is
 *  off (the local simulation is always `ok`). Set
 *  `EXPO_PUBLIC_COMMUNITY_REVIEW_PREVIEW=held` (or `provisional`) in a local .env.
 *  Double-guarded by `__DEV__` (constant-folded out of release bundles) so it can
 *  never ship — same pattern as PAYWALL_PREVIEW in src/store/selectors.ts. */
const REVIEW_PREVIEW: Integrity | null =
  typeof __DEV__ !== 'undefined' && __DEV__ &&
  (process.env.EXPO_PUBLIC_COMMUNITY_REVIEW_PREVIEW === 'held' || process.env.EXPO_PUBLIC_COMMUNITY_REVIEW_PREVIEW === 'provisional')
    ? (process.env.EXPO_PUBLIC_COMMUNITY_REVIEW_PREVIEW as Integrity)
    : null

/**
 * League standings source. With the backend off (default) this is the local
 * simulation, computed synchronously — identical to before. With the backend on
 * it pushes the user's honest weekly points, then reads the real cohort standings
 * for their tier, with loading/error states.
 */
/** The raw inputs the client sends the server to recompute from (F-003). */
type SyncPayload = { targets: ScoringTargets; days: DayRecord[]; clientTz?: string }

function useLeagueData(me: ReturnType<typeof myLeaderStats>, sync: SyncPayload, storedTier: number, enabled: boolean): LeagueData {
  const local = useMemo<LeagueData>(() => {
    const t = tierOf(storedTier)
    const r = simulateLeague(me, t, weekKey())
    return { rows: r.rows, youRank: r.youRank, zone: r.zone, tier: t, status: 'ready', integrity: 'ok', reload: () => {} }
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
        // F-003: send RAW inputs; the server recomputes points itself and returns
        // the authoritative tier. We never post a computed points/streak.
        const res = await backend.syncStatsRemote(sync)
        const raw = await backend.loadLeagueStandingsRemote(res.weekKey, res.tier)
        if (cancelled) return
        const tier = tierOf(res.tier)
        const rows: LeagueRow[] = raw.map((r, i) => ({ rank: i + 1, username: r.username, points: r.points, isYou: r.isYou, zone: zoneFor(i + 1, tier, raw.length) }))
        const you = rows.find((r) => r.isYou)
        setRemote({ rows, youRank: you?.rank ?? 0, zone: you?.zone ?? 'safe', tier, status: 'ready', integrity: res.status, reload })
      } catch {
        if (!cancelled) setRemote((prev) => ({ ...(prev ?? local), status: 'error', reload }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, sync, storedTier])

  // Flag off → always the local simulation; on → remote once ready, local until then.
  if (COMMUNITY_BACKEND && remote) return remote
  return REVIEW_PREVIEW ? { ...local, integrity: REVIEW_PREVIEW } : local
}

export function LeagueScreen({ onClaimUsername }: { onClaimUsername: () => void }) {
  const { state, dispatch } = useStore()
  const me = useMemo(() => myLeaderStats(state), [state])
  const [view, setView] = useState<'league' | 'global'>('league')
  const [appealOpen, setAppealOpen] = useState(false)
  const storedTier = state.community.league?.tier ?? 0

  // F-003: the client sends RAW daily inputs + goal targets; the server recomputes
  // the competitive metrics itself. Built here (the component holds full state) and
  // threaded through, so useLeagueData never posts a client-computed points/streak.
  const syncPayload = useMemo<SyncPayload>(
    () => ({ targets: targetsFrom(state.profile), days: buildDayRecords(state), clientTz: deviceTimezone() ?? undefined }),
    [state],
  )

  // Monthly freeze grant — idempotent, fires once when a new monthly league
  // period begins (first Monday of the month). Grants the fresh 2 freezes.
  useEffect(() => {
    dispatch({ type: 'GRANT_WEEKLY_FREEZE', weekKey: monthlyResetKey() })
  }, [dispatch])

  // Hooks must run before any early return.
  const data = useLeagueData(me, syncPayload, storedTier, !!me.username)

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
          {data.integrity !== 'ok' && <ReviewBanner integrity={data.integrity} onAppeal={() => setAppealOpen(true)} />}
          <UnifiedHero tier={data.tier} rank={data.youRank} points={me.odometer} cohort={data.rows.length} zone={data.zone} />
          {data.rows.length < LOW_POP_COHORT && <LeagueFillingCard count={data.rows.length} />}
          <LeagueStandings rows={data.rows} tier={data.tier} />
        </>
      )}

      <AppealSheet open={appealOpen} onClose={() => setAppealOpen(false)} onDone={data.reload} />
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

/* -------------------------- review banner + appeal (F-003) ----------------- */

/** Shown when the user's own standing is withheld from the ladder. `provisional`
 *  clears on its own; `held` offers an appeal. Framed reassuringly, not punitively. */
function ReviewBanner({ integrity, onAppeal }: { integrity: Exclude<Integrity, 'ok'>; onAppeal: () => void }) {
  const held = integrity === 'held'
  const accent = held ? '#F5A524' : 'rgba(255,255,255,0.55)'
  return (
    <View className="mb-3 rounded-2xl border p-4" style={{ borderColor: `${accent}55`, backgroundColor: `${accent}14` }}>
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${accent}26` }}>
          <ShieldAlert size={18} color={accent} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-bold text-white">Your standing is under review</Text>
          <Text className="mt-0.5 text-[13px] leading-snug text-secondary">
            {held
              ? "Something in this week's activity looked unusual, so your rank is paused while we take a closer look. If this looks wrong, ask us to check again."
              : "Your rank is paused while we double-check this week's activity. It usually clears on its own — keep logging as normal."}
          </Text>
        </View>
      </View>
      {held && (
        <Pressable
          onPress={onAppeal}
          accessibilityRole="button"
          accessibilityLabel="Ask for another look at your standing"
          className="mt-3 flex-row items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-white/5 py-2.5 active:opacity-80"
        >
          <Text className="text-[14px] font-bold text-white/90">Ask for another look</Text>
          <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
        </Pressable>
      )}
    </View>
  )
}

/** Lets a held user add an optional note and ask for a re-review. Calls the server
 *  (which re-checks immediately), reports the outcome, then refreshes the league. */
function AppealSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const colors = useColors()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const backend = await import('./backend')
      const res = await backend.appealStandingRemote(note.trim())
      toast(res.status === 'ok' ? "You're back in the running" : "Thanks — we'll take another look")
      setNote('')
      onClose()
      onDone()
    } catch {
      toast("Couldn't send that. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ask for another look">
      <Text className="text-[13px] leading-snug text-secondary">
        If your recent training was genuine, tell us anything that helps and we'll re-check your standing. This won't lower your rank.
      </Text>
      <View className="mt-3 rounded-2xl border border-white/12 bg-ink-700 px-3.5 py-3">
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder="Add a note (optional) — e.g. I trained twice on Saturday"
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Appeal note"
          textAlignVertical="top"
          className="min-h-[84px] text-[15px] leading-snug text-white"
          style={{ color: colors.fg }}
        />
      </View>
      <Text className="mt-1.5 px-1 text-[11px] text-tertiary">{note.length}/500</Text>
      <Pressable
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Send appeal"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        className="btn-primary mt-3 flex-row items-center justify-center gap-2 py-3 active:opacity-90"
        style={submitting ? { opacity: 0.7 } : undefined}
      >
        {submitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-[15px] font-bold text-black">Send appeal</Text>}
      </Pressable>
    </Sheet>
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

/** Unified league + streak hero: a rank progress ring tinted to the current tier,
 *  the promotion status (with the NEXT tier's colour on its name), then the streak
 *  row with the schedule-driven rest / manual-freeze control. */
function UnifiedHero({ tier, rank, points, cohort, zone }: {
  tier: Tier
  rank: number
  points: number
  cohort: number
  zone: Zone
}) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const me = useMemo(() => myLeaderStats(state), [state])
  const tokens = state.community.freezeTokens ?? 0
  const restingToday = (state.community.restDays ?? []).includes(todayKey)
  const days = daysLeftInMonth()
  const nextTier = TIERS[Math.min(TIERS.length - 1, tier.key + 1)]

  // Rank progress ring — a better rank fills more of the circle. C = 2πr, r = 32.
  const C = 2 * Math.PI * 32
  const dashoffset = C * (cohort > 0 ? Math.min(1, rank / cohort) : 1)

  const statusMain =
    zone === 'promote' ? 'In the promotion zone'
    : zone === 'demote' ? 'In the drop zone'
    : `Holding in ${tier.name}`

  // Rest days come from the schedule; the manual control is a fallback freeze.
  const toggleRest = () => {
    dispatch({ type: 'TOGGLE_REST_DAY', dateKey: todayKey })
    toast(restingToday ? 'Rest day removed' : 'Streak protected for today')
  }

  return (
    <View className="rounded-[20px] border bg-ink-800 p-4" style={{ borderColor: `${tier.color}38` }}>
      <View className="flex-row items-center gap-4">
        <View style={{ width: 74, height: 74 }}>
          <Svg width={74} height={74} style={{ position: 'absolute', top: 0, left: 0 }}>
            <Circle cx={37} cy={37} r={32} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={6} />
            <Circle cx={37} cy={37} r={32} fill="none" stroke={tier.color} strokeWidth={6} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={dashoffset} transform="rotate(-90 37 37)" />
          </Svg>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="text-[24px] font-black leading-none text-white">#{rank}</Text>
            <Text className="mt-0.5 text-[10px] font-semibold text-white/50">of {cohort}</Text>
          </View>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tier.color }}>{tier.name} League</Text>
          <Text className="mt-0.5 text-[15px] font-extrabold" style={{ color: tier.color }}>{statusMain}</Text>
          <Text className="mt-0.5 text-[12px] font-semibold text-white/65">{points} pts · {days} day{days === 1 ? '' : 's'} left</Text>
          <Text className="mt-px text-[12px] text-white/45">
            {zone === 'demote'
              ? 'One good session moves you up'
              : <>{zone === 'promote' ? 'Hold your spot to reach ' : 'Climb the table to reach '}<Text className="font-bold" style={{ color: nextTier.color }}>{nextTier.name}</Text></>}
          </Text>
        </View>
      </View>

      <View className="my-3.5 h-px bg-white/[0.07]" />

      <View className="flex-row items-center gap-2.5">
        <View className="flex-row items-center gap-1.5">
          <Flame size={19} color="#F5A524" fill="#F5A524" />
          <Text className="text-[16px] font-black text-white">{me.streakCurrent}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-bold text-white">day streak</Text>
          <Text className="text-[11px] text-white/50">Best {me.streakBest} · {tokens} <Text style={{ color: '#6AD1E3' }}>❄</Text> left</Text>
        </View>
        <FreezeControl resting={restingToday} onPress={toggleRest} />
      </View>
    </View>
  )
}

/** Rest / freeze control: schedule-driven "Resting today" (green) when today is a
 *  planned rest day, else a manual "Freeze streak" (freeze blue #6AD1E3) action.
 *  BACKEND: rest days pull through from "Plan around your life" + the workout
 *  schedule (source of truth). A manual freeze is spent only once the day rolls
 *  over with no workout, and credited back if a workout is later back-dated. */
function FreezeControl({ resting, onPress }: { resting: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={resting ? 'Resting today' : 'Freeze streak'}
      accessibilityState={{ selected: resting }}
      className={`min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-xl px-4 active:opacity-80 ${resting ? 'bg-brand-400/20' : 'border border-white/12 bg-white/5'}`}
    >
      <Moon size={14} color={resting ? brand[400] : '#6AD1E3'} />
      <Text className="text-[13px] font-bold" style={{ color: resting ? '#9fe264' : '#6AD1E3' }}>{resting ? 'Resting today' : 'Freeze streak'}</Text>
    </Pressable>
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
      <HowExplainer />
      <Text className="mb-1 mt-3.5 section-title">This month's standings</Text>
      {items}
    </View>
  )
}

/** Collapsible explainer above the standings — points are the 14-day consistency
 *  odometer (showing up, not load); streaks are forgiving via monthly freezes. */
function HowExplainer() {
  const [open, setOpen] = useState(false)
  return (
    <View className="rounded-[14px] border p-3" style={{ borderColor: `${brand[400]}33`, backgroundColor: `${brand[400]}0f` }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="How points and streaks work"
        accessibilityState={{ expanded: open }}
        className="flex-row items-center gap-2.5 active:opacity-80"
      >
        <Info size={16} color={brand[400]} />
        <Text className="flex-1 text-[12px] font-bold text-white">How points &amp; streaks work</Text>
        <ChevronDown size={16} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>
      {open && (
        <View className="mt-2 pl-[26px]">
          <Text className="text-[12px] leading-snug text-white/70">
            <Text className="font-bold text-white">Points</Text> are your odometer: a score out of 100 that reflects your last 14 days of training and how on track you are to hit your goals. It rewards consistency, not just how heavy you lift. For example, 30 out of 100 means you're behind; 60 means you're on track. Every workout and goal you hit raises it. Standings reset on the first Monday of each month, and the top of the table moves up a tier.
          </Text>
          <Text className="mt-2.5 text-[12px] leading-snug text-white/70">
            <Text className="font-bold text-white">Streaks</Text> count the days in a row you show up. You get <Text className="font-bold" style={{ color: '#6AD1E3' }}>2 freezes</Text> at the reset of every month for days you can't make it. Miss a day you didn't plan and one freeze (the ❄ count) is spent automatically to save your streak. Your streak only resets once you miss a day with no rest planned and no freezes left. Rest days from the workout section and planned days off you register in <Text className="font-bold text-white">Plan around your life</Text> mode pull through automatically and show as a rest day above.
          </Text>
        </View>
      )}
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

