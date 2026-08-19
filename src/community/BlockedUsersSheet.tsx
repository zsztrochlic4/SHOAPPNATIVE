/**
 * Manage the local block list. Blocking is client-side moderation: a blocked
 * user is hidden from every leaderboard and group feed on this device (see the
 * `blocked` filters in GlobalLeaderboard and groups). Unblocking restores them.
 * Server-side enforcement is deferred to the community backend go-live.
 */
import { View, Text } from 'react-native'
import { Ban } from 'lucide-react-native'
import { Sheet, EmptyState } from '../components/Sheet'
import { PressableScale } from '../components/PressableScale'
import { useToast } from '../components/Toast'
import { useStore } from '../store/store'
import { tick } from '../lib/haptics'
import { Avatar } from '../components/Avatar'

export function BlockedUsersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const blocked = state.community.blockedUids ?? []

  const unblock = (uid: string) => {
    tick()
    dispatch({ type: 'UNBLOCK_USER', uid })
    toast(`Unblocked @${uid}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Blocked users">
      {blocked.length === 0 ? (
        <EmptyState
          icon={<Ban size={32} color="#fff" />}
          title="No one blocked"
          body="People you block are hidden from your leaderboards and group feeds."
        />
      ) : (
        <>
          <Text className="text-[13px] leading-snug text-secondary">
            These people are hidden from your leaderboards and group feeds. Unblocking brings them back.
          </Text>
          <View className="mt-3 gap-1.5">
            {blocked.map((uid) => (
              <View
                key={uid}
                className="flex-row items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] p-3"
              >
                <Avatar name={uid} size={36} />
                <Text numberOfLines={1} className="min-w-0 flex-1 font-bold text-white">@{uid}</Text>
                <PressableScale
                  onPress={() => unblock(uid)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock @${uid}`}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 active:opacity-80"
                >
                  <Text className="text-[13px] font-bold text-secondary">Unblock</Text>
                </PressableScale>
              </View>
            ))}
          </View>
        </>
      )}
    </Sheet>
  )
}
