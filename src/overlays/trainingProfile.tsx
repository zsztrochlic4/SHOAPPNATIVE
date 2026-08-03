import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { ShieldCheck, AlertTriangle } from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { activateProgram } from '../backend/runtime/activate'
import { writeBackendUser } from '../backend/repo/userRepo'
import { writeActiveProgram } from '../backend/repo/programRepo'
import { thud, tick } from '../lib/haptics'
import { brand } from '../theme'
import type { BackendExperience, BackendGoal, EquipmentTier, UserDoc, Weekday } from '../backend/schema'
import type { Profile } from '../store/types'

/**
 * Training profile editor (audit §5 "must have before release": primary goal,
 * experience, availability, session length, equipment — editable after
 * onboarding, with PREVIEW-BEFORE-REGENERATE).
 *
 * Flow: edit inputs → "Preview new program" runs the same deterministic gate +
 * generator onboarding uses (activateProgram; every safety rule self-clamps) →
 * the proposed split is shown → only an explicit "Apply" replaces the plan.
 * History, set logs and progression records are never touched (the reducer
 * swaps the forward-looking plan only).
 *
 * DOB and injury/screening answers are deliberately NOT editable here: they
 * gate safety, so changes route through support (audited, human-reviewed) —
 * exactly the high-friction path the audit prescribes.
 */

const GOALS: { v: BackendGoal; label: string; local: Profile['goal'] }[] = [
  { v: 'Hypertrophy', label: 'Build muscle', local: 'build-muscle' },
  { v: 'Fat Loss', label: 'Lose fat', local: 'lose-fat' },
  { v: 'Strength', label: 'Get stronger', local: 'gain-strength' },
  { v: 'General Fitness', label: 'Stay healthy', local: 'stay-healthy' },
]
const EXPERIENCE: BackendExperience[] = ['Beginner', 'Intermediate', 'Advanced']
const WEEKDAYS: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SESSION_LENGTHS = [30, 45, 60, 75, 90]
const TIERS: { v: EquipmentTier; label: string }[] = [
  { v: 'Full Gym', label: 'Full gym' },
  { v: 'Basic Gym', label: 'Basic gym / home' },
  { v: 'Bodyweight', label: 'Bodyweight' },
]

type Props = { open: boolean; onClose: () => void }

export function TrainingProfileSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const backendUser = state.backendUser

  const [goal, setGoal] = useState<BackendGoal>(backendUser?.goal ?? 'General Fitness')
  const [experience, setExperience] = useState<BackendExperience>(backendUser?.experience ?? 'Beginner')
  const [days, setDays] = useState<Weekday[]>(backendUser?.days_available ?? [])
  const [sessionLen, setSessionLen] = useState<number>(backendUser?.session_length_min ?? 60)
  const [tier, setTier] = useState<EquipmentTier>(backendUser?.equipment_tier ?? 'Full Gym')
  const [preview, setPreview] = useState<ReturnType<typeof activateProgram> | null>(null)
  const [applying, setApplying] = useState(false)

  // Re-seed from the saved profile every time the sheet opens; drop any preview.
  useEffect(() => {
    if (!open || !backendUser) return
    setGoal(backendUser.goal)
    setExperience(backendUser.experience)
    setDays(backendUser.days_available)
    setSessionLen(backendUser.session_length_min)
    setTier(backendUser.equipment_tier)
    setPreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const dirty = useMemo(() => {
    if (!backendUser) return false
    return goal !== backendUser.goal
      || experience !== backendUser.experience
      || sessionLen !== backendUser.session_length_min
      || tier !== backendUser.equipment_tier
      || days.slice().sort().join() !== backendUser.days_available.slice().sort().join()
  }, [backendUser, goal, experience, days, sessionLen, tier])

  const daysValid = days.length >= 2 && days.length <= 6

  if (!backendUser) {
    return (
      <Sheet open={open} onClose={onClose} title="Training profile">
        <Text className="text-[14px] leading-6 text-white/60">
          Your training profile becomes editable once onboarding is complete on a real account.
        </Text>
      </Sheet>
    )
  }

  const nextUser = (): UserDoc => ({
    ...backendUser,
    goal,
    experience,
    days_available: days,
    session_length_min: sessionLen,
    equipment_tier: tier,
  })

  function toggleDay(d: Weekday) {
    tick()
    setPreview(null)
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  }

  function runPreview() {
    if (!daysValid) {
      toast('Pick between 2 and 6 training days')
      return
    }
    // The SAME deterministic gate + generator as onboarding — no safety rule
    // is relaxed for edits, and nothing is committed by a preview.
    setPreview(activateProgram(nextUser()))
    tick()
  }

  async function apply() {
    if (!preview || applying) return
    setApplying(true)
    try {
      const doc = nextUser()
      const local = GOALS.find((g) => g.v === goal)
      dispatch({
        type: 'APPLY_TRAINING_PROFILE',
        profilePatch: { goal: local?.local ?? state.profile.goal, daysPerWeek: days.length },
        backendUser: doc,
        generatedProgram: preview.program,
        programStatus: preview.status,
        programDoc: preview.programDoc,
        workoutInstances: preview.instances,
      })
      const uid = user?.uid
      if (uid) {
        void writeBackendUser(uid, doc).catch(() => { /* retried by CloudSync */ })
        if (preview.programDoc) {
          void writeActiveProgram(uid, preview.programDoc, preview.instances).catch(() => {})
        }
      }
      thud()
      toast(preview.status.ok ? 'Training profile updated — new program applied' : 'Profile saved — program remains on hold')
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const seg = (selected: boolean) =>
    `items-center justify-center rounded-xl border px-3 py-2.5 active:opacity-85 ${selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`
  const segText = (selected: boolean) => `text-[12.5px] font-bold ${selected ? 'text-brand-400' : 'text-white/60'}`

  return (
    <Sheet open={open} onClose={onClose} title="Training profile">
      <Text className="text-[12.5px] leading-5 text-white/50">
        Changes only take effect after you preview and apply the regenerated plan. Your workout history and logged sets are never changed.
      </Text>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/40">Primary goal</Text>
      <View className="flex-row flex-wrap gap-2">
        {GOALS.map((g) => (
          <Pressable key={g.v} onPress={() => { tick(); setPreview(null); setGoal(g.v) }} accessibilityRole="radio" accessibilityLabel={g.label} accessibilityState={{ selected: goal === g.v, checked: goal === g.v }} className={seg(goal === g.v)} style={{ width: '48%' }}>
            <Text className={segText(goal === g.v)}>{g.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/40">Experience</Text>
      <View className="flex-row gap-2">
        {EXPERIENCE.map((e) => (
          <Pressable key={e} onPress={() => { tick(); setPreview(null); setExperience(e) }} accessibilityRole="radio" accessibilityLabel={e} accessibilityState={{ selected: experience === e, checked: experience === e }} className={`flex-1 ${seg(experience === e)}`}>
            <Text className={segText(experience === e)}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/40">Training days ({days.length} selected)</Text>
      <View className="flex-row flex-wrap gap-2">
        {WEEKDAYS.map((d) => {
          const on = days.includes(d)
          return (
            <Pressable key={d} onPress={() => toggleDay(d)} accessibilityRole="checkbox" accessibilityLabel={d} accessibilityState={{ checked: on }} className={seg(on)}>
              <Text className={segText(on)}>{d.slice(0, 3)}</Text>
            </Pressable>
          )
        })}
      </View>
      {!daysValid && <Text className="mt-1.5 text-[11.5px] text-amber-300/90">Choose between 2 and 6 days.</Text>}

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/40">Session length</Text>
      <View className="flex-row gap-2">
        {SESSION_LENGTHS.map((m) => (
          <Pressable key={m} onPress={() => { tick(); setPreview(null); setSessionLen(m) }} accessibilityRole="radio" accessibilityLabel={`${m} minutes`} accessibilityState={{ selected: sessionLen === m, checked: sessionLen === m }} className={`flex-1 ${seg(sessionLen === m)}`}>
            <Text className={segText(sessionLen === m)}>{m}m</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-white/40">Equipment</Text>
      <View className="flex-row gap-2">
        {TIERS.map((t) => (
          <Pressable key={t.v} onPress={() => { tick(); setPreview(null); setTier(t.v) }} accessibilityRole="radio" accessibilityLabel={t.label} accessibilityState={{ selected: tier === t.v, checked: tier === t.v }} className={`flex-1 ${seg(tier === t.v)}`}>
            <Text className={`${segText(tier === t.v)} text-center`}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Preview panel — what the deterministic generator proposes. */}
      {preview && (
        <View className={`mt-5 rounded-2xl border p-4 ${preview.status.ok ? 'border-brand-400/25 bg-brand-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
          {preview.status.ok && preview.program ? (
            <>
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color={brand[400]} />
                <Text className="text-[13.5px] font-bold text-white">Proposed: {preview.program.splitName} · {preview.program.days.length}-day</Text>
              </View>
              <Text className="mt-1.5 text-[12px] leading-5 text-white/55">{preview.program.recommendationNote}</Text>
              <Text className="mt-1.5 text-[11px] leading-4 text-white/35">All safety rules re-applied. Your history and current weights carry forward.</Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={16} color="#fbbf24" />
                <Text className="text-[13.5px] font-bold text-amber-200">No program can generate with these settings yet</Text>
              </View>
              <Text className="mt-1.5 text-[12px] leading-5 text-white/55">
                You can still save the profile — the plan stays on hold until the block clears ({preview.status.reason ?? 'unknown'}).
              </Text>
            </>
          )}
        </View>
      )}

      <Pressable
        onPress={preview ? () => void apply() : runPreview}
        disabled={(!dirty && !preview) || applying}
        accessibilityRole="button"
        accessibilityLabel={preview ? 'Apply the new program' : 'Preview new program'}
        className={`btn-primary mt-5 w-full items-center py-3 active:opacity-90 ${(!dirty && !preview) || applying ? 'opacity-50' : ''}`}
      >
        <Text className="text-[14px] font-bold text-black">
          {applying ? 'Applying…' : preview ? 'Apply changes' : 'Preview new program'}
        </Text>
      </Pressable>
      {preview && (
        <Pressable onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Back to editing" className="mt-2 w-full items-center py-2 active:opacity-70">
          <Text className="text-[12.5px] font-bold text-white/45">Keep editing instead</Text>
        </Pressable>
      )}

      <Text className="mt-4 text-[11px] leading-4 text-white/35">
        Date of birth, injuries and health-screening answers gate your safety rules, so they can’t be edited here. Email{' '}
        <Text className="text-white/55" onPress={() => void Linking.openURL('mailto:info@strengthhubonline.com')}>info@strengthhubonline.com</Text>
        {' '}and we’ll update them with the required checks.
      </Text>
    </Sheet>
  )
}
