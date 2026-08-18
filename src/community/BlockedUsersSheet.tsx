/**
 * Manage the local block list. Blocking is client-side moderation: a blocked
 * user is hidden from every leaderboard and group feed on this device (see the
 * `blocked` filters in GlobalLeaderboard and groups). Unblocking restores them.
 * Server-side enforcement is deferred to the community backend go-live.
 */
import { View, Text, Pressable } from 'react-native'
import { Ban } from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useStore } from '../store/store'
import { Avatar } from '../components/Avatar'

export function BlockedUsersSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const blocked = state.community.blockedUids ?? []

  const unblock = (uid: string) => {
    dispatch({ type: 'UNBLOCK_USER', uid })
    toast(`Unblocked @${uid}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Blocked users">
      {blocked.length === 0 ? (
        <View className="items-center px-6 py-10">
          <Ban size={26} color="rgba(255,255,255,0.35)" />
          <Text className="mt-3 font-bold text-white">No one blocked</Text>
          <Text className="mt-1 max-w-[260px] text-center text-[13px] text-secondary">
            Blocked users are hidden from your leaderboards and group feeds.
          </Text>
        </View>
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
                <Pressable
                  onPress={() => unblock(uid)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock @${uid}`}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2 active:opacity-80"
                >
                  <Text className="text-[13px] font-bold text-secondary">Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </>
      )}
    </Sheet>
  )
}
