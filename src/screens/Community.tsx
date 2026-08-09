import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Settings2 } from 'lucide-react-native'
import { ScreenHeader, SegmentedTabs } from '../components/ui'
import { useStoreSelector } from '../store/store'
import { useColors } from '../theme'
import type { AppState } from '../store/types'
import { LeagueScreen } from '../community/LeagueScreen'
import { GroupsTab } from '../community/groups'
import { UsernameSheet } from '../community/UsernameSetup'
import { SetupGate } from '../community/SetupGate'
import { WelcomeModal } from '../community/WelcomeModal'

const TABS = ['League', 'Groups']

const selectUsername = (s: AppState) => s.community.username

/**
 * Community competition hub — a global consistency-streak leaderboard and a
 * Groups tab for private friend competitions. First run shows a setup gate that
 * claims a username (or lets the user "Preview Community" and browse first); once
 * claimed, all social interaction is competing — no posts or comments — which
 * keeps it safe and low-moderation.
 */
export default function Community() {
  const username = useStoreSelector(selectUsername)
  const [tab, setTab] = useState('League')
  // The change-username sheet (only reachable once a name exists).
  const [usernameOpen, setUsernameOpen] = useState(false)
  // Browse-without-claiming, chosen from the gate's "Preview Community".
  const [previewing, setPreviewing] = useState(false)
  // Set to the freshly-claimed handle so the welcome modal shows once.
  const [welcomeName, setWelcomeName] = useState<string | null>(null)
  const colors = useColors()

  // First run: no username and not previewing → the full-screen setup gate.
  const inSetup = !username && !previewing

  // Any "claim / set a username" affordance from inside the hub returns to the
  // gate — first-time claiming always goes through it; the sheet only edits.
  const claimFromHub = () => setPreviewing(false)

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
          ) : undefined
        }
      />

      {inSetup ? (
        <SetupGate onClaimed={(name) => setWelcomeName(name)} onPreview={() => setPreviewing(true)} />
      ) : (
        <>
          <SegmentedTabs tabs={TABS} active={tab} onChange={setTab} />
          <View className="mt-5">
            {tab === 'League' && <LeagueScreen onClaimUsername={claimFromHub} />}
            {tab === 'Groups' && <GroupsTab onClaimUsername={claimFromHub} />}
          </View>
        </>
      )}

      <UsernameSheet open={usernameOpen} onClose={() => setUsernameOpen(false)} />
      <WelcomeModal open={!!welcomeName} username={welcomeName ?? username} onClose={() => setWelcomeName(null)} />
    </View>
  )
}
