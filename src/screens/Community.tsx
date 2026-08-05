import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Settings2, AtSign } from 'lucide-react-native'
import { ScreenHeader, SegmentedTabs } from '../components/ui'
import { useStoreSelector } from '../store/store'
import { useColors, brand } from '../theme'
import type { AppState } from '../store/types'
import { LeagueScreen } from '../community/LeagueScreen'
import { GroupsTab } from '../community/groups'
import { UsernameSheet } from '../community/UsernameSetup'

const TABS = ['League', 'Groups']

const selectUsername = (s: AppState) => s.community.username

/**
 * Community competition hub — a global consistency-streak leaderboard and a
 * Groups tab for private friend competitions. Browse-first: anyone can look
 * around, and a username is prompted only when they act (compete on the board,
 * create or join a group). All social interaction is competing — no posts or
 * comments — which keeps it safe and low-moderation.
 */
export default function Community() {
  const username = useStoreSelector(selectUsername)
  const [tab, setTab] = useState('League')
  const [usernameOpen, setUsernameOpen] = useState(false)
  const colors = useColors()

  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Community"
        trailing={
          username ? (
            <Pressable
              onPress={() => setUsernameOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Community settings"
              className="h-10 flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 active:opacity-80"
            >
              <Text className="text-[13px] font-bold text-white/80">@{username}</Text>
              <Settings2 size={15} color={colors.fg} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setUsernameOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Set a username"
              className="h-10 flex-row items-center gap-1.5 rounded-full bg-brand-400 px-3.5 active:opacity-90"
            >
              <AtSign size={15} color="#000" />
              <Text className="text-[13px] font-bold text-black">Set username</Text>
            </Pressable>
          )
        }
      />
      <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
      <View className="mt-5">
        {tab === 'League' && <LeagueScreen onClaimUsername={() => setUsernameOpen(true)} />}
        {tab === 'Groups' && <GroupsTab onClaimUsername={() => setUsernameOpen(true)} />}
      </View>

      <UsernameSheet open={usernameOpen} onClose={() => setUsernameOpen(false)} />
    </View>
  )
}
