import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { ShieldCheck, AlertTriangle } from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { useStore } from '../store/store'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthProvider'
import { activateProgram, changeGoalActivation } from '../backend/runtime/activate'
import { todayKey } from '../lib/date'
import { writeBackendUser } from '../backend/repo/userRepo'
import { writeActiveProgram } from '../backend/repo/programRepo'
import { thud, tick } from '../lib/haptics'
import { useT } from '../lib/useT'
import { brand } from '../theme'
import { mapEquipmentTags, EQUIPMENT_TAG_MAP } from '../backend/mapping/onboardingContract'
import { deriveLocalProfile } from '../backend/mapping/projection'
import type { BackendExperience, BackendGoal, EquipmentTier, FocalPoint, TrainsAlone, UserDoc, Weekday } from '../backend/schema'
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
// A tier change alone does not tell us WHAT a home / basic-gym user actually owns, so — exactly like
// onboarding's "Do you have any of these?" step — we re-ask when the tier is Basic Gym. Each chip maps to
// generator equipment tags via EQUIPMENT_TAG_MAP; on save we recompute `equipment_tags` with the same
// canonical mapping onboarding uses, so the plan can never keep stale full-gym equipment after a switch.
const HOME_EQUIPMENT = ['Squat rack', 'Barbell', 'Dumbbells', 'Bench or chair', 'Pull-up bar', 'Resistance bands', 'Kettlebell']
const TIER_ENV: Record<EquipmentTier, 'gym' | 'home' | 'bodyweight'> = { 'Full Gym': 'gym', 'Basic Gym': 'home', Bodyweight: 'bodyweight' }
/** Pre-select the home-equipment chips from a saved tag set: a chip is "owned" if any of its tags are present. */
const chipsFromTags = (tags: string[]): string[] => {
  const owned = new Set(tags)
  return HOME_EQUIPMENT.filter((chip) => (EQUIPMENT_TAG_MAP[chip] ?? []).some((t) => owned.has(t)))
}
const FOCAL_POINTS: FocalPoint[] = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings & Glutes', 'Biceps', 'Triceps', 'Core', 'Calves']
const ALONE_OPTIONS: { v: TrainsAlone; label: string }[] = [
  { v: 'always', label: 'Always' }, { v: 'usually', label: 'Usually' }, { v: 'sometimes', label: 'Sometimes' }, { v: 'never', label: 'Never' },
]

type Props = { open: boolean; onClose: () => void }

export function TrainingProfileSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const { user } = useAuth()
  const toast = useToast()
  const t = useT()
  const backendUser = state.backendUser

  const [goal, setGoal] = useState<BackendGoal>(backendUser?.goal ?? 'General Fitness')
  const [experience, setExperience] = useState<BackendExperience>(backendUser?.experience ?? 'Beginner')
  const [days, setDays] = useState<Weekday[]>(backendUser?.days_available ?? [])
  const [sessionLen, setSessionLen] = useState<number>(backendUser?.session_length_min ?? 60)
  const [tier, setTier] = useState<EquipmentTier>(backendUser?.equipment_tier ?? 'Full Gym')
  const [equipChips, setEquipChips] = useState<string[]>(chipsFromTags(backendUser?.equipment_tags ?? []))
  const [focus, setFocus] = useState<FocalPoint[]>(backendUser?.focal_points ?? [])
  const [alone, setAlone] = useState<TrainsAlone>(backendUser?.trains_alone ?? 'sometimes')
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
    setEquipChips(chipsFromTags(backendUser.equipment_tags ?? []))
    setFocus(backendUser.focal_points ?? [])
    setAlone(backendUser.trains_alone ?? 'sometimes')
    setPreview(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Recompute the granular equipment inventory from the tier (+ the home chips) using the SAME
  // canonical mapper onboarding uses, so a tier/chip change always yields a consistent tag set and
  // never leaves stale gear behind. Full Gym / Bodyweight need no chips (known defaults).
  const equipmentTags = useMemo(
    () => mapEquipmentTags(TIER_ENV[tier], tier === 'Basic Gym' ? equipChips : []),
    [tier, equipChips],
  )

  const dirty = useMemo(() => {
    if (!backendUser) return false
    return goal !== backendUser.goal
      || experience !== backendUser.experience
      || sessionLen !== backendUser.session_length_min
      || tier !== backendUser.equipment_tier
      || days.slice().sort().join() !== backendUser.days_available.slice().sort().join()
      || equipmentTags.slice().sort().join() !== (backendUser.equipment_tags ?? []).slice().sort().join()
      || focus.slice().sort().join() !== (backendUser.focal_points ?? []).slice().sort().join()
      || alone !== (backendUser.trains_alone ?? 'sometimes')
  }, [backendUser, goal, experience, days, sessionLen, tier, equipmentTags, focus, alone])

  const daysValid = days.length >= 2 && days.length <= 6

  if (!backendUser) {
    return (
      <Sheet open={open} onClose={onClose} title={t('Training profile')}>
        <Text className="text-[14px] leading-6 text-secondary">
          {t('Your training profile becomes editable once onboarding is complete on a real account.')}
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
    equipment_tags: equipmentTags,
    focal_points: focus,
    trains_alone: alone,
  })

  function toggleDay(d: Weekday) {
    tick()
    setPreview(null)
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))
  }

  function runPreview() {
    if (!daysValid) {
      toast(t('Pick between 2 and 6 training days'))
      return
    }
    // The SAME deterministic gate + generator as onboarding — no safety rule
    // is relaxed for edits, and nothing is committed by a preview. When the GOAL changed we
    // route through the shared changeGoalActivation (the SAME entry point the coach uses), so a
    // Settings goal change also version-bumps (GC09) and applies the eased GC07 transition week —
    // previously this path silently reset to version 1 and skipped the transition entirely.
    const nu = nextUser()
    if (backendUser && goal !== backendUser.goal) {
      // Keep every other edited field, but hand changeGoal the pre-change goal so it computes the
      // transition/version correctly.
      setPreview(changeGoalActivation({ ...nu, goal: backendUser.goal }, goal, state.programDoc?.version ?? 1, todayKey))
    } else {
      setPreview(activateProgram(nu))
    }
    tick()
  }

  async function apply() {
    if (!preview || applying) return
    setApplying(true)
    try {
      const doc = nextUser()
      // Re-project the WHOLE local profile from the new backend doc (same as the coach action path),
      // so experience, session length and equipment stay in sync for the coach and every profile
      // surface — not just goal + day count. A hand-built patch left those stale (the coach kept
      // reasoning from old values after an edit).
      dispatch({
        type: 'APPLY_TRAINING_PROFILE',
        profilePatch: deriveLocalProfile(doc),
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
      toast(preview.status.ok ? t('Training profile updated — new program applied') : t('Profile saved — program remains on hold'))
      onClose()
    } finally {
      setApplying(false)
    }
  }

  const seg = (selected: boolean) =>
    `items-center justify-center rounded-xl border px-3 py-2.5 active:opacity-85 ${selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`
  const segText = (selected: boolean) => `text-[12.5px] font-bold ${selected ? 'text-brand-400' : 'text-secondary'}`

  return (
    <Sheet open={open} onClose={onClose} title={t('Training profile')}>
      <Text className="text-[12.5px] leading-5 text-secondary">
        {t('Changes only take effect after you preview and apply the regenerated plan. Your workout history and logged sets are never changed.')}
      </Text>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Primary goal')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {GOALS.map((g) => (
          <Pressable key={g.v} onPress={() => { tick(); setPreview(null); setGoal(g.v) }} accessibilityRole="radio" accessibilityLabel={g.label} accessibilityState={{ selected: goal === g.v, checked: goal === g.v }} className={seg(goal === g.v)} style={{ width: '48%' }}>
            <Text className={segText(goal === g.v)}>{t(g.label)}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Experience')}</Text>
      <View className="flex-row gap-2">
        {EXPERIENCE.map((e) => (
          <Pressable key={e} onPress={() => { tick(); setPreview(null); setExperience(e) }} accessibilityRole="radio" accessibilityLabel={e} accessibilityState={{ selected: experience === e, checked: experience === e }} className={`flex-1 ${seg(experience === e)}`}>
            <Text className={segText(experience === e)}>{t(e)}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Training days ({n} selected)', { n: days.length })}</Text>
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
      {!daysValid && <Text className="mt-1.5 text-[11.5px] text-amber-300/90">{t('Choose between 2 and 6 days.')}</Text>}

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Session length')}</Text>
      <View className="flex-row gap-2">
        {SESSION_LENGTHS.map((m) => (
          <Pressable key={m} onPress={() => { tick(); setPreview(null); setSessionLen(m) }} accessibilityRole="radio" accessibilityLabel={`${m} minutes`} accessibilityState={{ selected: sessionLen === m, checked: sessionLen === m }} className={`flex-1 ${seg(sessionLen === m)}`}>
            <Text className={segText(sessionLen === m)}>{m}m</Text>
          </Pressable>
        ))}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Equipment')}</Text>
      <View className="flex-row gap-2">
        {TIERS.map((v) => (
          <Pressable key={v.v} onPress={() => { tick(); setPreview(null); setTier(v.v) }} accessibilityRole="radio" accessibilityLabel={v.label} accessibilityState={{ selected: tier === v.v, checked: tier === v.v }} className={`flex-1 ${seg(tier === v.v)}`}>
            <Text className={`${segText(tier === v.v)} text-center`}>{t(v.label)}</Text>
          </Pressable>
        ))}
      </View>

      {tier === 'Basic Gym' && (
        <>
          <Text className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('What can you use?')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {HOME_EQUIPMENT.map((item) => {
              const on = equipChips.includes(item)
              return (
                <Pressable
                  key={item}
                  onPress={() => { tick(); setPreview(null); setEquipChips((cur) => (cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item])) }}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item}
                  accessibilityState={{ checked: on }}
                  className={seg(on)}
                >
                  <Text className={segText(on)}>{t(item)}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text className="mt-1.5 text-[11px] leading-4 text-tertiary">{t('Only exercises your kit supports get programmed. Leave all off for bodyweight-only at home.')}</Text>
        </>
      )}

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Focus areas ({n}/2)', { n: focus.length })}</Text>
      <View className="flex-row flex-wrap gap-2">
        {FOCAL_POINTS.map((f) => {
          const on = focus.includes(f)
          return (
            <Pressable
              key={f}
              onPress={() => { tick(); setPreview(null); setFocus((cur) => cur.includes(f) ? cur.filter((x) => x !== f) : (cur.length >= 2 ? cur : [...cur, f])) }}
              accessibilityRole="checkbox" accessibilityLabel={f} accessibilityState={{ checked: on }}
              className={seg(on)}
            >
              <Text className={segText(on)}>{t(f)}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text className="mt-1.5 text-[11px] leading-4 text-tertiary">{t('We add a little extra volume to up to two areas you pick.')}</Text>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-wide text-tertiary">{t('Do you train alone?')}</Text>
      <View className="flex-row gap-2">
        {ALONE_OPTIONS.map((o) => (
          <Pressable key={o.v} onPress={() => { tick(); setPreview(null); setAlone(o.v) }} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ selected: alone === o.v, checked: alone === o.v }} className={`flex-1 ${seg(alone === o.v)}`}>
            <Text className={`${segText(alone === o.v)} text-center`}>{t(o.label)}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="mt-1.5 text-[11px] leading-4 text-tertiary">If you train alone we add a safe-setup cue to spotter lifts.</Text>

      {/* Preview panel — what the deterministic generator proposes. */}
      {preview && (
        <View className={`mt-5 rounded-2xl border p-4 ${preview.status.ok ? 'border-brand-400/25 bg-brand-400/[0.06]' : 'border-amber-400/25 bg-amber-400/[0.06]'}`}>
          {preview.status.ok && preview.program ? (
            <>
              <View className="flex-row items-center gap-2">
                <ShieldCheck size={16} color={brand[400]} />
                <Text className="text-[13.5px] font-bold text-white">{t('Proposed: {name} · {n}-day', { name: preview.program.splitName, n: preview.program.days.length })}</Text>
              </View>
              <Text className="mt-1.5 text-[12px] leading-5 text-secondary">{preview.program.recommendationNote}</Text>
              <Text className="mt-1.5 text-[11px] leading-4 text-tertiary">All safety rules re-applied. Your history and current weights carry forward.</Text>
            </>
          ) : (
            <>
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={16} color="#fbbf24" />
                <Text className="text-[13.5px] font-bold text-amber-200">{t('No program can generate with these settings yet')}</Text>
              </View>
              <Text className="mt-1.5 text-[12px] leading-5 text-secondary">
                {t('You can still save the profile — the plan stays on hold until the block clears ({reason}).', { reason: preview.status.reason ?? 'unknown' })}
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
          {applying ? t('Applying…') : preview ? t('Apply changes') : t('Preview new program')}
        </Text>
      </Pressable>
      {preview && (
        <Pressable onPress={() => setPreview(null)} accessibilityRole="button" accessibilityLabel="Back to editing" className="mt-2 w-full items-center py-2 active:opacity-70">
          <Text className="text-[12.5px] font-bold text-secondary">{t('Keep editing instead')}</Text>
        </Pressable>
      )}

      <Text className="mt-4 text-[11px] leading-4 text-tertiary">
        Date of birth, injuries and health-screening answers gate your safety rules, so they can’t be edited here. Email{' '}
        <Text className="text-secondary" onPress={() => void Linking.openURL('mailto:info@strengthhubonline.com')}>info@strengthhubonline.com</Text>
        {' '}and we’ll update them with the required checks.
      </Text>
    </Sheet>
  )
}
