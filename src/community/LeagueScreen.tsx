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
import { Trophy, Snowflake, Moon, Info, ChevronRight, ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, Clock, UserPlus, Users } from 'lucide-react-native'
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
import { RankBadge, StreakFlame } from './ui'
import { GlobalLeaderboard } from './GlobalLeaderboard'
import { TIERS, tierOf, leaguePeriodKey, daysLeftInPeriod, promoteCutoff, simulateLeague, zoneFor, type Tier, type LeagueRow, type Zone } from './league'
import { COMMUNITY_BACKEND } from './backendConfig'
import { shouldPostCommunityStats, clampDayCadence } from './syncGate'

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

function useLeagueData(me: ReturnType<typeof myLeaderStats>, sync: SyncPayload, storedTier: number, enabled: boolean, demo: boolean): LeagueData {
  const local = useMemo<LeagueData>(() => {
    const t = tierOf(storedTier)
    const r = simulateLeague(me, t, leaguePeriodKey())
    return { rows: r.rows, youRank: r.youRank, zone: r.zone, tier: t, status: 'ready', integrity: 'ok', reload: () => {} }
  }, [me, storedTier])

  const [remote, setRemote] = useState<LeagueData | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    // Demo accounts run on a frozen clock, which collapses logged workouts onto one
    // dateKey and trips the server's `impossible_session_cadence` anti-cheat rule; they
    // are not real competitors and must never post. Fall back to the local simulation.
    if (!shouldPostCommunityStats({ backendOn: COMMUNITY_BACKEND, hasUsername: enabled, demo })) { setRemote(null); return }
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
  }, [enabled, nonce, sync, storedTier, demo])

  // Flag off → always the local simulation; on → remote once ready, local until then.
  if (COMMUNITY_BACKEND && remote) return remote
  return REVIEW_PREVIEW ? { ...local, integrity: REVIEW_PREVIEW } : local
}

export function LeagueScreen({ onClaimUsername }: { onClaimUsername: () => void }) {
  const { state, dispatch } = useStore()
  const me = useMemo(() => myLeaderStats(state), [state])
  const [view, setView] = useState<'league' | 'global'>('league')
  const [howOpen, setHowOpen] = useState(false)
  const [appealOpen, setAppealOpen] = useState(false)
  const storedTier = state.community.league?.tier ?? 0

  // F-003: the client sends RAW daily inputs + goal targets; the server recomputes
  // the competitive metrics itself. Built here (the component holds full state) and
  // threaded through, so useLeagueData never posts a client-computed points/streak.
  const syncPayload = useMemo<SyncPayload>(
    () => ({ targets: targetsFrom(state.profile), days: clampDayCadence(buildDayRecords(state)), clientTz: deviceTimezone() ?? undefined }),
    [state],
  )

  // Weekly freeze grant — idempotent, only fires when a new week has started.
  useEffect(() => {
    dispatch({ type: 'GRANT_WEEKLY_FREEZE', weekKey: leaguePeriodKey() })
  }, [dispatch])

  // Hooks must run before any early return.
  const data = useLeagueData(me, syncPayload, storedTier, !!me.username, state.demo === true)

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
          <LeagueHero tier={data.tier} rank={data.youRank} points={me.odometer} cohort={data.rows.length} zone={data.zone} onHow={() => setHowOpen(true)} />
          <StreakCard />
          {data.rows.length < LOW_POP_COHORT && <LeagueFillingCard count={data.rows.length} />}
          <LeagueStandings rows={data.rows} tier={data.tier} />
        </>
      )}

      <HowLeaguesSheet open={howOpen} onClose={() => setHowOpen(false)} />
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

function LeagueHero({ tier, rank, points, cohort, zone, onHow }: {
  tier: ReturnType<typeof tierOf>
  rank: number
  points: number
  cohort: number
  zone: Zone
  onHow: () => void
}) {
  const days = daysLeftInPeriod()
  const nextTier = TIERS[Math.min(TIERS.length - 1, tier.key + 1)]
  const canPromote = tier.promote > 0
  const cutoff = promoteCutoff(tier, cohort)

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
      {/* status line — the promotion target tier is coloured to its own tier (design spec) */}
      {zone === 'promote' ? (
        <Text className="mt-3 text-[13px] font-semibold" style={{ color: brand[400] }}>
          In the promotion zone — hold it to reach <Text style={{ color: nextTier.color }}>{nextTier.name}</Text>!
        </Text>
      ) : zone === 'demote' ? (
        <Text className="mt-3 text-[13px] font-semibold" style={{ color: '#F5A524' }}>In the drop zone — one good session moves you up.</Text>
      ) : canPromote ? (
        <Text className="mt-3 text-[13px] font-semibold text-secondary">
          Reach the top {cutoff} to promote to <Text style={{ color: nextTier.color, fontWeight: '700' }}>{nextTier.name}</Text>.
        </Text>
      ) : (
        <Text className="mt-3 text-[13px] font-semibold text-secondary">You're in the top tier — hold your rank to stay in {tier.name}.</Text>
      )}
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
  const restingToday = (state.community.restDays ?? []).includes(todayKey)

  // Rest days are schedule-driven (Plan around your life + scheduled rest days pull
  // through automatically); when today isn't a planned rest day the manual freeze is
  // the fallback — spend a token to protect today's streak (design spec).
  const freezeStreak = () => {
    if (tokens === 0) return
    dispatch({ type: 'USE_STREAK_FREEZE', dateKey: todayKey })
    toast('Streak frozen for today')
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

      <View className="mt-3">
        {restingToday ? (
          // Scheduled rest day → auto-protected, no freeze spent.
          <View className="flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-400/20 py-2.5">
            <Moon size={14} color={brand[400]} />
            <Text className="text-[13px] font-bold text-brand-300">Resting today</Text>
          </View>
        ) : (
          // Manual fallback: spend a freeze (styled in the freeze blue #6AD1E3).
          <Pressable
            onPress={freezeStreak}
            disabled={tokens === 0}
            accessibilityRole="button"
            accessibilityLabel="Freeze your streak for today"
            accessibilityState={{ disabled: tokens === 0 }}
            className="flex-row items-center justify-center gap-1.5 rounded-xl border py-2.5 active:opacity-90"
            style={{ borderColor: 'rgba(106,209,227,0.4)', backgroundColor: tokens > 0 ? 'rgba(106,209,227,0.16)' : 'rgba(255,255,255,0.04)', opacity: tokens > 0 ? 1 : 0.6 }}
          >
            <Snowflake size={14} color="#6AD1E3" />
            <Text className="text-[13px] font-bold" style={{ color: '#6AD1E3' }}>{tokens > 0 ? 'Freeze streak' : 'No freezes left'}</Text>
          </Pressable>
        )}
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
      <Text className="mb-1 section-title">This month's standings</Text>
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
        <HowRow n="1" title="Compete each month" body="You're placed in a league with others at your level — up to ~25 as it fills. Your score is your dashboard odometer — how consistently you hit your goals. It's about showing up, not how much you lift." />
        <HowRow n="2" title="Climb the ladder" body="On the first Monday of every month the league resets. Finish in the top 30% and you promote to the next tier — Bronze, Silver, Gold, Platinum, Diamond. The higher you go, the tougher the climb." />
        <HowRow n="3" title="Mind the drop zone" body="Finish in the bottom 30% and you slip down a tier. It's easy to climb straight back — a couple of good days does it." />
        <HowRow n="4" title="Streaks are forgiving" body="A planned rest day or a freeze token keeps your streak alive through an off day. You get 2 fresh freezes at each monthly reset — no guilt, no all-or-nothing." />
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
