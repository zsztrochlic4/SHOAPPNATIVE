/**
 * Global consistency-streak leaderboard. Every user competes on their current
 * streak; the current user's row is live (myLeaderStats) and highlighted, with a
 * summary card pinned above so their standing is visible without scrolling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ActivityIndicator } from 'react-native'
import { Trophy, Flame, RefreshCw, TrendingUp, ChevronDown, Ban } from 'lucide-react-native'
import { useStore } from '../store/store'
import { myLeaderStats } from '../store/selectors'
import { useColors, brand } from '../theme'
import { Avatar } from '../components/Avatar'
import { Skeleton } from '../components/Skeleton'
import { useCountUp } from '../lib/useCountUp'
import { loadGlobalBoard, type LeaderRow } from './service'
import { RankBadge, StreakFlame } from './ui'
import { ReportSheet, type ReportTarget } from './ReportSheet'
import { BlockedUsersSheet } from './BlockedUsersSheet'

type Status = 'loading' | 'ready' | 'error'

export function GlobalLeaderboard({ onClaimUsername }: { onClaimUsername: () => void }) {
  const { state } = useStore()
  const me = useMemo(() => myLeaderStats(state), [state])
  const colors = useColors()

  const [status, setStatus] = useState<Status>('loading')
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [youRank, setYouRank] = useState<number | null>(null)
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null)
  const [manageBlocked, setManageBlocked] = useState(false)
  const blocked = useMemo(() => new Set(state.community.blockedUids ?? []), [state.community.blockedUids])
  // Paginate 20 at a time (design spec) — don't render the whole population at
  // once. Maps to a page-size-20 server endpoint when the backend is on.
  const PAGE = 20
  const [shown, setShown] = useState(PAGE)
  const [loadingMore, setLoadingMore] = useState(false)
  const moreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // A monotonically-incrementing token so a slow in-flight load can't overwrite a
  // newer one (e.g. after a retry).
  const loadTokenRef = useRef(0)

  const load = useCallback(async () => {
    const token = ++loadTokenRef.current
    setStatus('loading')
    try {
      const res = await loadGlobalBoard(me)
      if (token !== loadTokenRef.current) return
      setRows(res.rows)
      setYouRank(res.youRank)
      setShown(PAGE)
      setStatus('ready')
    } catch {
      if (token !== loadTokenRef.current) return
      setStatus('error')
    }
    // Reload when the user's own streak (the only field that moves their rank) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.username, me.streakCurrent, me.streakBest])

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => () => { if (moreTimer.current) clearTimeout(moreTimer.current) }, [])

  const loadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    // Simulated async page fetch (spinner, then append) — a real paginated
    // endpoint replaces the timer when the backend is on.
    if (moreTimer.current) clearTimeout(moreTimer.current)
    moreTimer.current = setTimeout(() => {
      setShown((n) => n + PAGE)
      setLoadingMore(false)
    }, 650)
  }

  if (status === 'loading') return <BoardSkeleton />

  if (status === 'error') {
    return (
      <View className="mt-8 items-center rounded-2xl border border-dashed border-white/15 px-6 py-12">
        <RefreshCw size={26} color="rgba(255,255,255,0.4)" />
        <Text className="mt-3 font-bold text-white">Couldn't load the leaderboard</Text>
        <Text className="mt-1 max-w-[240px] text-center text-[13px] text-secondary">Check your connection and try again.</Text>
        <Pressable onPress={load} accessibilityRole="button" accessibilityLabel="Retry loading leaderboard" className="btn-primary mt-4 px-5 py-2.5 active:opacity-90">
          <Text className="text-sm font-semibold text-black">Try again</Text>
        </Pressable>
      </View>
    )
  }

  const total = rows.length
  // Hide anyone the user has blocked (local moderation). Your own row always stays.
  const visibleRows = blocked.size ? rows.filter((r) => r.isYou || !blocked.has(r.username)) : rows

  return (
    <View>
      {me.username ? <YourRankCard rank={youRank} total={total} me={me} /> : <ClaimBanner onPress={onClaimUsername} />}

      <View className="mb-3 mt-6 flex-row items-center justify-between">
        <Text className="section-title">Streak leaderboard</Text>
        <View className="flex-row items-center gap-1.5">
          <Flame size={13} color={colors.accentOrange} />
          <Text className="text-[12px] font-semibold text-secondary">By current streak</Text>
        </View>
      </View>

      <View className="gap-1.5">
        {visibleRows.slice(0, shown).map((r) => (
          <LeaderRowView
            key={r.username}
            row={r}
            onReport={r.uid && !r.isYou ? () => setReportTarget({ type: 'user', id: r.uid!, label: `@${r.username}` }) : undefined}
          />
        ))}
      </View>

      {shown < visibleRows.length && (
        <Pressable
          onPress={loadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityLabel="Load 20 more"
          className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 active:opacity-90"
        >
          {loadingMore ? (
            <>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              <Text className="text-[14px] font-bold text-secondary">Loading…</Text>
            </>
          ) : (
            <>
              <ChevronDown size={15} color="rgba(255,255,255,0.7)" />
              <Text className="text-[14px] font-bold text-secondary">Load 20 more</Text>
            </>
          )}
        </Pressable>
      )}
      <Text className="mt-2.5 text-center text-[12px] text-tertiary">
        Showing {Math.min(shown, visibleRows.length)} of {total.toLocaleString('en-US')}
      </Text>

      {blocked.size > 0 && (
        <Pressable
          onPress={() => setManageBlocked(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Manage blocked users, ${blocked.size} blocked`}
          className="mt-2 flex-row items-center justify-center gap-1.5 py-2 active:opacity-70"
        >
          <Ban size={12} color="rgba(255,255,255,0.45)" />
          <Text className="text-[12px] font-semibold text-tertiary">Manage blocked ({blocked.size})</Text>
        </Pressable>
      )}

      <ReportSheet open={!!reportTarget} target={reportTarget} onClose={() => setReportTarget(null)} />
      <BlockedUsersSheet open={manageBlocked} onClose={() => setManageBlocked(false)} />
    </View>
  )
}

function YourRankCard({ rank, total, me }: { rank: number | null; total: number; me: ReturnType<typeof myLeaderStats> }) {
  const rankText = useCountUp(rank ?? 0, { duration: 700 })
  if (!rank || !me.username) {
    // No username yet is handled upstream (the setup gate); this is the belt-and-braces path.
    return null
  }
  const top = rank <= 3
  return (
    <View
      className="overflow-hidden rounded-2xl border p-4"
      style={{ borderColor: `${brand[400]}55`, backgroundColor: `${brand[400]}14` }}
    >
      <View className="flex-row items-center gap-4">
        <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${brand[400]}22` }}>
          <Trophy size={26} color={brand[400]} />
        </View>
        <View className="flex-1">
          <Text className="text-[12px] font-semibold uppercase tracking-wide text-brand-300">Your rank</Text>
          <View className="flex-row items-end gap-1.5">
            <Text className="text-[30px] font-black leading-tight text-white">#{rankText}</Text>
            <Text className="mb-1.5 text-[13px] font-semibold text-secondary">of {total.toLocaleString('en-US')}</Text>
          </View>
          <Text className="text-[13px] text-secondary">@{me.username}{top ? ' · top 3!' : ''}</Text>
        </View>
        <View className="items-end gap-1.5">
          <StreakFlame days={me.streakCurrent} size={18} />
          <View className="flex-row items-center gap-1">
            <TrendingUp size={12} color="rgba(255,255,255,0.4)" />
            <Text className="text-[12px] font-semibold text-secondary">best {me.streakBest}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

/** Shown above the board when the user hasn't claimed a username yet — they can
 *  still see everyone, but need an identity to appear and compete. */
function ClaimBanner({ onPress }: { onPress: () => void }) {
  return (
    <View
      className="flex-row items-center gap-3 rounded-2xl border p-4"
      style={{ borderColor: `${brand[400]}44`, backgroundColor: `${brand[400]}12` }}
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${brand[400]}22` }}>
        <Trophy size={22} color={brand[400]} />
      </View>
      <View className="flex-1">
        <Text className="font-bold text-white">Join the leaderboard</Text>
        <Text className="text-[12px] text-secondary">Claim a username to appear and compete on your streak.</Text>
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Claim a username" className="rounded-full bg-brand-400 px-3.5 py-2 active:opacity-90">
        <Text className="text-[13px] font-bold text-black">Claim</Text>
      </Pressable>
    </View>
  )
}

function LeaderRowView({ row, onReport }: { row: LeaderRow; onReport?: () => void }) {
  const you = !!row.isYou
  return (
    <Pressable
      onLongPress={onReport}
      delayLongPress={350}
      disabled={!onReport}
      accessibilityRole={onReport ? 'button' : undefined}
      accessibilityLabel={onReport ? `Report @${row.username}` : undefined}
      accessibilityHint={onReport ? 'Opens the report options' : undefined}
      className="flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-90"
      style={
        you
          ? { borderColor: `${brand[400]}66`, backgroundColor: `${brand[400]}12` }
          : { borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }
      }
    >
      <RankBadge rank={row.rank} />
      <Avatar name={row.username} size={38} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`font-bold leading-tight ${you ? 'text-brand-300' : 'text-white'}`}>
          @{row.username}{you ? ' (You)' : ''}
        </Text>
        <Text className="text-[12px] text-tertiary">Best streak {row.streakBest}</Text>
      </View>
      <StreakFlame days={row.streakCurrent} size={16} />
    </Pressable>
  )
}

function BoardSkeleton() {
  return (
    <View>
      <Skeleton width="100%" height={92} radius={16} />
      <View className="mb-3 mt-6"><Skeleton width={180} height={18} radius={6} /></View>
      <View className="gap-1.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <Skeleton width={30} height={30} radius={15} />
            <Skeleton width={38} height={38} radius={19} />
            <View className="flex-1 gap-1.5">
              <Skeleton width="55%" height={13} radius={5} />
              <Skeleton width="35%" height={10} radius={5} />
            </View>
            <Skeleton width={34} height={16} radius={6} />
          </View>
        ))}
      </View>
    </View>
  )
}
