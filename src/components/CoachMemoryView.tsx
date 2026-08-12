import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, Switch, Text, TextInput, View } from 'react-native'
import { Brain, ChevronLeft, Database, RefreshCw, ShieldCheck, Trash2, WifiOff } from 'lucide-react-native'
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useNetInfo } from '@react-native-community/netinfo'
import type { CoachMemory, CoachWorkspaceSummary } from '../backend/coach/contracts'
import {
  clearCoachMemories,
  deleteCoachMemory,
  fetchCoachWorkspace,
  grantCoachConsent,
  readCachedCoachWorkspace,
  revokeCoachConsent,
  updateCoachPreferences,
} from '../lib/coachWorkspace'
import { thud } from '../lib/haptics'
import { useDispatch, useStore } from '../store/store'
import { useColors } from '../theme'

type Props = { onClose: () => void; onConsentChanged?: (consented: boolean) => void }

function MemoryTopBar({ onClose }: { onClose: () => void }) {
  const colors = useColors()
  return (
    <View className="h-[54px] flex-row items-center border-b border-white/5 px-3">
      <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to coach" style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })} className="h-11 w-11 items-center justify-center rounded-full"><ChevronLeft size={22} color={colors.fg} /></Pressable>
      <Text className="ml-1 text-[16px] font-bold text-white">Coach profile</Text>
    </View>
  )
}

const MemoryRow = memo(function MemoryRow({ item, onDelete }: { item: CoachMemory; onDelete: (id: string) => void }) {
  const colors = useColors()
  return (
    <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} className="mb-2 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-9 w-9 items-center justify-center rounded-full bg-brand-400/10">
          <Brain size={17} color={colors.brand400} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-bold uppercase tracking-wide text-brand-400">{item.category.replace(/_/g, ' ')}</Text>
          <Text className="mt-1 text-[14px] leading-5 text-white/85">{item.value}</Text>
          <Text className="mt-2 text-[11px] text-tertiary">{item.status} · {item.source.replace(/_/g, ' ')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Forget ${item.category}`}
          hitSlop={8}
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
          className="h-11 w-11 items-center justify-center rounded-full bg-white/5"
        >
          <Trash2 size={17} color={colors.danger} />
        </Pressable>
      </View>
    </Animated.View>
  )
})

function MemorySkeleton() {
  const pulse = useSharedValue(0.35)
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.7, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [pulse])
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }))
  return (
    <View className="gap-3 px-[18px] pt-4">
      {[0, 1, 2].map((id) => (
        <Animated.View key={id} style={style} className="h-[92px] rounded-2xl bg-ink-700" />
      ))}
    </View>
  )
}

/** Name-your-coach setting. The name is a local, per-user Profile field (synced with the rest of the
 *  profile) so it pulls through everywhere the coach is shown. Commits on blur/submit, bounded length. */
function CoachNameCard() {
  const { state } = useStore()
  const dispatch = useDispatch()
  const saved = (state.profile.coachName ?? '').trim()
  const [draft, setDraft] = useState(saved)
  useEffect(() => { setDraft((state.profile.coachName ?? '').trim()) }, [state.profile.coachName])
  const commit = useCallback(() => {
    const next = draft.trim().slice(0, 30)
    if (next === saved) return
    dispatch({ type: 'SET_PROFILE', patch: { coachName: next } })
    thud()
  }, [draft, saved, dispatch])
  return (
    <View className="mx-[18px] mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <Text className="font-bold text-white">Coach name</Text>
      <Text className="mt-0.5 text-[12px] leading-4 text-secondary">Give your coach a name — it shows across the app. Leave blank to just call it “Coach”.</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        returnKeyType="done"
        placeholder="Coach"
        placeholderTextColor="rgba(255,255,255,0.35)"
        maxLength={30}
        accessibilityLabel="Coach name"
        className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-[15px] text-white"
      />
    </View>
  )
}

export function CoachMemoryView({ onClose, onConsentChanged }: Props) {
  const colors = useColors()
  const net = useNetInfo()
  const dispatch = useDispatch()
  const [workspace, setWorkspace] = useState<CoachWorkspaceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [memoryChoice, setMemoryChoice] = useState(true)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    setLoading(true)
    const cached = await readCachedCoachWorkspace()
    if (cached) { setWorkspace(cached); setLoading(false) }
    try {
      const fresh = await fetchCoachWorkspace()
      setWorkspace(fresh)
      onConsentChanged?.(fresh.consentVersion === 1)
    } catch {
      if (!cached) setError(true)
    } finally {
      setLoading(false)
    }
  }, [onConsentChanged])

  useEffect(() => { void load() }, [load])

  const accept = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const next = await grantCoachConsent(memoryChoice)
      thud()
      setWorkspace(next)
      onConsentChanged?.(true)
    } catch {
      setError(true)
    } finally { setSaving(false) }
  }, [memoryChoice, onConsentChanged, saving])

  const changeMemory = useCallback(async (enabled: boolean) => {
    if (!workspace || saving) return
    const previous = workspace
    setWorkspace({ ...workspace, memoryEnabled: enabled })
    setSaving(true)
    try { setWorkspace(await updateCoachPreferences({ memoryEnabled: enabled })); thud() }
    catch { setWorkspace(previous); setError(true) }
    finally { setSaving(false) }
  }, [saving, workspace])

  const changeProactive = useCallback(async (enabled: boolean) => {
    if (!workspace || saving) return
    const previous = workspace
    setWorkspace({ ...workspace, proactiveEnabled: enabled })
    setSaving(true)
    try { setWorkspace(await updateCoachPreferences({ proactiveEnabled: enabled })); thud() }
    catch { setWorkspace(previous); setError(true) }
    finally { setSaving(false) }
  }, [saving, workspace])

  const changeStyle = useCallback(async (coachingStyle: CoachWorkspaceSummary['coachingStyle']) => {
    if (!workspace || saving || workspace.coachingStyle === coachingStyle) return
    const previous = workspace
    setWorkspace({ ...workspace, coachingStyle })
    setSaving(true)
    try { setWorkspace(await updateCoachPreferences({ coachingStyle })); thud() }
    catch { setWorkspace(previous); setError(true) }
    finally { setSaving(false) }
  }, [saving, workspace])

  const removeMemory = useCallback(async (id: string) => {
    if (!workspace) return
    const previous = workspace
    setWorkspace({ ...workspace, memories: workspace.memories.filter((m) => m.id !== id) })
    try { await deleteCoachMemory(id); thud() }
    catch { setWorkspace(previous); setError(true) }
  }, [workspace])

  const clearAll = useCallback(async () => {
    if (!workspace) return
    if (!confirmClear) { setConfirmClear(true); return }
    const previous = workspace
    setWorkspace({ ...workspace, memories: [] })
    setConfirmClear(false)
    try { await clearCoachMemories(); thud() }
    catch { setWorkspace(previous); setError(true) }
  }, [confirmClear, workspace])

  const disableCoach = useCallback(async () => {
    if (saving) return
    if (!confirmDisable) { setConfirmDisable(true); return }
    setSaving(true)
    try {
      // Server deletes the coach workspace, safety state AND the synced chat
      // transcripts; mirror that locally (transcript copies in AppState + the
      // uid-scoped workspace cache) so "delete coach data" is literally true
      // everywhere the data lived (audit F-015 / J-11).
      const next = await revokeCoachConsent()
      dispatch({ type: 'CLEAR_COACH_CHAT' })
      thud()
      setWorkspace(next)
      setConfirmDisable(false)
      onConsentChanged?.(false)
    } catch { setError(true) }
    finally { setSaving(false) }
  }, [confirmDisable, dispatch, onConsentChanged, saving])

  const header = useMemo(() => (
    <View>
      {net.isConnected === false && (
        <View className="mx-[18px] mt-3 flex-row items-center gap-2 rounded-xl bg-accent-orange/10 px-3 py-2">
          <WifiOff size={15} color={colors.accentOrange} />
          <Text className="flex-1 text-[12px] text-white/65">Offline · showing your last saved coach profile</Text>
        </View>
      )}
      <CoachNameCard />
      <View className="mx-[18px] mt-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-400/10"><Database size={19} color={colors.brand400} /></View>
          <View className="flex-1">
            <Text className="font-bold text-white">Long-term coach memory</Text>
            <Text className="mt-0.5 text-[12px] leading-4 text-secondary">Save useful facts across sessions and devices.</Text>
          </View>
          <Switch value={workspace?.memoryEnabled === true} onValueChange={changeMemory} disabled={saving || net.isConnected === false} trackColor={{ true: colors.brand500, false: colors.ink600 }} thumbColor={colors.fg} />
        </View>
      </View>
      <View className="mx-[18px] mt-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1"><Text className="font-bold text-white">Proactive check-ins</Text><Text className="mt-0.5 text-[12px] leading-4 text-secondary">Allow relevant, non-urgent coach prompts.</Text></View>
          <Switch value={workspace?.proactiveEnabled === true} onValueChange={changeProactive} disabled={saving || net.isConnected === false} trackColor={{ true: colors.brand500, false: colors.ink600 }} thumbColor={colors.fg} />
        </View>
        <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">Coaching style</Text>
        <View className="flex-row gap-2">
          {(['supportive', 'balanced', 'direct'] as const).map((style) => {
            const selected = workspace?.coachingStyle === style
            return (
              <Pressable key={style} disabled={saving || net.isConnected === false} onPress={() => void changeStyle(style)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className={`min-h-11 flex-1 items-center justify-center rounded-xl border ${selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/5 bg-white/[0.03]'}`}>
                <Text className={`text-[12px] font-bold capitalize ${selected ? 'text-brand-400' : 'text-secondary'}`}>{style}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      <View className="mx-[18px] mb-3 mt-4 flex-row items-center">
        <Text className="flex-1 text-[12px] font-bold uppercase tracking-wide text-secondary">What your coach knows</Text>
        {!!workspace?.memories.length && (
          <Pressable onPress={clearAll} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })} className="min-h-11 justify-center px-2">
            <Text className="text-[12px] font-bold text-danger">{confirmClear ? 'Tap again to clear' : 'Clear all'}</Text>
          </Pressable>
        )}
      </View>
      <Pressable disabled={saving || net.isConnected === false} onPress={() => void disableCoach()} accessibilityRole="button" accessibilityLabel="Turn off coach and delete all coach data" style={({ pressed }) => ({ opacity: saving || net.isConnected === false ? 0.4 : pressed ? 0.6 : 1 })} className="mx-[18px] mb-2 min-h-11 items-center justify-center rounded-xl border border-danger/20 bg-danger/[0.06] px-4 py-2.5">
        <Text className="text-[12px] font-bold text-danger">{confirmDisable ? 'Tap again to turn off coach and delete its data' : 'Turn off coach & delete coach data'}</Text>
      </Pressable>
      {/* Exact deletion scope — no vague claims (audit F-015). */}
      <Text className="mx-[18px] mb-4 text-[10.5px] leading-4 text-tertiary">
        Deletes: consent, memories, coach safety state, and your coach conversation (cloud + this device). Kept: anonymised deletion audit and, until your subscription data is deleted with your account, billing records.
      </Text>
    </View>
  ), [changeMemory, changeProactive, changeStyle, clearAll, colors, confirmClear, confirmDisable, disableCoach, net.isConnected, saving, workspace])

  const renderMemory = useCallback(({ item }: { item: CoachMemory }) => <MemoryRow item={item} onDelete={removeMemory} />, [removeMemory])

  if (loading && !workspace) return <View className="flex-1 bg-ink-900"><MemoryTopBar onClose={onClose} /><MemorySkeleton /></View>

  if (workspace && !workspace.consentVersion) {
    return (
      <View className="flex-1 bg-ink-900">
        <MemoryTopBar onClose={onClose} />
        <View className="px-[18px] pt-4"><View className="rounded-3xl border border-brand-400/20 bg-ink-800 p-5">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-400/10"><ShieldCheck size={24} color={colors.brand400} /></View>
          <Text className="mt-4 text-xl font-bold text-white">Let your coach understand you</Text>
          <Text className="mt-2 text-[14px] leading-5 text-white/65">Relevant profile, training, recovery and nutrition context—and your recent coach messages—will be processed by Google Gemini to answer you. Coach records are stored in Firebase. Operational safety state is stored separately.</Text>
          <View className="mt-5 flex-row items-center gap-3 rounded-2xl bg-white/5 p-3.5">
            <View className="flex-1"><Text className="font-bold text-white/85">Remember useful details</Text><Text className="mt-0.5 text-[12px] leading-4 text-secondary">You can inspect, delete or pause memory at any time.</Text></View>
            <Switch value={memoryChoice} onValueChange={setMemoryChoice} trackColor={{ true: colors.brand500, false: colors.ink600 }} thumbColor={colors.fg} />
          </View>
          <Pressable
            disabled={saving || net.isConnected === false}
            onPress={accept}
            style={({ pressed }) => ({ opacity: saving || net.isConnected === false ? 0.45 : pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}
            className="mt-5 min-h-[52px] items-center justify-center rounded-2xl bg-brand-400 px-5"
          >
            <Text className="font-bold text-ink-900">{saving ? 'Saving…' : 'Continue with coach'}</Text>
          </Pressable>
          <Text className="mt-3 text-center text-[11px] leading-4 text-tertiary">This consent is required for personalised AI coaching. You can still disable long-term memory separately.</Text>
        </View></View>
      </View>
    )
  }

  if (error && !workspace) {
    return (
      <View className="flex-1 bg-ink-900">
        <MemoryTopBar onClose={onClose} />
        <View className="flex-1 items-center justify-center px-8">
        <RefreshCw size={28} color={colors.brand400} />
        <Text className="mt-4 text-lg font-bold text-white">Couldn’t load your coach profile</Text>
        <Text className="mt-2 text-center text-[14px] leading-5 text-secondary">Check your connection and try again.</Text>
        <Pressable onPress={load} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })} className="mt-5 min-h-[48px] justify-center rounded-2xl bg-brand-400 px-6"><Text className="font-bold text-ink-900">Try again</Text></Pressable>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-ink-900">
      <MemoryTopBar onClose={onClose} />
      {error && <View className="mx-[18px] mt-3 flex-row items-center rounded-xl bg-danger/10 px-3 py-2"><Text className="flex-1 text-[12px] text-white/65">That change didn’t save. Your previous setting is still active.</Text><Pressable onPress={() => setError(false)} hitSlop={8}><Text className="font-bold text-white/70">Dismiss</Text></Pressable></View>}
      <FlatList
        data={workspace?.memories ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderMemory}
        ListHeaderComponent={header}
        ListEmptyComponent={<View className="mx-[18px] items-center rounded-2xl border border-dashed border-white/10 p-7"><Brain size={26} color={colors.brand400} /><Text className="mt-3 font-bold text-white/80">Nothing saved yet</Text><Text className="mt-1 text-center text-[13px] leading-5 text-secondary">As you chat, useful facts you explicitly share can appear here.</Text></View>}
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}
