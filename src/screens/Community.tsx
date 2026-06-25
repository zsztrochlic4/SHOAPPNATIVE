import { useState } from 'react'
import { View, Text, Pressable, Image, ScrollView } from 'react-native'
import {
  Users, Heart, MessageCircle, Bookmark, ChevronRight, MoreHorizontal, CalendarClock,
  HeartHandshake, Award, UserPlus, Swords,
} from 'lucide-react-native'
import { Icon } from '../components/Icon'
import { Avatar, AvatarStack } from '../components/Avatar'
import { ProgressRing, ProgressBar, SegmentedTabs, ScreenHeader, SectionHeader, Chip } from '../components/ui'
import { Hero } from '../components/Hero'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { img } from '../data/catalog'
import { youRank } from '../store/selectors'
import { brand, useColors } from '../theme'
import type { Challenge, CommunityScope, Post } from '../store/types'

const TABS = ['Feed', 'Groups', 'Challenges', 'Events']

export default function Community() {
  const [tab, setTab] = useState('Feed')
  const nav = useNav()
  const colors = useColors()
  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Community"
        trailing={
          <Pressable onPress={() => nav.open('leaderboard')} className="relative h-10 w-10 items-center justify-center rounded-xl active:opacity-70">
            <Users size={22} color={colors.fg} />
            <View className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-400" style={{ borderWidth: 2, borderColor: colors.ink900 }} />
          </Pressable>
        }
      />
      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      <View className="mt-5">
        {tab === 'Feed' && <FeedTab />}
        {tab === 'Groups' && <GroupList />}
        {tab === 'Challenges' && <ChallengesTab />}
        {tab === 'Events' && <EventsTab />}
      </View>
    </View>
  )
}

const SCOPES: { id: CommunityScope; label: (p: { university: string; dorm: string; society: string }) => string }[] = [
  { id: 'campus', label: (p) => p.university },
  { id: 'dorm', label: (p) => p.dorm },
  { id: 'society', label: (p) => p.society },
]

function FeedTab() {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const [scope, setScope] = useState<CommunityScope>('campus')
  const featured =
    scope === 'dorm'
      ? state.challenges.find((c) => c.scope === 'dorm')
      : scope === 'society'
        ? state.challenges.find((c) => c.scope === 'society')
        : state.challenges.find((c) => c.joined && c.scope === 'campus')

  return (
    <>
      <Hero image={img.community} rounded={16}>
        <Users size={26} color={brand[400]} />
        <Text className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-white">Your campus,{'\n'}<Text className="text-brand-400">your people.</Text></Text>
        <Text className="mt-2 max-w-[230px] text-[13px] leading-snug text-white/65">Train alongside students in your halls and societies, not strangers across the world.</Text>
        <View className="mt-4 flex-row gap-2">
          <Pressable onPress={() => nav.open('createPost')} className="btn-primary px-4 py-2.5 active:opacity-90">
            <Text className="text-sm font-semibold text-black">Share something</Text>
          </Pressable>
          <Pressable onPress={() => nav.open('partnerMatch')} className="flex-row items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 active:opacity-90">
            <UserPlus size={15} color="#fff" />
            <Text className="text-sm font-semibold text-white">Find a partner</Text>
          </Pressable>
        </View>
      </Hero>

      {/* scope selector */}
      <View className="mt-4 flex-row gap-2">
        {SCOPES.map((s) => {
          const active = scope === s.id
          return (
            <Pressable key={s.id} onPress={() => setScope(s.id)} className={`flex-1 items-center rounded-full py-2 active:opacity-80 ${active ? 'bg-brand-400' : 'bg-ink-700'}`}>
              <Text numberOfLines={1} className={`text-[13px] font-semibold ${active ? 'text-black' : 'text-white/60'}`}>{s.label(state.profile)}</Text>
            </Pressable>
          )
        })}
      </View>

      <SectionHeader title="What's happening" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerStyle={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 4 }}>
        {state.posts.map((p) => <FeedCard key={p.id} post={p} onLike={() => dispatch({ type: 'TOGGLE_LIKE', postId: p.id })} onKudos={() => dispatch({ type: 'GIVE_KUDOS', postId: p.id })} onBookmark={() => dispatch({ type: 'TOGGLE_BOOKMARK', postId: p.id })} onComment={() => nav.open('postDetail', { postId: p.id })} />)}
      </ScrollView>

      {featured && (
        <>
          <SectionHeader title={scope === 'campus' ? 'Active challenge' : 'Belonging challenge'} />
          <ChallengeCard c={featured} onJoin={() => dispatch({ type: 'JOIN_CHALLENGE', id: featured.id })} />
        </>
      )}

      <Pressable onPress={() => nav.open('leaderboard')} className="mt-4 w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
        <Award size={24} color={brand[400]} />
        <View className="flex-1">
          <Text className="font-bold text-white">Campus leaderboard</Text>
          <Text className="text-[13px] text-white/50">You're #{youRank(state)} at {state.profile.university}</Text>
        </View>
        <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
      </Pressable>

      <SectionHeader title="Your societies" />
      <GroupList />
      <View className="h-2" />
    </>
  )
}

function FeedCard({ post: p, onLike, onKudos, onBookmark, onComment }: { post: Post; onLike: () => void; onKudos: () => void; onBookmark: () => void; onComment: () => void }) {
  return (
    <View className="w-[268px] shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
      <View className="flex-row items-center gap-2.5 p-3">
        <Avatar name={p.author} size={36} />
        <View className="flex-1">
          <Text className="text-sm font-bold leading-tight text-white">{p.author}</Text>
          <Text className="text-[12px] text-white/45">{p.time}</Text>
        </View>
        <MoreHorizontal size={18} color="rgba(255,255,255,0.4)" />
      </View>
      {p.pr && (
        <View className="mx-3 mb-2 flex-row items-center gap-1.5 self-start rounded-full bg-brand-400/15 px-2.5 py-1">
          <Award size={13} color={brand[300]} />
          <Text className="text-[11px] font-bold text-brand-300">Personal best · {p.pr.lift} {p.pr.weight}</Text>
        </View>
      )}
      <Text className="px-3 pb-3 text-[14px] leading-snug text-white">{p.text}</Text>
      {p.image && <Image source={{ uri: p.image }} resizeMode="cover" className="h-36 w-full" />}
      {p.ring && (
        <View className="mx-3 mb-3 items-center rounded-xl bg-ink-700 py-5">
          <ProgressRing value={p.ring} size={92} stroke={8}><Text className="text-xl font-extrabold text-white">{p.ring}%</Text></ProgressRing>
          <Text className="mt-2 text-[10px] font-semibold tracking-wider text-white/45">{p.ringLabel}</Text>
        </View>
      )}
      <View className="flex-row items-center gap-3 p-3">
        <Pressable onPress={onLike} className="flex-row items-center gap-1.5 active:opacity-70">
          <Heart size={17} color={p.liked ? brand[400] : 'rgba(255,255,255,0.55)'} fill={p.liked ? brand[400] : 'none'} />
          <Text className={`text-sm ${p.liked ? 'text-brand-400' : 'text-white/55'}`}>{p.likes}</Text>
        </Pressable>
        <Pressable onPress={onKudos} className="flex-row items-center gap-1.5 active:opacity-70">
          <HeartHandshake size={17} color={p.gaveKudos ? brand[400] : 'rgba(255,255,255,0.55)'} />
          <Text className={`text-sm ${p.gaveKudos ? 'text-brand-400' : 'text-white/55'}`}>{p.kudos ?? 0}</Text>
        </Pressable>
        <Pressable onPress={onComment} className="flex-row items-center gap-1.5 active:opacity-70">
          <MessageCircle size={17} color="rgba(255,255,255,0.55)" />
          <Text className="text-sm text-white/55">{p.comments}</Text>
        </Pressable>
        <Pressable onPress={onBookmark} className="ml-auto active:opacity-70">
          <Bookmark size={17} color={p.bookmarked ? brand[400] : 'rgba(255,255,255,0.45)'} fill={p.bookmarked ? brand[400] : 'none'} />
        </Pressable>
      </View>
    </View>
  )
}

function ChallengeCard({ c, onJoin }: { c: Challenge; onJoin: () => void }) {
  const nav = useNav()
  return (
    <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-center gap-4">
        <ProgressRing value={c.progressPct || 1} size={62} stroke={5}>
          <Text className="text-lg font-extrabold leading-none text-white">{c.weeks}</Text>
          <Text className="text-[8px] font-semibold tracking-wide text-white/50">WEEKS</Text>
        </ProgressRing>
        <View className="flex-1">
          <Text className="font-bold leading-tight text-white">{c.title}</Text>
          <View className="mt-1.5 flex-row items-center gap-2">
            <AvatarStack names={['Alex M', 'Sophie L', 'Jayden K', 'Mia R', 'Dan P']} size={24} />
            <Text className="text-[12px] font-semibold text-white/55">+{c.participants}</Text>
          </View>
        </View>
        {c.rank != null && (
          <View className="items-end">
            <Text className="text-[11px] text-white/45">Your rank</Text>
            <Text className="text-lg font-extrabold text-brand-400">#{c.rank}</Text>
          </View>
        )}
      </View>

      {c.vsLabel && c.yourSide ? (
        <View className="mt-4">
          <View className="mb-1 flex-row items-center justify-between">
            <View className="flex-row items-center gap-1">
              <Swords size={13} color={brand[400]} />
              <Text className="text-[12px] font-semibold text-brand-400">{c.yourSide}</Text>
            </View>
            <Text className="text-[12px] font-semibold text-white/45">{c.rivalSide}</Text>
          </View>
          <View className="h-3 flex-row overflow-hidden rounded-full bg-ink-700">
            <View className="h-full rounded-l-full bg-brand-400" style={{ width: `${c.yourSidePct ?? 50}%` }} />
          </View>
          <View className="mt-1 flex-row items-center justify-between">
            <Text className="text-[12px] text-white/50">{c.yourSidePct}%</Text>
            <Text className="text-[12px] text-white/50">{c.rivalSidePct}%</Text>
          </View>
        </View>
      ) : (
        <>
          <ProgressBar value={c.progressPct} className="mt-4" />
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-[12px] text-white/50">Week {c.currentWeek} of {c.totalWeeks}</Text>
            <Text className="text-[12px] text-white/50">{c.progressPct}% complete</Text>
          </View>
        </>
      )}

      <View className="mt-4 flex-row gap-2">
        <Pressable onPress={() => nav.open('challengeDetail', { id: c.id })} className="flex-1 items-center rounded-full border border-white/10 bg-white/5 py-2.5 active:opacity-80">
          <Text className="text-sm font-semibold text-white/80">View standings</Text>
        </Pressable>
        {!c.joined && (
          <Pressable onPress={onJoin} className="btn-primary flex-1 py-2.5 active:opacity-90">
            <Text className="text-sm font-semibold text-black">Join</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function GroupList() {
  const { state, dispatch } = useStore()
  return (
    <View className="gap-2.5">
      {state.groups.map((g) => (
        <View key={g.id} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3">
          <View className="h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${g.color}22` }}><Icon name={g.icon} size={22} color={g.color} /></View>
          <View className="min-w-0 flex-1">
            <Text className="font-bold leading-tight text-white">{g.name}</Text>
            <Text className="text-[12px] text-white/45">{g.members} members · {g.desc}</Text>
          </View>
          {g.unread > 0 && g.joined && <Chip color="green">{g.unread} new</Chip>}
          <Pressable onPress={() => dispatch({ type: 'JOIN_GROUP', id: g.id })} className={`rounded-full px-3.5 py-1.5 active:opacity-80 ${g.joined ? 'bg-ink-700' : 'bg-brand-400'}`}>
            <Text className={`text-sm font-bold ${g.joined ? 'text-white/70' : 'text-black'}`}>{g.joined ? 'Joined' : 'Join'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

function ChallengesTab() {
  const { state, dispatch } = useStore()
  const scopeLabel: Record<string, string> = { campus: 'Campus', dorm: 'Hall vs hall', society: 'Society vs society', global: 'Open to all' }
  return (
    <View className="gap-3">
      {state.challenges.map((c) => (
        <View key={c.id}>
          {c.scope && <Text className="mb-1 ml-1 text-[11px] font-semibold uppercase tracking-wide text-white/35">{scopeLabel[c.scope]}</Text>}
          <ChallengeCard c={c} onJoin={() => dispatch({ type: 'JOIN_CHALLENGE', id: c.id })} />
        </View>
      ))}
    </View>
  )
}

function EventsTab() {
  const { state, dispatch } = useStore()
  return (
    <View className="gap-3">
      {state.events.map((e) => (
        <View key={e.id} className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-400/15"><CalendarClock size={22} color={brand[400]} /></View>
          <View className="flex-1">
            <Text className="font-bold leading-tight text-white">{e.title}</Text>
            <Text className="text-[12px] text-white/50">{e.when}</Text>
            <Text className="text-[12px] text-white/40">Hosted by {e.host}</Text>
          </View>
          <Pressable onPress={() => dispatch({ type: 'RSVP_EVENT', id: e.id })} className={`rounded-full px-3.5 py-1.5 active:opacity-80 ${e.rsvp ? 'bg-brand-400' : 'bg-ink-700'}`}>
            <Text className={`text-sm font-bold ${e.rsvp ? 'text-black' : 'text-white/70'}`}>{e.rsvp ? 'Going' : 'RSVP'}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}
