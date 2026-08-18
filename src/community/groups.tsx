/**
 * Groups: private friend competitions. The tab lists the groups you're in and
 * routes to create / join / detail flows. Ranking within a group can switch
 * between odometer, current streak and weekly volume. The current user's row is
 * always live (myLeaderStats) regardless of what's stored on the group.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import {
  Users, Plus, Minus, KeyRound, Copy, Crown, ChevronRight, Trash2,
  LogOut, Search, ShieldCheck, Gauge, ChevronDown, Flame, Dumbbell,
  TrendingUp, ArrowUp, UserPlus, CheckCircle2, Activity, Target,
  SmilePlus, Info, Check, Pencil,
} from 'lucide-react-native'
import { useStore } from '../store/store'
import { myLeaderStats, type MyLeaderStats } from '../store/selectors'
import { todayKey } from '../lib/date'
import { useColors, brand } from '../theme'
import { useToast } from '../components/Toast'
import { Sheet } from '../components/Sheet'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { ProgressBar } from '../components/ui'
import { Skeleton } from '../components/Skeleton'
import type { CommunityGroup, GroupMember, GroupRankMetric } from '../store/types'
import { RankBadge, StreakFlame, formatKgCompact, odometerColor } from './ui'
import {
  createGroup, searchGroups, joinGroup,
  type DiscoverableGroup,
} from './service'
import { youMember } from './simulate'
import { COMMUNITY_BACKEND } from './backendConfig'

/* ------------------------------ ranking metrics ---------------------------- */

const METRICS: { key: GroupRankMetric; label: string; get: (m: GroupMember) => number }[] = [
  { key: 'odometer', label: 'Odometer', get: (m) => m.odometer },
  { key: 'streak', label: 'Streak', get: (m) => m.streak },
  { key: 'volume', label: 'Volume', get: (m) => m.volume7 },
]

/** Replace the stored "you" row with the user's live stats + current username, so
 *  a group leaderboard always reflects real, current activity. */
function resolveMembers(group: CommunityGroup, me: MyLeaderStats): GroupMember[] {
  const live = youMember(me)
  const others = group.members.filter((m) => !m.isYou && m.username !== live.username)
  return [live, ...others]
}

function rankMembers(members: GroupMember[], metric: GroupRankMetric): GroupMember[] {
  const get = METRICS.find((x) => x.key === metric)!.get
  return [...members].sort((a, b) => get(b) - get(a) || b.streak - a.streak || a.username.localeCompare(b.username))
}

/* --------------------------- appearance + derived -------------------------- */

/** Icon + accent choices offered when creating a group. */
const GROUP_ICONS: { icon: string; color: string }[] = [
  { icon: 'dumbbell', color: '#7ED957' },
  { icon: 'flame', color: '#F5A524' },
  { icon: 'trending', color: '#3B82F6' },
  { icon: 'target', color: '#EC4899' },
  { icon: 'brain', color: '#8B5CF6' },
  { icon: 'leaf', color: '#06B6D4' },
]

function groupAppearance(g: CommunityGroup): { icon: string; color: string } {
  return { icon: g.icon ?? 'dumbbell', color: g.color ?? brand[400] }
}

/** Aggregate "pulse" of a group from its members. */
function groupPulse(members: GroupMember[]) {
  const volume7 = members.reduce((a, m) => a + m.volume7, 0)
  const avgOdometer = members.length ? Math.round(members.reduce((a, m) => a + m.odometer, 0) / members.length) : 0
  const topStreak = members.reduce((a, m) => Math.max(a, m.streak), 0)
  return { volume7, avgOdometer, topStreak }
}

type ActivityKind = 'streak' | 'volume' | 'odometer' | 'rank' | 'log' | 'join'
interface GroupActivity { id: string; kind: ActivityKind; text: string; when: string }

const handleOf = (m: GroupMember) => (m.isYou ? 'You' : `@${m.username}`)

/** A deterministic, read-only activity stream derived from member stats — no free
 *  text, nothing to moderate. Reflects the real standings in the group. */
function buildActivity(members: GroupMember[]): GroupActivity[] {
  if (members.length === 0) return []
  const byStreak = [...members].sort((a, b) => b.streak - a.streak)
  const byVol = [...members].sort((a, b) => b.volume7 - a.volume7)
  const byOdo = [...members].sort((a, b) => b.odometer - a.odometer)
  const out: GroupActivity[] = []

  const ts = byStreak[0]
  if (ts && ts.streak > 0) out.push({ id: 'a-streak', kind: 'streak', text: `${handleOf(ts)} ${ts.isYou ? 'are' : 'is'} on a ${ts.streak}-day streak`, when: 'Today' })
  const tv = byVol[0]
  if (tv) out.push({ id: 'a-vol', kind: 'volume', text: `${handleOf(tv)} lifted the most this week — ${formatKgCompact(tv.volume7)} kg`, when: 'Today' })
  const to = byOdo[0]
  if (to) out.push({ id: 'a-odo', kind: 'odometer', text: `${handleOf(to)} ${to.isYou ? 'are' : 'is'} ahead of pace at ${to.odometer}/100`, when: 'Yesterday' })

  const youRank = byOdo.findIndex((m) => m.isYou)
  if (youRank >= 0) out.push({ id: 'a-you', kind: 'rank', text: `You're #${youRank + 1} in the group this week`, when: 'Yesterday' })

  const others = byOdo.filter((m) => !m.isYou)
  if (others[1]) out.push({ id: 'a-log', kind: 'log', text: `${handleOf(others[1])} logged a workout`, when: '2d ago' })
  const last = others[others.length - 1]
  if (last && last !== others[1]) out.push({ id: 'a-join', kind: 'join', text: `${handleOf(last)} joined the group`, when: '3d ago' })
  return out
}

/* --------------------------------- reactions ------------------------------- */

// Positive-only emoji reactions on an activity item (design spec). Client-side
// prototype state while the backend is off; a server-owned reaction model
// replaces this when COMMUNITY_BACKEND goes on.
const REACTION_EMOJIS = ['💪', '🔥', '👏', '🙌', '⚡', '🏆'] as const
type EmojiTally = { count: number; mine: boolean }
type ReactionMap = Record<string, EmojiTally> // emoji -> tally

/** Deterministic starting reactions per activity id, so the feed feels alive. */
function seedReactions(activityId: string): ReactionMap {
  const m: Record<string, ReactionMap> = {
    'a-streak': { '🔥': { count: 3, mine: false } },
    'a-vol': { '💪': { count: 5, mine: false }, '🔥': { count: 2, mine: false } },
    'a-odo': { '👏': { count: 2, mine: true } },
    'a-you': {},
    'a-log': { '🙌': { count: 1, mine: false } },
    'a-join': { '👏': { count: 4, mine: false } },
  }
  return { ...(m[activityId] ?? {}) }
}

/** Toggle the signed-in user's reaction with `emoji` on one activity. */
function toggleReaction(map: ReactionMap, emoji: string): ReactionMap {
  const next = { ...map }
  const e = next[emoji] ? { ...next[emoji] } : { count: 0, mine: false }
  if (e.mine) { e.count -= 1; e.mine = false } else { e.count += 1; e.mine = true }
  if (e.count <= 0) delete next[emoji]
  else next[emoji] = e
  return next
}

/* ---------------------------------- Tab ------------------------------------ */

type ActiveSheet =
  | { kind: 'create' }
  | { kind: 'join' }
  | { kind: 'detail'; id: string }
  | null

export function GroupsTab({ onClaimUsername }: { onClaimUsername: () => void }) {
  const { state, dispatch } = useStore()
  const me = useMemo(() => myLeaderStats(state), [state])
  const groups = state.community.groups
  const [sheet, setSheet] = useState<ActiveSheet>(null)

  // Backend on: hydrate the local group cache from the server (firebase loaded on
  // demand). Off: the seeded/local groups are the source of truth (unchanged).
  useEffect(() => {
    if (!COMMUNITY_BACKEND || !me.username) return
    let cancelled = false
    ;(async () => {
      try {
        const b = await import('./groupsBackend')
        const gs = await b.loadMyGroupsRemote()
        if (!cancelled) dispatch({ type: 'SET_COMMUNITY_GROUPS', groups: gs })
      } catch { /* keep the cached copy on failure */ }
    })()
    return () => { cancelled = true }
  }, [dispatch, me.username])

  // Browse-first: creating or joining needs an identity. Without a username, the
  // action opens the claim sheet instead.
  const guarded = (open: () => void) => () => (me.username ? open() : onClaimUsername())

  return (
    <View>
      <View className="flex-row gap-2.5">
        <Pressable
          onPress={guarded(() => setSheet({ kind: 'create' }))}
          accessibilityRole="button"
          accessibilityLabel="Create a group"
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-brand-400 py-3.5 active:opacity-90"
        >
          <Plus size={18} color="#000" />
          <Text className="text-[14px] font-bold text-black">Create group</Text>
        </Pressable>
        <Pressable
          onPress={guarded(() => setSheet({ kind: 'join' }))}
          accessibilityRole="button"
          accessibilityLabel="Join a group"
          className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 active:opacity-90"
        >
          <KeyRound size={18} color={brand[400]} />
          <Text className="text-[14px] font-bold text-white">Join group</Text>
        </Pressable>
      </View>

      {groups.length === 0 ? (
        <View className="mt-4 items-center rounded-2xl border border-dashed border-white/15 px-6 py-12">
          <Users size={28} color="rgba(255,255,255,0.35)" />
          <Text className="mt-3 font-bold text-white">No groups yet</Text>
          <Text className="mt-1 max-w-[240px] text-center text-[13px] text-secondary">
            Create a group and share the code with friends, or join one you've been invited to.
          </Text>
        </View>
      ) : (
        <View className="mt-4 gap-2.5">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} me={me} onOpen={() => setSheet({ kind: 'detail', id: g.id })} />
          ))}
        </View>
      )}

      <CreateGroupSheet
        open={sheet?.kind === 'create'}
        onClose={() => setSheet(null)}
        onCreated={(id) => setSheet({ kind: 'detail', id })}
      />
      <JoinGroupSheet open={sheet?.kind === 'join'} onClose={() => setSheet(null)} />
      <GroupDetailSheet
        open={sheet?.kind === 'detail'}
        groupId={sheet?.kind === 'detail' ? sheet.id : null}
        onClose={() => setSheet(null)}
      />
    </View>
  )
}

function GroupCard({ group, me, onOpen }: { group: CommunityGroup; me: MyLeaderStats; onOpen: () => void }) {
  const ranked = rankMembers(resolveMembers(group, me), 'odometer')
  const yourRank = ranked.findIndex((m) => m.isYou) + 1
  const owner = group.ownerUsername === me.username
  const { icon, color } = groupAppearance(group)
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name}`}
      className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90"
    >
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}1a` }}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="font-bold leading-tight text-white">{group.name}</Text>
          {owner && <Crown size={13} color="#F5C518" />}
        </View>
        <Text className="text-[12px] text-secondary">{ranked.length} member{ranked.length === 1 ? '' : 's'} · you're #{yourRank}</Text>
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
    </Pressable>
  )
}

/* ------------------------------ Create group ------------------------------- */

function CreateGroupSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const colors = useColors()
  const me = useMemo(() => myLeaderStats(state), [state])
  const [name, setName] = useState('')
  const [pick, setPick] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when the sheet reopens.
  useEffect(() => { if (open) { setName(''); setPick(0); setBusy(false); setError(null) } }, [open])

  const submit = async () => {
    setBusy(true)
    setError(null)
    const appearance = GROUP_ICONS[pick]
    if (COMMUNITY_BACKEND) {
      try {
        const b = await import('./groupsBackend')
        const { groupId, passcode } = await b.createGroupRemote(name.trim(), appearance.icon, appearance.color)
        const group: CommunityGroup = {
          id: groupId, name: name.trim(), passcode, ownerUsername: me.username ?? '',
          createdAtKey: todayKey, members: [youMember(me)], icon: appearance.icon, color: appearance.color, weeklyGoal: 0,
        }
        setBusy(false)
        dispatch({ type: 'CREATE_GROUP', group })
        toast('Group created — share the code')
        onClose()
        onCreated(groupId)
      } catch {
        setBusy(false)
        setError("Couldn't create the group. Try again.")
      }
      return
    }
    const res = await createGroup(name, me, todayKey, state.community.groups, appearance)
    setBusy(false)
    if (!res.ok) { setError(res.message); return }
    dispatch({ type: 'CREATE_GROUP', group: res.group })
    toast('Group created — share the code')
    onClose()
    onCreated(res.group.id)
  }

  const canSubmit = name.trim().length >= 2 && !busy

  return (
    <Sheet open={open} onClose={onClose} title="Create a group">
      <Text className="mb-4 text-[13px] leading-snug text-secondary">
        Start a private group and get a join code to share. You'll be the owner.
      </Text>
      <Text className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-tertiary">Group name</Text>
      <View className="flex-row items-center rounded-2xl border bg-ink-700 px-3.5" style={{ borderColor: error ? `${colors.danger}aa` : 'rgba(255,255,255,0.12)', height: 54 }}>
        <TextInput
          value={name}
          onChangeText={(t) => { setName(t.slice(0, 30)); setError(null) }}
          autoFocus
          maxLength={30}
          placeholder="e.g. West Hall Crew"
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Group name"
          className="flex-1 text-[16px] font-semibold text-white"
          style={{ color: colors.fg }}
        />
      </View>
      <View className="mt-2 min-h-[18px] px-1">
        {error
          ? <Text className="text-[12px] font-semibold" style={{ color: colors.danger }}>{error}</Text>
          : <Text className="text-[12px] text-tertiary">{name.trim().length}/30 · pick something your friends will recognise.</Text>}
      </View>

      <Text className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-tertiary">Icon</Text>
      <View className="flex-row flex-wrap gap-2.5">
        {GROUP_ICONS.map((g, i) => {
          const active = i === pick
          return (
            <Pressable
              key={g.icon}
              onPress={() => setPick(i)}
              accessibilityRole="button"
              accessibilityLabel={`Icon ${g.icon}`}
              accessibilityState={{ selected: active }}
              className="h-14 w-14 items-center justify-center rounded-2xl border-2"
              style={{ borderColor: active ? g.color : 'transparent', backgroundColor: `${g.color}1a` }}
            >
              <Icon name={g.icon} size={24} color={g.color} />
            </Pressable>
          )
        })}
      </View>

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Create group"
        accessibilityState={{ disabled: !canSubmit }}
        className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${canSubmit ? 'bg-brand-400 active:opacity-90' : 'bg-white/10'}`}
      >
        {busy && <ActivityIndicator size="small" color="#000" />}
        <Text className={`text-[15px] font-bold ${canSubmit ? 'text-black' : 'text-disabled'}`}>{busy ? 'Creating…' : 'Create group'}</Text>
      </Pressable>
    </Sheet>
  )
}

/* -------------------------------- Join group ------------------------------- */

function JoinGroupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const colors = useColors()
  const me = useMemo(() => myLeaderStats(state), [state])
  const joinedIds = state.community.groups.map((g) => g.id)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DiscoverableGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DiscoverableGroup | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tokenRef = useRef(0)

  useEffect(() => {
    if (open) { setQuery(''); setSelected(null); setCode(''); setError(null) }
  }, [open])

  // Debounced directory search (name only). Re-runs as the query changes.
  useEffect(() => {
    if (!open) return
    const token = ++tokenRef.current
    setLoading(true)
    const t = setTimeout(async () => {
      let res: DiscoverableGroup[]
      if (COMMUNITY_BACKEND) {
        const b = await import('./groupsBackend')
        const joined = new Set(joinedIds)
        res = (await b.searchGroupsRemote(query))
          .filter((h) => !joined.has(h.id))
          .map((h) => ({ id: h.id, name: h.name, passcode: '', memberCount: h.memberCount, icon: h.icon, color: h.color }))
      } else {
        res = await searchGroups(query, joinedIds)
      }
      if (token !== tokenRef.current) return
      setResults(res)
      setLoading(false)
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open])

  const submitJoin = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    if (COMMUNITY_BACKEND) {
      try {
        const b = await import('./groupsBackend')
        const { groupId, name } = await b.joinGroupRemote(selected.id, code)
        const full = await b.loadGroupRemote(groupId)
        setBusy(false)
        if (full) dispatch({ type: 'JOIN_GROUP_BY_CODE', group: full })
        toast(`Joined ${name}`)
        onClose()
      } catch {
        setBusy(false)
        setError("That code doesn't match this group.")
      }
      return
    }
    const res = await joinGroup(selected, code, me, todayKey, state.community.groups.map((g) => g.id))
    setBusy(false)
    if (!res.ok) {
      if (res.reason === 'duplicate') { toast(res.message); onClose(); return }
      setError(res.message)
      return
    }
    dispatch({ type: 'JOIN_GROUP_BY_CODE', group: res.group })
    toast(`Joined ${res.group.name}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Join a group">
      {selected ? (
        <View>
          <Pressable onPress={() => { setSelected(null); setCode(''); setError(null) }} accessibilityRole="button" accessibilityLabel="Back to search" className="mb-3 self-start active:opacity-70">
            <Text className="text-[13px] font-semibold text-brand-300">‹ Back to search</Text>
          </Pressable>
          <View className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5">
            <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${brand[400]}1a` }}>
              <Users size={22} color={brand[400]} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-white">{selected.name}</Text>
              <Text className="text-[12px] text-secondary">{selected.memberCount} members · private</Text>
            </View>
          </View>

          <Text className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-wide text-tertiary">Passcode</Text>
          <View className="flex-row items-center gap-2 rounded-2xl border bg-ink-700 px-3.5" style={{ borderColor: error ? `${colors.danger}aa` : 'rgba(255,255,255,0.12)', height: 54 }}>
            <KeyRound size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t.toUpperCase().slice(0, 8)); setError(null) }}
              autoFocus
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              placeholder="6-character code"
              placeholderTextColor="rgba(255,255,255,0.3)"
              accessibilityLabel="Group passcode"
              className="flex-1 text-[16px] font-bold tracking-[3px] text-white"
              style={{ color: colors.fg }}
            />
          </View>
          <View className="mt-2 min-h-[18px] px-1">
            {error && <Text className="text-[12px] font-semibold" style={{ color: colors.danger }}>{error}</Text>}
          </View>
          <Pressable
            onPress={submitJoin}
            disabled={busy || code.trim().length < 4}
            accessibilityRole="button"
            accessibilityLabel="Join group"
            accessibilityState={{ disabled: busy || code.trim().length < 4 }}
            className={`mt-3 flex-row items-center justify-center gap-2 rounded-2xl py-4 ${!busy && code.trim().length >= 4 ? 'bg-brand-400 active:opacity-90' : 'bg-white/10'}`}
          >
            {busy && <ActivityIndicator size="small" color="#000" />}
            <Text className={`text-[15px] font-bold ${!busy && code.trim().length >= 4 ? 'text-black' : 'text-disabled'}`}>{busy ? 'Joining…' : 'Join group'}</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <View className="flex-row items-center gap-2 rounded-2xl border border-white/12 bg-ink-700 px-3.5" style={{ height: 50 }}>
            <Search size={18} color="rgba(255,255,255,0.4)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search groups by name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              accessibilityLabel="Search groups by name"
              className="flex-1 text-[15px] text-white"
              style={{ color: colors.fg }}
            />
          </View>

          <View className="mt-4 gap-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
                  <Skeleton width={44} height={44} radius={14} />
                  <View className="flex-1 gap-1.5"><Skeleton width="55%" height={13} radius={5} /><Skeleton width="30%" height={10} radius={5} /></View>
                </View>
              ))
            ) : results.length === 0 ? (
              <View className="items-center rounded-2xl border border-dashed border-white/15 px-6 py-10">
                <Search size={24} color="rgba(255,255,255,0.35)" />
                <Text className="mt-2 font-bold text-white">No groups found</Text>
                <Text className="mt-1 max-w-[230px] text-center text-[13px] text-secondary">
                  {query.trim() ? 'Try a different name, or ask a friend for their group code.' : 'No public groups to show right now.'}
                </Text>
              </View>
            ) : (
              results.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => { setSelected(g); setError(null) }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${g.name}`}
                  className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3.5 active:opacity-90"
                >
                  <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${g.color}1a` }}>
                    <Icon name={g.icon} size={20} color={g.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-white">{g.name}</Text>
                    <Text className="text-[12px] text-secondary">{g.memberCount} members · code required</Text>
                  </View>
                  <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
                </Pressable>
              ))
            )}
          </View>
        </View>
      )}
    </Sheet>
  )
}

/* ------------------------------- Group detail ------------------------------ */

function GroupDetailSheet({ open, groupId, onClose }: { open: boolean; groupId: string | null; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const colors = useColors()
  const me = useMemo(() => myLeaderStats(state), [state])
  const group = state.community.groups.find((g) => g.id === groupId) ?? null
  const [metric, setMetric] = useState<GroupRankMetric>('odometer')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [transferMode, setTransferMode] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Record<string, ReactionMap>>({})
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [volInfoOpen, setVolInfoOpen] = useState(false)
  const [goalEditing, setGoalEditing] = useState(false)
  const [goalDraft, setGoalDraft] = useState(20)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) { setMetric('odometer'); setConfirmDelete(false); setConfirmLeave(false); setTransferMode(false); setExpandedId(null); setReactions({}); setPickerFor(null); setCopied(false); setVolInfoOpen(false); setGoalEditing(false); setGoalDraft(20) }
  }, [open, groupId])
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  const owner = !!group && group.ownerUsername === me.username

  const react = (activityId: string, emoji: string) => {
    setReactions((prev) => ({ ...prev, [activityId]: toggleReaction(prev[activityId] ?? seedReactions(activityId), emoji) }))
    setPickerFor(null)
  }

  const copyCode = async () => {
    if (!group) return
    try {
      await Clipboard.setStringAsync(group.passcode)
      // Flip the button to "Copied" for ~1.6s (design spec) instead of a toast.
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 1600)
    } catch { toast("Couldn't copy") }
  }
  const leave = async () => {
    if (!group) return
    if (COMMUNITY_BACKEND) { try { const b = await import('./groupsBackend'); await b.leaveGroupRemote(group.id) } catch { /* optimistic */ } }
    dispatch({ type: 'LEAVE_GROUP', id: group.id })
    toast(`Left ${group.name}`)
    onClose()
  }
  const remove = async () => {
    if (!group) return
    if (COMMUNITY_BACKEND) { try { const b = await import('./groupsBackend'); await b.deleteGroupRemote(group.id) } catch { /* optimistic */ } }
    dispatch({ type: 'DELETE_GROUP', id: group.id })
    toast('Group deleted')
    onClose()
  }
  // Transfer ownership to another member (owner stays in the group). A server
  // transfer callable lands with the groups backend (governance is deferred);
  // this drives the local/preview model.
  const makeOwner = (username: string) => {
    if (!group) return
    dispatch({ type: 'TRANSFER_GROUP_OWNER', id: group.id, newOwnerUsername: username })
    setExpandedId(null)
    toast(`@${username} is now the owner`)
  }
  // Owner hands the group to a successor and leaves in one step.
  const makeOwnerAndLeave = (username: string) => {
    if (!group) return
    dispatch({ type: 'TRANSFER_GROUP_OWNER', id: group.id, newOwnerUsername: username })
    dispatch({ type: 'LEAVE_GROUP', id: group.id })
    toast(`Handed ${group.name} to @${username}`)
    onClose()
  }
  const cancelAction = () => { setConfirmLeave(false); setConfirmDelete(false); setTransferMode(false) }

  const ranked = useMemo(
    () => (group ? rankMembers(resolveMembers(group, me), metric) : []),
    [group, me, metric],
  )
  const pulse = useMemo(() => groupPulse(ranked), [ranked])
  const activity = useMemo(() => buildActivity(ranked), [ranked])
  const sessionsDone = ranked.reduce((a, m) => a + (m.sessionsThisWeek ?? 0), 0)
  // A group has no goal until the owner sets one (weeklyGoal falsy = unset).
  const goal = group?.weeklyGoal ?? 0
  const hasGoal = goal > 0
  const saveGoal = (next: number) => {
    if (!group) return
    const clamped = Math.max(1, Math.min(200, next))
    if (COMMUNITY_BACKEND) { import('./groupsBackend').then((b) => b.setGroupGoalRemote(group.id, clamped)).catch(() => {}) }
    dispatch({ type: 'SET_GROUP_GOAL', id: group.id, goal: clamped })
    setGoalEditing(false)
  }
  const openGoalEditor = () => { setGoalDraft(hasGoal ? goal : 20); setGoalEditing(true) }

  return (
    <Sheet open={open} onClose={onClose} title={group?.name ?? 'Group'}>
      {!group ? (
        <EmptyDetail />
      ) : (
        <View>
          {/* meta + owner badge */}
          <View className="flex-row items-center gap-2">
            {owner ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-[#F5C518]/15 px-2.5 py-1">
                <Crown size={12} color="#F5C518" />
                <Text className="text-[11px] font-bold text-[#F5C518]">You own this group</Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1">
                <ShieldCheck size={12} color="rgba(255,255,255,0.6)" />
                <Text className="text-[11px] font-bold text-secondary">@{group.ownerUsername}'s group</Text>
              </View>
            )}
            <Text className="text-[12px] text-secondary">{ranked.length} member{ranked.length === 1 ? '' : 's'}</Text>
          </View>

          {/* group pulse */}
          <PulseHeader pulse={pulse} />

          {/* what the numbers mean */}
          <View className="mt-2 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <Pressable onPress={() => setVolInfoOpen((v) => !v)} accessibilityRole="button" accessibilityLabel="What the numbers mean" accessibilityState={{ expanded: volInfoOpen }} className="flex-row items-center gap-2">
              <Info size={14} color="rgba(255,255,255,0.4)" />
              <Text className="flex-1 text-[11px] font-bold text-secondary">What the numbers mean</Text>
              <ChevronDown size={15} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: volInfoOpen ? '180deg' : '0deg' }] }} />
            </Pressable>
            {volInfoOpen && (
              <Text className="mt-2 pl-[22px] text-[11px] leading-relaxed text-tertiary">
                <Text className="font-bold text-secondary">Volume</Text> is the total weight lifted across all workouts (sets × reps × weight). <Text className="font-bold text-secondary">Odometer</Text> is your weekly consistency score out of 100.
              </Text>
            )}
          </View>

          {/* shared weekly team goal — owner-set, with member/empty states */}
          {owner && (!hasGoal || goalEditing) ? (
            <TeamGoalSetter
              draft={goalDraft}
              color={groupAppearance(group).color}
              onDec={() => setGoalDraft((d) => Math.max(4, d - 2))}
              onInc={() => setGoalDraft((d) => Math.min(60, d + 2))}
              onSave={() => saveGoal(goalDraft)}
            />
          ) : hasGoal ? (
            <TeamGoalCard done={sessionsDone} goal={goal} owner={owner} color={groupAppearance(group).color} onEdit={openGoalEditor} />
          ) : (
            <View className="mt-3 flex-row items-center gap-2.5 rounded-2xl border border-white/6 bg-white/[0.02] p-3.5">
              <Target size={16} color="rgba(255,255,255,0.4)" />
              <Text className="text-[13px] leading-snug text-tertiary">No weekly team goal yet. The group owner can set one.</Text>
            </View>
          )}

          {/* invite code */}
          <View className="mt-4 rounded-2xl border border-white/8 bg-ink-800 p-3.5">
            <Text className="text-[11px] font-semibold uppercase tracking-wide text-tertiary">Invite code</Text>
            <View className="mt-1.5 flex-row items-center justify-between">
              <Text className="text-[22px] font-black tracking-[4px] text-white">{group.passcode}</Text>
              <Pressable
                onPress={copyCode}
                accessibilityRole="button"
                accessibilityLabel={copied ? 'Copied' : 'Copy invite code'}
                className="h-9 flex-row items-center gap-1.5 rounded-full bg-brand-400 px-3.5 active:opacity-90"
              >
                {copied ? <Check size={15} color="#000" strokeWidth={2.6} /> : <Copy size={15} color="#000" />}
                <Text className="text-[13px] font-bold text-black">{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          </View>

          {/* ranking metric toggle */}
          <View className="mt-5 flex-row items-center gap-1.5">
            <Gauge size={14} color={brand[400]} />
            <Text className="text-[12px] font-semibold uppercase tracking-wide text-tertiary">Rank by</Text>
          </View>
          <View className="mt-2 flex-row gap-2 rounded-2xl bg-ink-700 p-1">
            {METRICS.map((m) => {
              const active = metric === m.key
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMetric(m.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rank by ${m.label}`}
                  accessibilityState={{ selected: active }}
                  className={`flex-1 items-center rounded-xl py-2 ${active ? 'bg-brand-400' : ''} active:opacity-80`}
                >
                  <Text className={`text-[13px] font-bold ${active ? 'text-black' : 'text-secondary'}`}>{m.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {/* members */}
          <View className="mt-4 gap-1.5">
            {ranked.map((m, i) => (
              <MemberRow
                key={m.id}
                member={m}
                rank={i + 1}
                metric={metric}
                expanded={expandedId === m.id}
                onToggle={() => setExpandedId((id) => (id === m.id ? null : m.id))}
                canMakeOwner={owner && !m.isYou}
                onMakeOwner={() => makeOwner(m.username)}
              />
            ))}
          </View>

          {/* activity feed */}
          {activity.length > 0 && (
            <>
              <View className="mb-2 mt-6 flex-row items-center gap-1.5">
                <Activity size={14} color={brand[400]} />
                <Text className="text-[12px] font-semibold uppercase tracking-wide text-tertiary">Recent activity</Text>
              </View>
              <View className="gap-2">
                {activity.map((a) => (
                  <ActivityRow
                    key={a.id}
                    item={a}
                    reactions={reactions[a.id] ?? seedReactions(a.id)}
                    pickerOpen={pickerFor === a.id}
                    onTogglePicker={() => setPickerFor((p) => (p === a.id ? null : a.id))}
                    onReact={(emoji) => react(a.id, emoji)}
                  />
                ))}
              </View>
            </>
          )}

          {/* leave / ownership / delete */}
          <View className="mt-7">
            <OwnershipFooter
              owner={owner}
              others={ranked.filter((m) => !m.isYou)}
              danger={colors.danger}
              confirmLeave={confirmLeave}
              confirmDelete={confirmDelete}
              transferMode={transferMode}
              onAskLeave={() => (owner ? setTransferMode(true) : setConfirmLeave(true))}
              onAskDelete={() => setConfirmDelete(true)}
              onCancel={cancelAction}
              onLeave={leave}
              onDelete={remove}
              onHandOver={makeOwnerAndLeave}
            />
          </View>
        </View>
      )}
    </Sheet>
  )
}

/* ------------------------------ ownership footer --------------------------- */

/** The leave / delete / transfer controls, which differ by role:
 *  - member: leave (confirm)
 *  - owner, only member: leave == delete (confirm)
 *  - owner with others: leave requires choosing a successor; or delete (confirm) */
function OwnershipFooter({ owner, others, danger, confirmLeave, confirmDelete, transferMode, onAskLeave, onAskDelete, onCancel, onLeave, onDelete, onHandOver }: {
  owner: boolean
  others: GroupMember[]
  danger: string
  confirmLeave: boolean
  confirmDelete: boolean
  transferMode: boolean
  onAskLeave: () => void
  onAskDelete: () => void
  onCancel: () => void
  onLeave: () => void
  onDelete: () => void
  onHandOver: (username: string) => void
}) {
  const CancelBtn = (
    <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" className="items-center py-2.5 active:opacity-70">
      <Text className="text-[13px] font-bold text-tertiary">Cancel</Text>
    </Pressable>
  )
  const DeleteConfirm = ({ note }: { note: string }) => (
    <View className="gap-2">
      <Text className="px-2 pb-0.5 text-center text-[12px] leading-snug text-secondary">{note}</Text>
      <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete group permanently" className="flex-row items-center justify-center gap-2 rounded-2xl border py-3.5 active:opacity-90" style={{ borderColor: `${danger}80`, backgroundColor: `${danger}29` }}>
        <Trash2 size={16} color={danger} />
        <Text className="text-[14px] font-extrabold" style={{ color: danger }}>Delete group permanently</Text>
      </Pressable>
      {CancelBtn}
    </View>
  )

  // Member
  if (!owner) {
    return confirmLeave ? (
      <View className="gap-2">
        <Pressable onPress={onLeave} accessibilityRole="button" accessibilityLabel="Confirm leave group" className="flex-row items-center justify-center gap-2 rounded-2xl border py-3.5 active:opacity-90" style={{ borderColor: `${danger}80`, backgroundColor: `${danger}29` }}>
          <LogOut size={16} color={danger} />
          <Text className="text-[14px] font-extrabold" style={{ color: danger }}>Are you sure you want to leave group?</Text>
        </Pressable>
        {CancelBtn}
      </View>
    ) : (
      <Pressable onPress={onAskLeave} accessibilityRole="button" accessibilityLabel="Leave group" className="flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 py-3.5 active:opacity-80">
        <LogOut size={16} color="rgba(255,255,255,0.7)" />
        <Text className="text-[14px] font-bold text-secondary">Leave group</Text>
      </Pressable>
    )
  }

  // Owner, sole member → leaving deletes
  if (others.length === 0) {
    return confirmDelete ? (
      <DeleteConfirm note="You're the only member, so leaving deletes this group for good." />
    ) : (
      <Pressable onPress={onAskDelete} accessibilityRole="button" accessibilityLabel="Delete group" className="flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 py-3.5 active:opacity-80">
        <Trash2 size={16} color={danger} />
        <Text className="text-[14px] font-bold" style={{ color: danger }}>Delete group</Text>
      </Pressable>
    )
  }

  // Owner with other members
  if (transferMode) {
    return (
      <View>
        <Text className="text-[13px] font-bold text-white">Choose who takes over</Text>
        <Text className="mt-0.5 text-[12px] leading-snug text-tertiary">A group always needs an owner. Pick a member to hand the group to, and you'll leave once they take over.</Text>
        <View className="mt-3 gap-2">
          {others.map((m) => (
            <Pressable key={m.id} onPress={() => onHandOver(m.username)} accessibilityRole="button" accessibilityLabel={`Hand over to ${m.username}`} className="flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-90" style={{ borderColor: 'rgba(245,197,24,0.25)', backgroundColor: 'rgba(245,197,24,0.06)' }}>
              <Avatar name={m.username} size={36} />
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-bold text-white">@{m.username}</Text>
                <Text className="text-[12px] text-tertiary">{m.streak}-day streak · {m.odometer}/100</Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(245,197,24,0.15)' }}>
                <Crown size={12} color="#F5C518" />
                <Text className="text-[11px] font-bold text-[#F5C518]">Hand over</Text>
              </View>
            </Pressable>
          ))}
        </View>
        {CancelBtn}
      </View>
    )
  }
  if (confirmDelete) return <DeleteConfirm note="This deletes the group for all members. This can't be undone." />
  return (
    <View className="flex-row gap-2.5">
      <Pressable onPress={onAskLeave} accessibilityRole="button" accessibilityLabel="Leave group" className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-white/10 py-3.5 active:opacity-80">
        <LogOut size={16} color="rgba(255,255,255,0.7)" />
        <Text className="text-[14px] font-bold text-secondary">Leave group</Text>
      </Pressable>
      <Pressable onPress={onAskDelete} accessibilityRole="button" accessibilityLabel="Delete group" className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border py-3.5 active:opacity-80" style={{ borderColor: `${danger}40` }}>
        <Trash2 size={16} color={danger} />
        <Text className="text-[14px] font-bold" style={{ color: danger }}>Delete</Text>
      </Pressable>
    </View>
  )
}

/* ------------------------------- pulse header ------------------------------ */

function PulseHeader({ pulse }: { pulse: ReturnType<typeof groupPulse> }) {
  return (
    <View className="mt-4 flex-row gap-2">
      <PulseTile label="7-day volume" value={formatKgCompact(pulse.volume7)} sub="kg" />
      <PulseTile label="Avg odometer" value={`${pulse.avgOdometer}`} sub="/100" />
      <PulseTile label="Top streak" value={`${pulse.topStreak}`} sub="days" />
    </View>
  )
}

function PulseTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-white/8 bg-ink-800 px-3 py-2.5">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-tertiary">{label}</Text>
      <View className="mt-1 flex-row items-baseline gap-1">
        <Text className="text-[18px] font-black text-white">{value}</Text>
        <Text className="text-[10px] text-tertiary">{sub}</Text>
      </View>
    </View>
  )
}

/* ------------------------------ team goal card ----------------------------- */

/** Shared weekly objective: combined member sessions vs the group's target.
 *  Everyone sees the same progress; the owner gets an Edit affordance. */
function TeamGoalCard({ done, goal, owner, color, onEdit }: {
  done: number
  goal: number
  owner: boolean
  color: string
  onEdit: () => void
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0
  const reached = done >= goal
  const remaining = Math.max(0, goal - done)
  return (
    <View className="mt-3 rounded-2xl border border-white/8 bg-ink-800 p-4">
      <View className="flex-row items-center gap-2">
        <Target size={16} color={color} />
        <Text className="flex-1 text-[13px] font-bold text-white">Weekly team goal</Text>
        {owner && (
          <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Edit team goal" hitSlop={6} className="flex-row items-center gap-1 active:opacity-70">
            <Pencil size={13} color="rgba(255,255,255,0.5)" />
            <Text className="text-[12px] font-semibold text-secondary">Edit</Text>
          </Pressable>
        )}
      </View>
      <View className="mt-2 flex-row items-baseline gap-1.5">
        <Text className="text-[24px] font-black text-white">{done}</Text>
        <Text className="text-[14px] font-semibold text-secondary">/ {goal} sessions this week</Text>
      </View>
      <ProgressBar value={pct} color={color} className="mt-2.5" height={9} />
      <Text className="mt-2 text-[12px] font-semibold" style={{ color: reached ? color : 'rgba(255,255,255,0.5)' }}>
        {reached ? 'Goal smashed — nice work, team!' : `${remaining} more to hit the goal`}
      </Text>
    </View>
  )
}

/** Owner-only card to set (or edit) the weekly team goal — new groups start with
 *  no goal until this is used. ±2 sessions, 4–60. */
function TeamGoalSetter({ draft, color, onDec, onInc, onSave }: {
  draft: number
  color: string
  onDec: () => void
  onInc: () => void
  onSave: () => void
}) {
  return (
    <View className="mt-3 rounded-2xl border border-dashed border-white/16 bg-ink-800 p-4">
      <View className="flex-row items-center gap-2">
        <Target size={16} color={color} />
        <Text className="flex-1 text-[13px] font-bold text-white">Set a weekly team goal</Text>
      </View>
      <Text className="mt-1 text-[12px] leading-snug text-tertiary">
        Choose how many workouts the group aims to log together each week. There's no goal until you set one.
      </Text>
      <View className="mt-3.5 flex-row items-center gap-3.5">
        <Pressable onPress={onDec} accessibilityRole="button" accessibilityLabel="Lower goal" className="h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] active:opacity-70">
          <Minus size={18} color="#fff" />
        </Pressable>
        <View className="flex-1 items-center">
          <Text className="text-[30px] font-black text-white">{draft}</Text>
          <Text className="text-[11px] font-semibold uppercase tracking-wide text-tertiary">sessions / week</Text>
        </View>
        <Pressable onPress={onInc} accessibilityRole="button" accessibilityLabel="Raise goal" className="h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] active:opacity-70">
          <Plus size={18} color="#fff" />
        </Pressable>
      </View>
      <Pressable onPress={onSave} accessibilityRole="button" accessibilityLabel="Set goal" className="mt-3.5 items-center justify-center rounded-2xl bg-brand-400 py-3.5 active:opacity-90">
        <Text className="text-[14px] font-bold text-black">Set goal</Text>
      </Pressable>
    </View>
  )
}

/* --------------------------------- members --------------------------------- */

function MemberRow({ member, rank, metric, expanded, onToggle, canMakeOwner, onMakeOwner }: {
  member: GroupMember
  rank: number
  metric: GroupRankMetric
  expanded: boolean
  onToggle: () => void
  canMakeOwner: boolean
  onMakeOwner: () => void
}) {
  const colors = useColors()
  const you = !!member.isYou
  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={you ? { borderColor: `${brand[400]}66`, backgroundColor: `${brand[400]}12` } : { borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${member.username} stats`}
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3 p-3 active:opacity-90"
      >
        <RankBadge rank={rank} size={28} />
        <Avatar name={member.username} size={36} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={1} className={`font-bold leading-tight ${you ? 'text-brand-300' : 'text-white'}`}>@{member.username}{you ? ' (You)' : ''}</Text>
            {rank === 1 && (
              <View className="flex-row items-center gap-1 rounded-full bg-[#F5C518]/15 px-1.5 py-0.5">
                <Crown size={10} color="#F5C518" />
                <Text className="text-[9px] font-bold tracking-wide text-[#F5C518]">LEADER</Text>
              </View>
            )}
          </View>
          <Text className="text-[12px] text-tertiary">{formatKgCompact(member.volume30)} kg · 30d</Text>
        </View>
        <MetricValue member={member} metric={metric} colors={colors} />
        <ChevronDown size={16} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
      </Pressable>
      {expanded && <MemberStats member={member} rank={rank} colors={colors} canMakeOwner={canMakeOwner} onMakeOwner={onMakeOwner} />}
    </View>
  )
}

function MemberStats({ member, rank, colors, canMakeOwner, onMakeOwner }: { member: GroupMember; rank: number; colors: ReturnType<typeof useColors>; canMakeOwner: boolean; onMakeOwner: () => void }) {
  const best = member.bestStreak ?? member.streak
  const tiles: { label: string; value: string; sub?: string; color?: string }[] = [
    { label: 'Odometer', value: `${member.odometer}`, sub: '/100', color: odometerColor(member.odometer, colors) },
    { label: 'Streak', value: `${member.streak}`, sub: 'days' },
    { label: 'Best streak', value: `${best}`, sub: 'days' },
    { label: 'Volume 7d', value: formatKgCompact(member.volume7), sub: 'kg' },
    { label: 'Volume 30d', value: formatKgCompact(member.volume30), sub: 'kg' },
    { label: 'Group rank', value: `#${rank}` },
  ]
  return (
    <View className="border-t border-white/8 px-2 pb-2 pt-2">
      <View className="flex-row flex-wrap">
        {tiles.map((t) => (
          <View key={t.label} style={{ width: '33.333%', padding: 4 }}>
            <View className="rounded-xl bg-white/[0.04] px-2.5 py-2">
              <Text numberOfLines={1} className="text-[9px] font-semibold uppercase tracking-wide text-tertiary">{t.label}</Text>
              <View className="mt-0.5 flex-row items-baseline gap-1">
                <Text className="text-[16px] font-black" style={{ color: t.color ?? '#fff' }}>{t.value}</Text>
                {t.sub ? <Text className="text-[10px] text-tertiary">{t.sub}</Text> : null}
              </View>
            </View>
          </View>
        ))}
        {canMakeOwner && (
          <View style={{ width: '100%', padding: 4 }}>
            <Pressable
              onPress={onMakeOwner}
              accessibilityRole="button"
              accessibilityLabel={`Make @${member.username} the group owner`}
              className="flex-row items-center justify-center gap-2 rounded-xl border py-3 active:opacity-80"
              style={{ borderColor: 'rgba(245,197,24,0.3)', backgroundColor: 'rgba(245,197,24,0.1)' }}
            >
              <Crown size={14} color="#F5C518" />
              <Text className="text-[13px] font-bold text-[#F5C518]">Make group owner</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  )
}

function MetricValue({ member, metric, colors }: { member: GroupMember; metric: GroupRankMetric; colors: ReturnType<typeof useColors> }) {
  if (metric === 'streak') return <StreakFlame days={member.streak} size={16} />
  if (metric === 'volume') {
    return (
      <View className="items-end">
        <Text className="text-[15px] font-black text-white">{formatKgCompact(member.volume7)}</Text>
        <Text className="text-[10px] font-semibold text-tertiary">kg · 7d</Text>
      </View>
    )
  }
  // odometer
  return (
    <View className="items-end">
      <Text className="text-[16px] font-black" style={{ color: odometerColor(member.odometer, colors) }}>{member.odometer}</Text>
      <Text className="text-[10px] font-semibold text-tertiary">/ 100</Text>
    </View>
  )
}

/* ------------------------------- activity feed ----------------------------- */

const ACTIVITY_STYLE: Record<ActivityKind, { Glyph: typeof Flame; color: string }> = {
  streak: { Glyph: Flame, color: '#F5A524' },
  volume: { Glyph: Dumbbell, color: '#7ED957' },
  odometer: { Glyph: TrendingUp, color: '#3B82F6' },
  rank: { Glyph: ArrowUp, color: '#8B5CF6' },
  log: { Glyph: CheckCircle2, color: '#06B6D4' },
  join: { Glyph: UserPlus, color: '#EC4899' },
}

function ActivityRow({ item, reactions, pickerOpen, onTogglePicker, onReact }: {
  item: GroupActivity
  reactions: ReactionMap
  pickerOpen: boolean
  onTogglePicker: () => void
  onReact: (emoji: string) => void
}) {
  const s = ACTIVITY_STYLE[item.kind]
  const Glyph = s.Glyph
  // Emojis that have at least one reaction, shown as toggleable count pills.
  const active = REACTION_EMOJIS.filter((e) => reactions[e] && reactions[e].count > 0)
  return (
    <View className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${s.color}1a` }}>
          <Glyph size={16} color={s.color} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] leading-snug text-white/80">{item.text}</Text>
          <Text className="text-[11px] text-tertiary">{item.when}</Text>
        </View>
        <Pressable
          onPress={onTogglePicker}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add a reaction"
          accessibilityState={{ expanded: pickerOpen }}
          className="flex-row items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1.5 active:opacity-80"
        >
          <SmilePlus size={16} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      {/* reaction count pills */}
      {active.length > 0 && (
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          {active.map((e) => {
            const t = reactions[e]
            return (
              <Pressable
                key={e}
                onPress={() => onReact(e)}
                accessibilityRole="button"
                accessibilityLabel={`${t.mine ? 'Remove' : 'Add'} ${e} reaction`}
                accessibilityState={{ selected: t.mine }}
                className="flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-80"
                style={{ borderWidth: 1, borderColor: t.mine ? `${brand[400]}80` : 'transparent', backgroundColor: t.mine ? `${brand[400]}26` : 'rgba(255,255,255,0.06)' }}
              >
                <Text className="text-[13px]">{e}</Text>
                <Text className="text-[12px] font-bold" style={{ color: t.mine ? brand[300] : 'rgba(255,255,255,0.6)' }}>{t.count}</Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {/* floating emoji popover */}
      {pickerOpen && (
        <>
          <Pressable onPress={onTogglePicker} accessibilityLabel="Close reactions" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4 }} />
          <View
            className="absolute right-2.5 top-2 z-10 flex-row gap-0.5 rounded-full border border-white/10 bg-ink-700 p-1.5"
            style={{ shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 26, shadowOffset: { width: 0, height: 10 } }}
          >
            {REACTION_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => onReact(e)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${e}`}
                className="h-8 w-8 items-center justify-center rounded-full active:opacity-70"
                style={{ backgroundColor: reactions[e]?.mine ? `${brand[400]}33` : 'transparent' }}
              >
                <Text className="text-[18px]">{e}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function EmptyDetail() {
  return (
    <View className="items-center py-12">
      <Users size={28} color="rgba(255,255,255,0.35)" />
      <Text className="mt-3 font-bold text-white">Group unavailable</Text>
      <Text className="mt-1 text-[13px] text-secondary">It may have been deleted.</Text>
    </View>
  )
}
