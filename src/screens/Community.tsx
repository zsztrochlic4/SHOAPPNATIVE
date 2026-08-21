import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Settings2, AtSign } from 'lucide-react-native'
import { ScreenHeader, SegmentedTabs } from '../components/ui'
import { useStoreSelector } from '../store/store'
import { useColors } from '../theme'
import type { AppState } from '../store/types'
import { LeagueScreen } from '../community/LeagueScreen'
import { GroupsTab } from '../community/groups'
import { UsernameSheet, CommunitySetupGate, CommunityWelcomeModal } from '../community/UsernameSetup'
import { COMMUNITY_BACKEND } from '../community/backendConfig'

const TABS = ['League', 'Groups']

const selectUsername = (s: AppState) => s.community.username

/**
 * Community competition hub — monthly consistency Leagues and private Groups.
 *
 * First run is a setup GATE (design Screen 1): a new user must claim a username
 * or explicitly tap "Preview Community" to browse without registering. Once a name
 * is claimed a one-time welcome modal appears; after that (or in preview) the hub
 * shows the League / Groups tabs. All social interaction is competing — no posts
 * or comments — which keeps it safe and low-moderation.
 */
export default function Community() {
  const username = useStoreSelector(selectUsername)
  const [tab, setTab] = useState('League')
  const [usernameOpen, setUsernameOpen] = useState(false)
  // Local, session-scoped: the user chose to browse without a name this visit.
  const [previewing, setPreviewing] = useState(false)
  // One-shot welcome modal, shown right after a username is claimed from the gate.
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const colors = useColors()

  // The gate blocks the hub until the user claims a name or opts into preview.
  const inSetup = !username && !previewing

  return (
    <View className="px-5 pt-2">
      <ScreenHeader
        title="Community"
        trailing={
          inSetup ? undefined : username ? (
            <Pressable
              onPress={() => setUsernameOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Community settings"
              className="h-10 flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 active:opacity-80"
            >
              <Text className="text-[13px] font-bold text-secondary">@{username}</Text>
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

      {inSetup ? (
        <CommunitySetupGate onPreview={() => setPreviewing(true)} onClaimed={() => setWelcomeOpen(true)} />
      ) : (
        <>
          <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
          {!COMMUNITY_BACKEND && (
            <View className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2">
              <Text className="text-[12px] font-semibold text-amber-300">Preview</Text>
              <Text className="text-[11.5px] leading-snug text-secondary">Leaderboards show sample players while Community is in preview — real rankings arrive when it goes live.</Text>
            </View>
          )}
          <View className="mt-5">
            {tab === 'League' && <LeagueScreen onClaimUsername={() => setUsernameOpen(true)} />}
            {tab === 'Groups' && <GroupsTab onClaimUsername={() => setUsernameOpen(true)} />}
          </View>
        </>
      )}

      <UsernameSheet open={usernameOpen} onClose={() => setUsernameOpen(false)} />
      <CommunityWelcomeModal open={welcomeOpen} onClose={() => setWelcomeOpen(false)} name={username ?? 'you'} />
    </View>
  )
}
