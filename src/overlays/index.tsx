import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView, Animated, Easing, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Bell, Moon, Sun, GraduationCap, Wallet, RotateCcw, Trash2, Camera, Trophy,
  Flame, Search, ScanLine, Plus, Check, Share2, ChevronRight, User, Sparkles, Dumbbell,
  Droplet, Footprints, BedDouble, Leaf, Play, Award, BellRing,
  HeartPulse, Activity, Zap, Minus, X, LogOut, Volume2, Download,
} from 'lucide-react-native'
import { Sheet, EmptyState } from '../components/Sheet'
import { AppModal, DEVICE, IS_WEB } from '../components/WebFrame'
import { IntegrationsSection } from '../components/Integrations'
import { Avatar } from '../components/Avatar'
import { LogoMark } from '../components/Logo'
import { Icon } from '../components/Icon'
import { Chip } from '../components/ui'
import { PressableScale } from '../components/PressableScale'
import { thud } from '../lib/haptics'
import { useDispatch, useStore } from '../store/store'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/Toast'
import { useNav } from '../nav'
import { FOODS } from '../data/catalog'
import { useQuickWorkouts } from '../data/quickWorkouts'
import type { QuickWorkout } from '../store/types'
import { buildCustomSession, imageForMuscle } from '../store/programSession'
import { collectUserExport } from '../store/cloudRepo'
import { serializeUserExport, splitLocalState, buildExportFilename } from '../lib/dataExport'
import { deliverExport } from '../lib/exportDeliver'
import { pick, makeRng } from '../lib/rng'
import { requestPushPermission, resolveNotifPrefs } from '../lib/notifications'
import { openBillingPortal } from '../lib/billing'
import { subscribeSyncStatus, type SyncStatus } from '../store/syncStatus'
import { requestCloudFlush } from '../store/cloudFlush'
import { LegalDocModal } from '../components/LegalDocModal'
import type { LegalDocKey } from '../content/legal'
import Constants from 'expo-constants'
import { Linking } from 'react-native'
import { todayKey, relativeLabel, shortDate, fromKey } from '../lib/date'
import {
  fmtWeight, fmtWeightNum, toKg, weightUnit, fmtFluid,
  weightVal,
} from '../lib/format'
import {
  weightStats, workoutsThisWeek, totalVolumeRange, streakStats, todayHabit,
  habitConsistencyWeek, leaderboardSorted, strengthProgress, activitiesInRange,
} from '../store/selectors'
import { ActivityIcon } from '../components/ActivityIcon'
import { activePeriod, upcomingPeriods } from '../store/periods'
import { translator, LANGUAGES, type Language } from '../lib/i18n'
import { shareText } from '../lib/share'
import type { MealName, Units, Theme, NotificationPrefs } from '../store/types'
import { brand, accent } from '../theme'

type Props = { open: boolean; onClose: () => void; params?: Record<string, unknown> }

// New feature sheets live in a sibling file and are surfaced through here.
export * from './extra'

/* ============================ Notifications ============================ */
export function NotificationsSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const iconFor: Record<string, ReactNode> = {
    workout: <Dumbbell size={18} color={brand[400]} />,
    nutrition: <Leaf size={18} color={brand[400]} />,
    streak: <Flame size={18} color={brand[400]} />,
    social: <User size={18} color={brand[400]} />,
    challenge: <Trophy size={18} color={brand[400]} />,
    system: <Award size={18} color={brand[400]} />,
  }
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <Pressable onPress={() => dispatch({ type: 'MARK_ALL_READ' })} className="active:opacity-80">
        <Text className="mb-3 text-sm font-semibold text-brand-400">Mark all as read</Text>
      </Pressable>
      <View className="gap-2.5">
        {state.notifications.map((n) => (
          <Pressable
            key={n.id}
            onPress={() => dispatch({ type: 'MARK_NOTIF_READ', id: n.id })}
            className={`w-full flex-row items-start gap-3 rounded-2xl border p-3.5 active:opacity-80 ${n.read ? 'border-white/5 bg-ink-800' : 'border-brand-400/25 bg-brand-400/5'}`}
          >
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">{iconFor[n.type]}</View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold leading-tight text-white">{n.title}</Text>
                {!n.read && <View className="ml-2 h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
              </View>
              <Text className="text-[13px] text-white/55">{n.body}</Text>
              <Text className="mt-1 text-[11px] text-white/35">{n.time}</Text>
            </View>
          </Pressable>
        ))}
        {state.notifications.length === 0 && (
          <EmptyState icon={<Bell size={32} color="#fff" />} title="All caught up" body="New activity will show up here." />
        )}
      </View>
    </Sheet>
  )
}

/* ============================ Settings ============================ */
/**
 * The daily targets everything else measures against — the dashboard's goal
 * checklist, the readiness index and the nutrition screen all read these. It
 * lives in Settings, next to the units toggle that decides how weight reads.
 */
export function GoalsSettings() {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const p = state.profile

  // Water is stored in litres but displayed in the user's units (fl oz on
  // imperial) — the audit flagged the always-litres label (F-032).
  const L_TO_OZ = 33.814
  const waterDisplay = (litres: number) =>
    units === 'imperial' ? String(Math.round(litres * L_TO_OZ)) : String(Math.round(litres * 10) / 10)

  const [goalW, setGoalW] = useState(() => String(Math.round(weightVal(p.goalWeightKg, units) * 10) / 10))
  const [steps, setSteps] = useState(() => String(p.stepTarget))
  const [sleep, setSleep] = useState(() => String(p.sleepTargetH))
  const [water, setWater] = useState(() => waterDisplay(p.waterTargetL))
  const [days, setDays] = useState(() => String(p.daysPerWeek))

  // The units toggle sits directly above this, so re-read unit-bearing values
  // whenever it (or the saved goal) changes — otherwise the fields would keep
  // showing the old unit and "save" would write the wrong number back.
  useEffect(() => {
    setGoalW(String(Math.round(weightVal(p.goalWeightKg, units) * 10) / 10))
    setWater(waterDisplay(p.waterTargetL))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, p.goalWeightKg, p.waterTargetL])

  function saveGoals() {
    dispatch({
      type: 'SET_PROFILE',
      patch: {
        goalWeightKg: Math.round(toKg(parseFloat(goalW) || weightVal(p.goalWeightKg, units), units) * 10) / 10,
        stepTarget: Math.max(0, Math.round(Number(steps) || 0)),
        sleepTargetH: Math.max(0, Math.min(14, Number(sleep) || 0)),
        waterTargetL: Math.max(0, units === 'imperial' ? (Number(water) || 0) / L_TO_OZ : Number(water) || 0),
        daysPerWeek: Math.max(1, Math.min(7, Math.round(Number(days) || 1))),
      },
    })
    toast('Goals updated')
  }

  const inputCls = 'w-24 rounded-xl border border-white/8 bg-ink-900 px-3 py-2 text-right text-[15px] font-bold text-white'
  return (
    <View className="gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <GoalRow label="Goal weight" unit={weightUnit(units)}>
        <TextInput value={goalW} onChangeText={(v) => setGoalW(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
      </GoalRow>
      <GoalRow label="Daily steps" unit="steps">
        <TextInput value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
      </GoalRow>
      <GoalRow label="Sleep" unit="hours">
        <TextInput value={sleep} onChangeText={(v) => setSleep(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
      </GoalRow>
      <GoalRow label="Water" unit={units === 'imperial' ? 'fl oz' : 'litres'}>
        <TextInput value={water} onChangeText={(v) => setWater(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
      </GoalRow>
      <GoalRow label="Workouts / week" unit="days">
        <TextInput value={days} onChangeText={(v) => setDays(v.replace(/\D/g, '').slice(0, 1))} keyboardType="number-pad" placeholderTextColor="rgba(148,148,148,0.6)" className={inputCls} />
      </GoalRow>
      <Pressable onPress={saveGoals} className="btn-primary mt-1 w-full py-2.5 active:opacity-90">
        <Text className="text-sm font-semibold text-black">Save goals</Text>
      </Pressable>
    </View>
  )
}

function GoalRow({ label, unit, children }: { label: string; unit: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-1">
        <Text className="text-[14px] font-semibold text-white">{label}</Text>
        <Text className="text-[11px] text-white/40">{unit}</Text>
      </View>
      {children}
    </View>
  )
}

/**
 * Every Settings control, with no surface of its own — rendered both inside the
 * SettingsSheet modal and inline in the side menu, so the settings are reachable
 * straight from the menu without a second tap. `visible` drives the
 * reset-on-hide of transient state; `onDone` dismisses the host after a data
 * reset (which drops back to onboarding / the fresh demo).
 */
export function SettingsBody({ visible, onDone }: { visible: boolean; onDone?: () => void }) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const nav = useNav()
  const { enabled: authEnabled, deleteAccount, user } = useAuth()
  const [exporting, setExporting] = useState(false)
  const { notificationsEnabled } = state.settings
  const notificationConsent = state.settings.notificationConsent ?? 'unknown'
  const soundEnabled = state.settings.soundEnabled ?? true
  const lang = state.settings.language ?? 'en'
  const t = translator(lang)
  // Two-step inline confirm for the destructive wipe — works on web and native
  // (RN's Alert is a no-op on react-native-web, so a dialog would never show).
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)
  const [legalDoc, setLegalDoc] = useState<LegalDocKey | null>(null)
  useEffect(() => { if (!visible) { setConfirmingClear(false); setConfirmingDelete(false); setLangOpen(false); setLegalDoc(null) } }, [visible])

  // Subscription state written by the Stripe webhook (server-authoritative,
  // mirrored by BillingSync). Drives the Settings billing section (audit F-014).
  const sub = state.subscription
  const hasSubscription = authEnabled && !!user && !!sub && sub.status !== 'none'
  const periodEndLabel = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
  const subStatusLabel =
    sub?.status === 'trialing' ? 'Free trial'
    : sub?.status === 'active' ? 'Active'
    : sub?.status === 'past_due' ? 'Payment issue'
    : sub?.status === 'canceled' ? 'Cancelled'
    : sub?.status === 'incomplete' ? 'Incomplete'
    : 'None'

  async function onManageSubscription() {
    if (portalBusy) return
    setPortalBusy(true)
    try {
      // Stripe's hosted Billing Portal: plan, payment method, invoices, cancel.
      await openBillingPortal()
    } catch {
      toast('Could not open subscription management. Please try again, or email info@strengthhubonline.com.')
    } finally {
      setPortalBusy(false)
    }
  }

  async function onDeleteAccount() {
    if (!confirmingDelete) { setConfirmingDelete(true); return }
    setDeleting(true)
    try {
      await deleteAccount()
      dispatch({ type: 'RESET_EMPTY' }) // clear local state; auth listener routes to login
      toast('Your account has been deleted')
      onDone?.()
    } catch (e: unknown) {
      // Deletion is server-only and non-destructive on failure (audit F-002):
      // nothing has been removed, so the honest message is simply "retry".
      const code = (e as { code?: string })?.code ?? ''
      const offline = code === 'functions/unavailable' || code === 'unavailable'
      toast(offline
        ? 'Could not reach our servers. Nothing was deleted — please try again once you are online.'
        : 'Could not delete your account. Nothing was deleted — please try again.')
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }
  // "Download my data" — the privacy/GDPR companion to account deletion. Pulls the
  // COMPLETE cloud history when signed in (unwindowed), else exports the local
  // state as-is; both go through the same deterministic serialiser. Non-destructive.
  async function onExportData() {
    if (exporting) return
    setExporting(true)
    try {
      const uid = user?.uid
      const payload =
        authEnabled && uid
          ? { ...(await collectUserExport(uid)), source: 'cloud' as const }
          : splitLocalState(state as unknown as Record<string, unknown>)
      const json = serializeUserExport(payload)
      await deliverExport(buildExportFilename(), json)
      toast('Your data export is ready')
    } catch {
      toast('Could not prepare your export. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const currentLang = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  const NATIVE = Platform.OS === 'ios' || Platform.OS === 'android'
  async function toggleNotifs() {
    const next = !notificationsEnabled
    // Enabling on a real device: ask for OS permission first. If it's denied we
    // must NOT imply success — leave the toggle off and point the user to their
    // device Settings, so the switch always reflects whether notifications can
    // actually fire. On web / Expo Go there's no OS prompt, so the setting just
    // persists (local reminders are a safe no-op there).
    if (next && NATIVE) {
      const granted = await requestPushPermission()
      if (!granted) {
        dispatch({ type: 'SET_SETTINGS', patch: { notificationsEnabled: false, notificationConsent: 'denied' } })
        toast(t('toast.notifsDenied'))
        return
      }
    }
    dispatch({
      type: 'SET_SETTINGS',
      patch: {
        notificationsEnabled: next,
        notificationConsent: next ? 'granted' : notificationConsent,
      },
    })
    // PushRegistration registers the token; <NotificationsSync/> reconciles the
    // scheduling/cancelling of local reminders in reaction to this settings change.
    toast(next ? t('toast.notifsOn') : t('toast.notifsOff'))
  }

  function toggleSound() {
    const next = !soundEnabled
    dispatch({ type: 'SET_SETTINGS', patch: { soundEnabled: next } })
    toast(next ? t('toast.soundOn') : t('toast.soundOff'))
  }

  function setLang(code: Language) {
    dispatch({ type: 'SET_SETTINGS', patch: { language: code } })
    toast(translator(code)('toast.langSet'))
  }

  return (
    <>
      <Group label={t('settings.goals')}>
        <GoalsSettings />
        {/* Core training inputs (goal / experience / days / length / equipment)
            are editable with a preview-before-regenerate flow (audit §5). */}
        <Pressable
          onPress={() => nav.open('trainingProfile')}
          accessibilityRole="button"
          accessibilityLabel="Edit training profile and regenerate program"
          className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90"
        >
          <Dumbbell size={18} color={brand[400]} />
          <View className="flex-1">
            <Text className="font-bold text-white">Training profile</Text>
            <Text className="text-[12px] text-white/50">Goal, experience, days, session length, equipment — preview a new program before applying</Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
        </Pressable>
      </Group>

      <Group label={t('settings.language')}>
        {/* Collapsed disclosure row (iOS Settings pattern) — opens the full
         *  picker on tap instead of a long always-open grid. */}
        <Pressable
          onPress={() => setLangOpen((v) => !v)}
          className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90"
        >
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-bold leading-tight text-white" style={currentLang.rtl ? { writingDirection: 'rtl' } : undefined}>{currentLang.native}</Text>
            <Text className="text-[12px] text-white/45">{currentLang.english}</Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: langOpen ? '90deg' : '0deg' }] }} />
        </Pressable>
        {langOpen && (
          <>
            <View className="mt-2 flex-row flex-wrap gap-2">
              {LANGUAGES.map((l) => {
                const active = l.code === lang
                return (
                  <Pressable
                    key={l.code}
                    onPress={() => { setLang(l.code); setLangOpen(false) }}
                    accessibilityRole="button"
                    accessibilityLabel={`${l.english}${l.code !== 'en' ? ' (partial translation)' : ''}`}
                    accessibilityState={{ selected: active }}
                    className={`flex-row items-center justify-between rounded-2xl border p-3 active:opacity-90 ${active ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
                    style={{ width: '48%' }}
                  >
                    <View className="min-w-0 flex-1">
                      <Text numberOfLines={1} className="font-bold leading-tight text-white" style={l.rtl ? { writingDirection: 'rtl' } : undefined}>{l.native}</Text>
                      <Text className="text-[11px] text-white/45">{l.english}{l.code !== 'en' ? ' · partial' : ''}</Text>
                    </View>
                    {active && <Check size={16} strokeWidth={3} color={brand[400]} />}
                  </Pressable>
                )
              })}
            </View>
            {/* Honesty over implication (audit F-030): today's translations
                cover Settings only — say so instead of promising a translated app. */}
            <Text className="mt-2 px-1 text-[11px] leading-4 text-white/35">
              Translations are a preview and currently cover Settings only — the rest of the app remains in English for now.
            </Text>
          </>
        )}
      </Group>

      {/* Connected apps / integrations */}
      <Group label={t('settings.connected')}>
        <IntegrationsSection />
      </Group>

      <Group label={t('settings.preferences')}>
        <Row icon={<BellRing size={18} color={brand[400]} />} title={t('settings.pushNotifs')} sub={t('settings.pushNotifsSub')}>
          <Toggle on={notificationsEnabled} onPress={toggleNotifs} label={t('settings.pushNotifs')} />
        </Row>
        {notificationConsent === 'denied' && !notificationsEnabled && NATIVE && (
          // Recovery after an OS-level denial (audit F-021): the in-app toggle
          // alone can't help — the permission lives in device Settings.
          <Pressable
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open device settings to allow notifications"
            className="w-full flex-row items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 active:opacity-90"
          >
            <View className="flex-1">
              <Text className="font-bold text-amber-200">Notifications are blocked by your device</Text>
              <Text className="mt-0.5 text-[12px] leading-4 text-white/50">Allow them in device Settings, then turn the switch on here.</Text>
            </View>
            <Text className="text-[12.5px] font-extrabold text-amber-300">Open Settings</Text>
          </Pressable>
        )}
        {notificationsEnabled && <NotificationPrefsPanel t={t} />}
        <Row icon={<Volume2 size={18} color={brand[400]} />} title={t('settings.sound')} sub={t('settings.soundSub')}>
          <Toggle on={soundEnabled} onPress={toggleSound} label={t('settings.sound')} />
        </Row>
      </Group>

      {hasSubscription && (
        <Group label="Subscription">
          <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
            <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1">
                <Text className="font-bold text-white">StrengthHub membership</Text>
                <Text className="mt-0.5 text-[12px] text-white/50">
                  {subStatusLabel}
                  {sub?.status === 'trialing' && sub.trialEnd ? ` · trial ends ${new Date(sub.trialEnd * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                  {sub?.status === 'active' && periodEndLabel ? ` · renews ${periodEndLabel}` : ''}
                  {sub?.status === 'canceled' && periodEndLabel ? ` · access until ${periodEndLabel}` : ''}
                </Text>
              </View>
              <View className={`rounded-full px-2.5 py-1 ${sub?.status === 'past_due' ? 'bg-amber-400/15' : 'bg-brand-400/15'}`}>
                <Text className={`text-[11px] font-bold ${sub?.status === 'past_due' ? 'text-amber-300' : 'text-brand-300'}`}>{subStatusLabel}</Text>
              </View>
            </View>
            <Pressable
              onPress={onManageSubscription}
              disabled={portalBusy}
              accessibilityRole="button"
              accessibilityLabel="Manage or cancel your subscription"
              className={`btn-primary mt-3.5 w-full items-center py-2.5 active:opacity-90 ${portalBusy ? 'opacity-60' : ''}`}
            >
              <Text className="text-sm font-semibold text-black">{portalBusy ? 'Opening…' : 'Manage or cancel subscription'}</Text>
            </Pressable>
            <Text className="mt-2 text-[11px] leading-4 text-white/35">
              Opens Stripe's secure portal: change payment method, view invoices, or cancel any time. Cancelling keeps access until the period ends.
            </Text>
          </View>
        </Group>
      )}

      <Group label={t('settings.data')}>
        {authEnabled && user && <SyncStatusRow />}
        <Pressable onPress={() => { dispatch({ type: 'RESET_DEMO' }); toast('Demo data restored'); onDone?.() }} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
          <RotateCcw size={18} color={brand[400]} />
          <View className="flex-1">
            <Text className="font-bold text-white">{t('settings.resetDemo')}</Text>
            <Text className="text-[12px] text-white/50">{t('settings.resetDemoSub')}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!confirmingClear) { setConfirmingClear(true); return }
            // Wipe to an empty, un-onboarded state → the app drops straight back
            // into onboarding (Shell renders <Onboarding/> when !profile.onboarded).
            dispatch({ type: 'RESET_EMPTY' })
            setConfirmingClear(false)
            onDone?.()
          }}
          className={`w-full flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-90 ${confirmingClear ? 'border-red-500/60 bg-red-500/15' : 'border-red-500/20 bg-red-500/5'}`}
        >
          <Trash2 size={18} color="#f87171" />
          <View className="flex-1">
            <Text className="font-bold text-red-300">{confirmingClear ? 'Tap again to wipe everything' : t('settings.clear')}</Text>
            <Text className="text-[12px] text-white/50">{confirmingClear ? 'Erases your data and restarts onboarding' : t('settings.clearSub')}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onExportData}
          disabled={exporting}
          accessibilityRole="button"
          accessibilityLabel="Download my data"
          className={`w-full flex-row items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 active:opacity-90 ${exporting ? 'opacity-60' : ''}`}
        >
          <Download size={18} color="rgba(255,255,255,0.7)" />
          <View className="flex-1">
            <Text className="font-bold text-white/85">{exporting ? 'Preparing…' : 'Download my data'}</Text>
            <Text className="text-[12px] text-white/50">Export your profile and logs as a JSON file</Text>
          </View>
        </Pressable>
        {authEnabled && (
          <Pressable
            onPress={onDeleteAccount}
            disabled={deleting}
            className={`w-full flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-90 ${confirmingDelete ? 'border-red-500/60 bg-red-500/15' : 'border-red-500/20 bg-red-500/5'} ${deleting ? 'opacity-60' : ''}`}
          >
            <Trash2 size={18} color="#f87171" />
            <View className="flex-1">
              <Text className="font-bold text-red-300">{deleting ? 'Deleting…' : confirmingDelete ? 'Tap again to permanently delete' : 'Delete account'}</Text>
              <Text className="text-[12px] text-white/50">{confirmingDelete ? 'Erases your account and all data — this cannot be undone' : 'Permanently delete your account and data'}</Text>
            </View>
          </Pressable>
        )}
      </Group>

      <Group label="Legal & support">
        {([
          { key: 'terms' as LegalDocKey, title: 'Terms of Service' },
          { key: 'privacy' as LegalDocKey, title: 'Privacy Policy' },
          { key: 'health-safety' as LegalDocKey, title: 'Health & Safety Notice' },
        ]).map((docItem) => (
          <Pressable
            key={docItem.key}
            onPress={() => setLegalDoc(docItem.key)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${docItem.title}`}
            className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90"
          >
            <Text className="flex-1 font-bold text-white">{docItem.title}</Text>
            <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
          </Pressable>
        ))}
        <Pressable
          onPress={() => void Linking.openURL('mailto:info@strengthhubonline.com')}
          accessibilityRole="link"
          accessibilityLabel="Email support at info@strengthhubonline.com"
          className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90"
        >
          <View className="flex-1">
            <Text className="font-bold text-white">Contact support</Text>
            <Text className="text-[12px] text-white/45">info@strengthhubonline.com — billing, data, safety or anything else</Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
        </Pressable>
      </Group>

      <View className="mt-7 items-center gap-2">
        <LogoMark size={34} />
        {/* Real runtime version/build (audit F-033) — what support needs to identify a build. */}
        <Text className="text-[12px] text-white/30">
          StrengthHub Online · v{Constants.expoConfig?.version ?? '1.0.0'}
          {(() => {
            const build = Platform.OS === 'ios'
              ? Constants.expoConfig?.ios?.buildNumber
              : Platform.OS === 'android'
                ? Constants.expoConfig?.android?.versionCode
                : null
            return build ? ` (${build})` : ''
          })()}
        </Text>
      </View>

      <LegalDocModal docKey={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  )
}

/**
 * Honest cloud-backup status with a manual retry (audit F-039): last successful
 * save time, pending/failed states, and a Sync-now action. Silent bounded
 * retries alone let users believe sensitive changes were backed up when they
 * weren't.
 */
function SyncStatusRow() {
  const [status, setStatus] = useState<SyncStatus>({ synced: false, pending: false, error: false, lastSavedAt: null })
  const [retrying, setRetrying] = useState(false)
  useEffect(() => subscribeSyncStatus(setStatus), [])
  const label = status.error
    ? 'Some changes are NOT backed up yet'
    : status.pending
      ? 'Backing up…'
      : !status.synced
        ? 'Connecting to your cloud backup…'
        : status.lastSavedAt
          ? `Backed up ${new Date(status.lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : 'Up to date'
  const tone = status.error ? 'text-amber-200' : 'text-white/85'
  return (
    <View className={`w-full flex-row items-center gap-3 rounded-2xl border p-4 ${status.error ? 'border-amber-400/25 bg-amber-400/[0.06]' : 'border-white/5 bg-ink-800'}`}>
      <View className="flex-1">
        <Text className={`font-bold ${tone}`}>Cloud backup</Text>
        <Text className="mt-0.5 text-[12px] text-white/50">{label}</Text>
      </View>
      <Pressable
        onPress={async () => {
          if (retrying) return
          setRetrying(true)
          try { await requestCloudFlush(8000) } finally { setRetrying(false) }
        }}
        accessibilityRole="button"
        accessibilityLabel="Sync now"
        className="rounded-full bg-white/[0.08] px-3.5 py-2 active:opacity-80"
      >
        <Text className="text-[12.5px] font-bold text-white/80">{retrying ? 'Syncing…' : 'Sync now'}</Text>
      </Pressable>
    </View>
  )
}

/**
 * Units + appearance — the two quick display toggles, pulled out so they can sit
 * at the very top of the menu for fast access (and reused in the Settings sheet).
 */
export function DisplaySettings() {
  const { state, dispatch } = useStore()
  const { units, theme } = state.settings
  const t = translator(state.settings.language ?? 'en')
  return (
    <>
      <Group label={t('settings.units')}>
        <Segmented<Units>
          value={units}
          options={[{ v: 'metric', l: t('settings.metric') }, { v: 'imperial', l: t('settings.imperial') }]}
          onChange={(v) => dispatch({ type: 'SET_SETTINGS', patch: { units: v } })}
        />
      </Group>

      <Group label={t('settings.appearance')}>
        <Segmented<Theme>
          value={theme}
          options={[{ v: 'dark', l: t('settings.dark'), icon: <Moon size={15} color={theme === 'dark' ? '#000' : 'rgba(255,255,255,0.6)'} /> }, { v: 'light', l: t('settings.light'), icon: <Sun size={15} color={theme === 'light' ? '#000' : 'rgba(255,255,255,0.6)'} /> }]}
          onChange={(v) => dispatch({ type: 'SET_SETTINGS', patch: { theme: v } })}
        />
      </Group>
    </>
  )
}

export function SettingsSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const t = translator(state.settings.language ?? 'en')
  return (
    <Sheet open={open} onClose={onClose} title={t('settings.title')}>
      <DisplaySettings />
      <SettingsBody visible={open} onDone={onClose} />
    </Sheet>
  )
}

/* ============================ Profile ============================ */
/* ===================== Menu (full-screen drawer) ================= */
export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore()
  const { enabled: authEnabled, signOut } = useAuth()
  const nav = useNav()
  const insets = useSafeAreaInsets()
  const p = state.profile
  const unread = state.notifications.filter((n) => !n.read).length
  const goalLabel: Record<string, string> = { 'build-muscle': 'Build Muscle', 'lose-fat': 'Lose Fat', 'gain-strength': 'Get Stronger', 'stay-healthy': 'Stay Healthy' }
  const joined = fromKey(p.createdAtKey).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  // Push the target as a detail: it slides in from the right over the menu, and
  // its back arrow returns here (see Sheet's menu-detail mode).
  const go = (o: Parameters<typeof nav.open>[0]) => () => nav.openInMenu(o)
  // Close the drawer, then sign out — the auth listener swaps back to the
  // welcome/login flow automatically once the session ends.
  const logout = () => { onClose(); void signOut() }

  // Left-edge drawer: slide the panel in from the left (translateX -width -> 0),
  // matching the web app's `drawer-in`/`drawer-out` animation. Keep the modal
  // mounted through the slide-out so the exit animation can play.
  const [render, setRender] = useState(open)
  const [width, setWidth] = useState<number>(DEVICE.width)
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: !IS_WEB,
      }).start()
    } else if (render) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 240,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: !IS_WEB,
      }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] })

  return (
    <AppModal visible={render} animationType="none" onRequestClose={onClose}>
      <Animated.View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        className="flex-1 bg-ink-900"
        // A flex child defaults to `min-height: auto`, so on web the inner
        // ScrollView grew to its content height and never scrolled — the last
        // rows (Settings / Log out) ended up clipped below the device frame.
        // `minHeight: 0` lets this column shrink to the real (clamped) device
        // height so the ScrollView is bounded and scrolls. Native keeps flex-1.
        style={{ paddingTop: insets.top, transform: [{ translateX }], ...(IS_WEB ? { flex: 1, minHeight: 0 } : null) }}
      >
        <View className="flex-row items-center gap-2 px-3 py-2.5">
          <Pressable onPress={onClose} hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:opacity-70">
            <X size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text className="text-[17px] font-bold text-white">Menu</Text>
        </View>

        <ScrollView className="flex-1 px-4" style={IS_WEB ? { minHeight: 0 } : undefined} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          <Pressable
            onPress={() => nav.openInMenu('profile')}
            accessibilityRole="button"
            accessibilityLabel={`Open profile for ${p.name}`}
            className="flex-row items-center gap-4 pt-1 active:opacity-80"
          >
            <Avatar name={p.name} size={64} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-xl font-extrabold text-white">{p.name}</Text>
              <Text numberOfLines={1} className="mt-0.5 text-[13px] text-white/50">{p.university} · Age {p.age}</Text>
              <View className="mt-2 flex-row flex-wrap items-center gap-2">
                <View className="rounded-full bg-brand-400/15 px-2.5 py-1"><Text className="text-[11px] font-bold text-brand-400">{goalLabel[p.goal]}</Text></View>
                <Text className="text-[12px] text-white/40">Member since {joined}</Text>
              </View>
            </View>
          </Pressable>

          {/* Quick display toggles up top for fast access. */}
          <View className="mt-6">
            <DisplaySettings />
          </View>

          <MenuSection title="Coaching">
            <MenuRow icon={<Sparkles size={17} color={brand[400]} />} title="Your coach" sub="Daily check-ins and milestones" onPress={go('coach')} first />
            {p.newToGym && <MenuRow icon={<Leaf size={17} color={brand[400]} />} title="New to the gym" sub="Your first 90 days" onPress={go('beginner')} />}
          </MenuSection>

          <MenuSection title="Activity">
            <MenuRow
              icon={<Bell size={17} color={brand[400]} />}
              title="Notifications"
              sub="Reminders, streaks & social"
              onPress={go('notifications')}
              first
              badge={unread > 0 ? <View className="h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-400 px-1.5"><Text className="text-[11px] font-bold text-black">{unread}</Text></View> : undefined}
            />
          </MenuSection>

          {/* Settings opened out inline — no header, so it reads as one continuous
              menu rather than a section you tap into. Each control's own Group
              label carries the structure. */}
          <View className="mt-5">
            <SettingsBody visible={open} onDone={onClose} />
          </View>

          {authEnabled && (
            <Pressable
              onPress={logout}
              className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3.5 active:opacity-80"
            >
              <LogOut size={18} color="#f87171" />
              <Text className="font-semibold text-red-400">Log out</Text>
            </Pressable>
          )}
        </ScrollView>
      </Animated.View>
    </AppModal>
  )
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Text className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide text-white/40">{title}</Text>
      <View className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">{children}</View>
    </View>
  )
}

function MenuRow({ icon, title, sub, onPress, badge, first }: { icon: ReactNode; title: string; sub?: string; onPress: () => void; badge?: ReactNode; first?: boolean }) {
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-3 p-3.5 active:opacity-80 ${first ? '' : 'border-t border-white/5'}`}>
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400/10">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text className="font-semibold text-white">{title}</Text>
        {sub && <Text numberOfLines={1} className="mt-0.5 text-[12px] text-white/45">{sub}</Text>}
      </View>
      {badge}
      <ChevronRight size={18} color="rgba(255,255,255,0.25)" />
    </Pressable>
  )
}

export function ProfileSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const nav = useNav()
  const units = state.settings.units
  const w = weightStats(state)
  const streak = streakStats(state)
  const totalWorkouts = state.sessions.filter((s) => s.completed).length
  const earned = state.badges.filter((b) => b.earned).length
  const goalLabel: Record<string, string> = { 'build-muscle': 'Build Muscle', 'lose-fat': 'Lose Fat', 'gain-strength': 'Get Stronger', 'stay-healthy': 'Stay Healthy' }
  const upcomingCount = upcomingPeriods(state).length
  const planSub = activePeriod(state)
    ? 'Active now'
    : upcomingCount > 0
      ? `${upcomingCount} period${upcomingCount > 1 ? 's' : ''} scheduled`
      : 'Exams, travel or busy weeks'

  return (
    <Sheet open={open} onClose={onClose} title="Profile">
      <View className="flex-row items-center gap-4">
        <Avatar name={state.profile.name} size={64} />
        <View>
          <Text className="text-xl font-extrabold text-white">{state.profile.name}</Text>
          <Text className="text-[13px] text-white/50">{state.profile.age} · {state.profile.university}</Text>
          <View className="mt-1 flex-row">
            <Chip color="green">{goalLabel[state.profile.goal]}</Chip>
          </View>
        </View>
      </View>

      <Text className="mt-3 text-[13px] text-white/45">{state.profile.dorm} · {state.profile.cohort}</Text>

      <View className="mt-4 flex-row gap-3">
        <Stat label="Workouts" value={String(totalWorkouts)} />
        <Stat label="Day streak" value={`${streak.current}`} />
        <Stat label="Weight" value={fmtWeight(w.current, units, 1)} />
      </View>

      <View className="mt-4 gap-2.5">
        <LinkRow icon={<Sparkles size={18} color={brand[400]} />} title="Your coach" sub="Daily check ins and milestones" onPress={() => nav.open('coach')} />
        <LinkRow icon={<Bell size={18} color={brand[400]} />} title="Notifications" sub="Reminders, streaks & social" onPress={() => nav.open('notifications')} />
        <LinkRow icon={<Award size={18} color={brand[400]} />} title="Badges" sub={`${earned} earned`} onPress={() => nav.open('badges')} />
        <LinkRow icon={<Trophy size={18} color={brand[400]} />} title="Campus leaderboard" sub={state.profile.university} onPress={() => nav.open('leaderboard')} />
        <LinkRow icon={<GraduationCap size={18} color={brand[400]} />} title="Plan Around Your Life" sub={planSub} onPress={() => nav.open('examMode')} />
        {state.profile.newToGym && <LinkRow icon={<Leaf size={18} color={brand[400]} />} title="New to the gym" sub="Your first 90 days" onPress={() => nav.open('beginner')} />}
        <LinkRow icon={<User size={18} color="rgba(255,255,255,0.7)" />} title="Settings" sub="Units, theme and data" onPress={() => nav.open('settings')} />
      </View>
    </Sheet>
  )
}

/* ============================ Add Food ============================ */
export function AddFoodSheet({ open, onClose, params }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const [meal, setMeal] = useState<MealName>((params?.meal as MealName) || 'Snack')
  const [q, setQ] = useState('')
  const [budgetOnly, setBudgetOnly] = useState(state.profile.budgetMode)
  const [scanned, setScanned] = useState<string | null>(null)

  const results = useMemo(() => {
    return FOODS.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())).filter((f) => (budgetOnly ? f.budget : true))
  }, [q, budgetOnly])

  function add(foodId: string) {
    const f = FOODS.find((x) => x.id === foodId)!
    dispatch({ type: 'ADD_MEAL', meal: { meal, name: f.name, qty: 1, kcal: f.kcal, p: f.p, c: f.c, f: f.f } })
    toast(`Added to ${meal}`)
    onClose()
  }

  function scan() {
    // simulate a barcode scan resolving to a product
    const f = pick(makeRng(Date.now() % 100000), FOODS.filter((x) => x.barcode))
    setScanned(f.id)
    setQ('')
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 mb-3" contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
        {(['Breakfast', 'Lunch', 'Snack', 'Dinner'] as MealName[]).map((m) => (
          <Pressable key={m} onPress={() => setMeal(m)} accessibilityRole="button" accessibilityLabel={m} accessibilityState={{ selected: meal === m }} className={`shrink-0 rounded-full px-4 py-1.5 active:opacity-90 ${meal === m ? 'bg-brand-400' : 'bg-ink-700'}`}>
            <Text className={`text-sm font-semibold ${meal === m ? 'text-black' : 'text-white/60'}`}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="mb-3 flex-row gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-white/8 bg-ink-800 px-3">
          <Search size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            value={q}
            onChangeText={(v) => { setQ(v); setScanned(null) }}
            placeholder="Search foods…"
            placeholderTextColor="rgba(148,148,148,0.6)"
            className="flex-1 bg-transparent py-3 text-sm text-white"
          />
        </View>
        <Pressable onPress={scan} accessibilityRole="button" accessibilityLabel="Scan a barcode" className="h-[46px] w-[46px] items-center justify-center rounded-xl bg-brand-400 active:opacity-90">
          <ScanLine size={20} color="#000" />
        </Pressable>
      </View>

      <View className="mb-3 flex-row">
        <Pressable onPress={() => setBudgetOnly((b) => !b)} accessibilityRole="button" accessibilityLabel="Budget meals filter" accessibilityState={{ selected: budgetOnly }} className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-90 ${budgetOnly ? 'bg-brand-400/20' : 'bg-ink-700'}`}>
          <Wallet size={13} color={budgetOnly ? brand[400] : 'rgba(255,255,255,0.55)'} />
          <Text className={`text-xs font-semibold ${budgetOnly ? 'text-brand-400' : 'text-white/55'}`}>Budget meals {budgetOnly ? 'on' : 'off'}</Text>
        </Pressable>
      </View>

      {scanned && (
        <View className="mb-3 rounded-2xl border border-brand-400/30 bg-brand-400/10 p-3">
          <Text className="mb-1 text-[12px] font-semibold text-brand-400">✓ Barcode matched</Text>
          <FoodRow id={scanned} onAdd={add} />
        </View>
      )}

      <View className="gap-2">
        {results.map((f) => (
          <FoodRow key={f.id} id={f.id} onAdd={add} />
        ))}
        {results.length === 0 && <Text className="py-6 text-center text-sm text-white/40">No foods found.</Text>}
      </View>
    </Sheet>
  )
}

function FoodRow({ id, onAdd }: { id: string; onAdd: (id: string) => void }) {
  const f = FOODS.find((x) => x.id === id)!
  return (
    <Pressable onPress={() => onAdd(id)} accessibilityRole="button" accessibilityLabel={`Add ${f.name}`} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-3 active:opacity-90">
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-bold leading-tight text-white">{f.name}</Text>
        <Text className="text-[12px] text-white/45">{f.serving} · {f.kcal} kcal · {f.p}P {f.c}C {f.f}F</Text>
      </View>
      {f.budget && <Wallet size={14} color={brand[400]} />}
      <View className="h-7 w-7 items-center justify-center rounded-full bg-brand-400"><Plus size={16} strokeWidth={3} color="#000" /></View>
    </Pressable>
  )
}

/* ============================ Log Weight ============================ */
export function LogWeightSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const current = weightStats(state).current
  const [val, setVal] = useState(() => fmtWeightNum(current, units, 1))

  function save() {
    const kg = toKg(parseFloat(val) || current, units)
    dispatch({ type: 'LOG_WEIGHT', kg: Math.round(kg * 10) / 10 })
    toast('Weight logged')
    onClose()
  }

  const num = weightVal(current, units)
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <Text className="text-[13px] text-white/50">Today · {relativeLabel(todayKey)}</Text>
      <View className="mt-6 flex-row items-end justify-center gap-2">
        <TextInput
          autoFocus
          keyboardType="decimal-pad"
          value={val}
          onChangeText={(v) => setVal(v.replace(/[^\d.]/g, ''))}
          className="w-40 border-b-2 border-brand-400 bg-transparent pb-2 text-center text-5xl font-extrabold text-white"
        />
        <Text className="pb-3 text-xl font-bold text-white/50">{weightUnit(units)}</Text>
      </View>
      <View className="mt-4 flex-row justify-center gap-2">
        {[-0.5, -0.1, 0.1, 0.5].map((d) => (
          <Pressable key={d} onPress={() => setVal((v) => (Math.round(((parseFloat(v) || num) + d) * 10) / 10).toFixed(1))} className="rounded-full bg-ink-700 px-3 py-1.5 active:opacity-80">
            <Text className="text-sm font-semibold text-white">{d > 0 ? `+${d}` : d}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={save} className="btn-primary mt-8 w-full active:opacity-90">
        <Text className="font-semibold text-black">Save</Text>
      </Pressable>
    </Sheet>
  )
}

/* ============================ Log Habit ============================ */
export function LogHabitSheet({ open, onClose }: Props) {
  const { state, dispatch } = useStore()
  const toast = useToast()
  const units = state.settings.units
  const h = todayHabit(state)
  const [steps, setSteps] = useState(h.steps)
  const [sleepH, setSleepH] = useState(h.sleepH)
  const [mindset, setMindset] = useState(h.mindsetMin)

  // Resync to today's values whenever the sheet opens.
  useEffect(() => {
    if (open) { setSteps(h.steps); setSleepH(h.sleepH); setMindset(h.mindsetMin) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function save() {
    dispatch({ type: 'PATCH_TODAY_HABIT', patch: { steps, sleepH, mindsetMin: mindset } })
    toast('Nice work, habits logged 🙌')
    onClose()
  }

  const waterStep = units === 'imperial' ? 8 / 33.814 : 0.25
  return (
    <Sheet open={open} onClose={onClose} title="Log habits">
      <Text className="mb-3 text-[13px] text-white/50">Adjust and log. Done in seconds.</Text>

      <View className="gap-3.5">
        {/* Water: fast tap logger */}
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="flex-row items-center gap-2">
            <Droplet size={18} color={brand[400]} />
            <Text className="flex-1 font-bold text-white">Water</Text>
            <Text className="text-2xl font-extrabold text-brand-400">{fmtFluid(h.waterL, units)}</Text>
          </View>
          <View className="mt-3 flex-row gap-2">
            <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: -waterStep })} className="flex-1 items-center rounded-xl bg-ink-700 py-2.5 active:opacity-80">
              <Text className="text-lg font-bold text-white">−</Text>
            </Pressable>
            <Pressable onPress={() => dispatch({ type: 'ADJUST_WATER', deltaL: waterStep })} className="flex-[2] items-center rounded-xl bg-brand-400/20 py-2.5 active:opacity-80">
              <Text className="font-bold text-brand-400">+ {units === 'imperial' ? '8 oz' : '250 ml'}</Text>
            </Pressable>
          </View>
          <Text className="mt-2 text-center text-[12px] text-white/40">Goal {fmtFluid(state.profile.waterTargetL, units)}</Text>
        </View>

        {/* Steps: stepper */}
        <HabitStepper
          icon={<Footprints size={18} color={brand[400]} />} label="Steps"
          value={steps} min={0} max={20000} step={250} onChange={setSteps}
          display={steps.toLocaleString()} minLabel="0" maxLabel="20k"
          goalLabel={`${(state.profile.stepTarget / 1000).toFixed(0)}k`}
        />

        {/* Sleep: stepper */}
        <HabitStepper
          icon={<BedDouble size={18} color={brand[400]} />} label="Sleep"
          value={sleepH} min={0} max={12} step={0.5} onChange={setSleepH}
          display={`${sleepH}`} unit="h" minLabel="0h" maxLabel="12h"
          goalLabel={`${state.profile.sleepTargetH}h`}
        />

        {/* Mindset: quick chips */}
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="flex-row items-center gap-2">
            <Leaf size={18} color={brand[400]} />
            <Text className="flex-1 font-bold text-white">Mindset</Text>
            <Text className="text-2xl font-extrabold text-brand-400">{mindset}<Text className="text-[13px] font-semibold text-white/40"> min</Text></Text>
          </View>
          <View className="mt-3 flex-row flex-wrap gap-2">
            {[0, 5, 10, 15, 20, 30, 45].map((m) => (
              <Pressable key={m} onPress={() => setMindset(m)} className={`items-center rounded-xl px-3 py-2 active:opacity-90 ${mindset === m ? 'bg-brand-400' : 'bg-ink-700'}`} style={{ minWidth: 44 }}>
                <Text className={`text-sm font-bold ${mindset === m ? 'text-black' : 'text-white/60'}`}>{m === 0 ? 'None' : m}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable onPress={save} className="btn-primary mt-6 w-full active:opacity-90">
        <Text className="font-semibold text-black">Save habits</Text>
      </Pressable>
    </Sheet>
  )
}

/* RN has no range input — emulate the web ruler slider with a labelled
 * +/- stepper that keeps the same value/min/max/step contract. */
function HabitStepper({ icon, label, value, min, max, step, onChange, display, unit, minLabel, maxLabel, goalLabel }: {
  icon: ReactNode; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void
  display: string; unit?: string; minLabel: string; maxLabel: string; goalLabel?: string
}) {
  const round = (n: number) => Math.round(n / step) * step
  const dec = (s: number) => onChange(Math.max(min, round(value - s)))
  const inc = (s: number) => onChange(Math.min(max, round(value + s)))
  return (
    <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="flex-row items-center gap-2">
        {icon}
        <Text className="flex-1 font-bold text-white">{label}</Text>
        <Text className="text-2xl font-extrabold text-brand-400">{display}{unit && <Text className="text-[13px] font-semibold text-white/40"> {unit}</Text>}</Text>
      </View>
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable onPress={() => dec(step)} className="h-11 w-11 items-center justify-center rounded-xl bg-ink-700 active:opacity-80">
          <Minus size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={() => dec(step * 4)} className="flex-1 items-center rounded-xl bg-ink-700 py-3 active:opacity-80">
          <Text className="text-sm font-bold text-white/60">− {step * 4 >= 1000 ? `${step * 4 / 1000}k` : step * 4}</Text>
        </Pressable>
        <Pressable onPress={() => inc(step * 4)} className="flex-1 items-center rounded-xl bg-brand-400/20 py-3 active:opacity-80">
          <Text className="text-sm font-bold text-brand-400">+ {step * 4 >= 1000 ? `${step * 4 / 1000}k` : step * 4}</Text>
        </Pressable>
        <Pressable onPress={() => inc(step)} className="h-11 w-11 items-center justify-center rounded-xl bg-brand-400/20 active:opacity-80">
          <Plus size={18} color={brand[400]} />
        </Pressable>
      </View>
      <View className="mt-1.5 flex-row items-center justify-between">
        <Text className="text-[11px] text-white/35">{minLabel}</Text>
        {goalLabel && <Text className="text-[11px] font-semibold text-brand-400/80">Goal {goalLabel}</Text>}
        <Text className="text-[11px] text-white/35">{maxLabel}</Text>
      </View>
    </View>
  )
}

/* ============================ Create Post ============================ */
export function CreatePostSheet({ open, onClose }: Props) {
  const dispatch = useDispatch()
  const toast = useToast()
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | undefined>()

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 })
    if (!res.canceled) setImage(res.assets[0].uri)
  }

  function post() {
    if (!text.trim()) return
    dispatch({ type: 'ADD_POST', text: text.trim(), image })
    // Community is a PREVIEW (audit F-024): nothing is shared with anyone, so
    // never imply a real publish happened.
    toast('Saved to your preview feed — community isn’t live yet, only you can see this')
    setText(''); setImage(undefined)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Create a post">
      <View className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
        <Text className="text-[12px] leading-4 text-amber-200/90">
          Preview: community isn’t live yet. Posts stay on your device and aren’t visible to anyone else.
        </Text>
      </View>
      <TextInput
        autoFocus
        multiline
        value={text}
        onChangeText={setText}
        placeholder="Share a win, a PR, a meal, or some motivation…"
        placeholderTextColor="rgba(148,148,148,0.6)"
        className="w-full rounded-2xl border border-white/8 bg-ink-800 p-4 text-[15px] text-white"
        style={{ minHeight: 112, textAlignVertical: 'top' }}
      />
      {image && <Image source={{ uri: image }} resizeMode="cover" className="mt-3 h-48 w-full rounded-2xl" />}
      <View className="mt-3 flex-row items-center gap-2">
        <Pressable onPress={pickImage} className="flex-row items-center gap-2 rounded-full bg-ink-700 px-4 py-2 active:opacity-80">
          <Camera size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">{image ? 'Change photo' : 'Add photo'}</Text>
        </Pressable>
      </View>
      <Pressable onPress={post} disabled={!text.trim()} className={`btn-primary mt-6 w-full active:opacity-90 ${!text.trim() ? 'opacity-40' : ''}`}>
        <Text className="font-semibold text-black">Post</Text>
      </Pressable>
    </Sheet>
  )
}

export function LeaderboardSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const toast = useToast()
  const rows = leaderboardSorted(state)
  return (
    <Sheet open={open} onClose={onClose} title="Friends leaderboard">
      <Text className="mb-3 text-[13px] text-white/50">This month · {state.profile.university}</Text>
      <View className="gap-2">
        {rows.map((u, i) => (
          <View key={u.id} className={`flex-row items-center gap-3 rounded-2xl border p-3 ${u.isYou ? 'border-brand-400/40 bg-brand-400/10' : 'border-white/5 bg-ink-800'}`}>
            <Text className={`w-6 text-center text-sm font-extrabold ${i < 3 ? 'text-brand-400' : 'text-white/40'}`}>{i + 1}</Text>
            <Avatar name={u.name} size={38} />
            <View className="flex-1">
              <Text className="font-bold leading-tight text-white">{u.name}</Text>
              <Text className="text-[12px] text-white/45">{u.workouts} workouts · {u.streak} day streak</Text>
            </View>
            <Text className="font-extrabold text-brand-400">{u.points.toLocaleString()}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={async () => {
          const r = await shareText('Join me on StrengthHub, train together and climb the campus leaderboard.', 'StrengthHub')
          toast(r === 'copied' ? 'Invite copied to clipboard' : r === 'shared' ? 'Invite shared' : 'Sharing not available')
        }}
        className="btn-primary mt-5 w-full flex-row items-center justify-center gap-2 active:opacity-90"
      >
        <Plus size={16} color="#000" />
        <Text className="font-semibold text-black">Invite friends</Text>
      </Pressable>
    </Sheet>
  )
}

export function QuickWorkoutsSheet({ open, onClose }: Props) {
  const dispatch = useDispatch()
  const nav = useNav()
  // Seed shows instantly; a Firestore `workouts` overlay (if present) refreshes it.
  const quickWorkouts = useQuickWorkouts()

  // Turn a quick workout into a loggable session and open the same guided
  // follow-along (timer, rest, form) used for prescribed and custom workouts.
  // Each round repeats the same 4 timed stations, so we seed one loggable entry
  // per unique station with targetSets = round count. Stations reference real
  // exercise ids (QD09, CH04…), so the technique sheet shows the proper card.
  // NOTE: this is the interim mapping — the full time-based auto-countdown player
  // (per-station work/rest countdown) is a scoped follow-up.
  function startQuick(q: QuickWorkout) {
    thud() // committing to a session — a firmer confirm than the button's press tick
    const rounds = q.rounds.length
    const stations = q.rounds[0]?.stations ?? []
    const items = stations.map((s) => ({
      defId: s.exerciseId,
      name: s.name,
      image: imageForMuscle('Full Body & Conditioning'),
      targetSets: rounds,
      targetReps: s.repHint ?? `${s.workSec}s`,
    }))
    const base = buildCustomSession(q.name, items, todayKey)
    // Attach the time-based station data so the player runs a countdown circuit:
    // each `set` index is a round; the work phase counts durationSec down and
    // auto-advances, resting restSec between stations and roundRestSec between rounds.
    const exercises = base.exercises.map((e, i) => ({
      ...e,
      measure: 'time' as const,
      durationSec: stations[i]?.workSec ?? 0,
      restSec: stations[i]?.restSec ?? 15,
      perSide: !!stations[i]?.perSide,
    }))
    const roundRestSec = q.rounds.find((r) => r.roundRestSec)?.roundRestSec ?? 60
    const session = { ...base, exercises, focus: q.focus, durationMin: q.minutes, calories: Math.round(q.minutes * 9), accent: 'blue' as const, roundRestSec }
    dispatch({ type: 'SAVE_SESSION', session })
    nav.open('activeWorkout', { sessionId: session.id })
  }

  const levelStyle = (level: string) =>
    level === 'Beginner'
      ? { text: 'text-brand-400', bg: 'bg-brand-400/15' }
      : level === 'Advanced'
        ? { text: 'text-accent-orange', bg: 'bg-accent-orange/15' }
        : { text: 'text-accent-blue', bg: 'bg-accent-blue/15' }

  return (
    <Sheet open={open} onClose={onClose} full>
      <Text className="text-[25px] font-extrabold tracking-[-0.03em] leading-[1.15] text-white">12-Minute Bodyweight Exercises</Text>
      <Text className="mt-2.5 text-[13.5px] leading-5 text-white/55">Quick, no-equipment workouts when you're short on time. Ordered easiest first.</Text>
      <View className="mt-4 gap-2.5">
        {quickWorkouts.map((q) => {
          const stations = q.rounds[0]?.stations ?? []
          const lvl = levelStyle(q.level)
          return (
            <View key={q.id} className="rounded-[20px] border border-white/5 bg-white/[0.03] p-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <View className={`mb-1.5 self-start rounded-full px-2 py-0.5 ${lvl.bg}`}>
                    <Text className={`text-[9.5px] font-bold uppercase tracking-wider ${lvl.text}`}>{q.level}</Text>
                  </View>
                  <Text className="text-[15px] font-bold leading-tight text-white">{q.name}</Text>
                  <Text className="mt-0.5 text-[12px] text-white/50">{q.focus}</Text>
                  <Text className="mt-1 text-[11px] text-white/40">{q.rounds.length} rounds · {stations.length} exercises</Text>
                </View>
                <View className="shrink-0 items-end">
                  <Text className="text-[22px] font-extrabold leading-none text-accent-blue">{q.minutes}</Text>
                  <Text className="mt-[3px] text-[9.5px] font-bold uppercase tracking-wider text-white/35">minutes</Text>
                </View>
              </View>
              <View className="mt-3 flex-row flex-wrap gap-1.5">
                {stations.map((s) => (
                  <View key={s.exerciseId} className="flex-row items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1">
                    <Text className="text-[11.5px] text-white/65">{s.name}</Text>
                    <Text className="text-[11.5px] font-semibold text-white/40">· {s.workSec}s</Text>
                  </View>
                ))}
              </View>
              <PressableScale onPress={() => startQuick(q)} haptic={false} scaleTo={0.97} containerStyle={{ marginTop: 12 }} className="flex-row items-center justify-center gap-1.5 rounded-full bg-accent-blue py-2.5">
                <Play size={12} color="#fff" fill="#fff" />
                <Text className="text-[13.5px] font-bold text-white">Start {q.minutes} min session</Text>
              </PressableScale>
            </View>
          )
        })}
      </View>
    </Sheet>
  )
}

/* ============================ Badges ============================ */
export function BadgesSheet({ open, onClose }: Props) {
  const { state } = useStore()
  const earned = state.badges.filter((b) => b.earned).length
  return (
    <Sheet open={open} onClose={onClose} title={`Badges · ${earned}/${state.badges.length}`}>
      <View className="flex-row flex-wrap gap-3">
        {state.badges.map((b) => (
          <View key={b.id} className={`items-center rounded-2xl border p-3 ${b.earned ? 'border-brand-400/30 bg-brand-400/8' : 'border-white/5 bg-ink-800 opacity-50'}`} style={{ width: '30%' }}>
            <View className={`h-12 w-12 items-center justify-center rounded-full ${b.earned ? 'bg-brand-400/20' : 'bg-white/5'}`}>
              <Icon name={b.icon} size={22} color={b.earned ? '#7ED957' : '#888'} />
            </View>
            <Text className="mt-2 text-center text-[12px] font-bold leading-tight text-white">{b.name}</Text>
            <Text className="mt-0.5 text-center text-[10px] text-white/45">{b.desc}</Text>
            {b.earned && b.earnedDateKey && <Text className="mt-1 text-[9px] font-semibold text-brand-400">{shortDate(b.earnedDateKey)}</Text>}
          </View>
        ))}
      </View>
    </Sheet>
  )
}

/* ============================ shared bits ============================ */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-[12px] font-bold uppercase tracking-wide text-white/40">{label}</Text>
      <View className="gap-2.5">{children}</View>
    </View>
  )
}

function Row({ icon, title, sub, children }: { icon: ReactNode; title: string; sub: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">{icon}</View>
      <View className="flex-1">
        <Text className="font-bold leading-tight text-white">{title}</Text>
        <Text className="text-[12px] text-white/50">{sub}</Text>
      </View>
      {children}
    </View>
  )
}

function LinkRow({ icon, title, sub, onPress }: { icon: ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} className="w-full flex-row items-center gap-3 rounded-2xl border border-white/5 bg-ink-800 p-4 active:opacity-90">
      <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">{icon}</View>
      <View className="flex-1">
        <Text className="font-bold leading-tight text-white">{title}</Text>
        <Text className="text-[12px] text-white/50">{sub}</Text>
      </View>
      <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
    </Pressable>
  )
}

function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      // Real switch semantics (audit F-016): role, checked state and a hit
      // target padded to ≥44pt without changing the visual size.
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      className={`relative h-7 w-12 rounded-full active:opacity-90 ${on ? 'bg-brand-400' : 'bg-white/15'}`}
    >
      <View className="absolute top-0.5 h-6 w-6 rounded-full bg-white" style={{ left: on ? 22 : 2 }} />
    </Pressable>
  )
}

/* 12-hour label for an hour-of-day (times aren't localised — numerals read fine). */
function fmtHour(h: number): string {
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr} ${h < 12 ? 'AM' : 'PM'}`
}

/** Notification categories, reminder time and quiet hours (#1 Phase 0/1). */
function NotificationPrefsPanel({ t }: { t: (k: string) => string }) {
  const { state, dispatch } = useStore()
  const prefs = resolveNotifPrefs(state.settings.notificationPrefs)
  const set = (patch: Partial<NotificationPrefs>) =>
    dispatch({ type: 'SET_SETTINGS', patch: { notificationPrefs: { ...prefs, ...patch } } })
  const TIME_PRESETS = [7, 12, 17, 20]

  return (
    <View className="gap-2.5 rounded-2xl border border-white/5 bg-ink-800/60 p-3.5">
      <Text className="text-[11px] font-bold uppercase tracking-wide text-white/40">{t('notif.deliver')}</Text>
      <Row icon={<Dumbbell size={18} color={brand[400]} />} title={t('notif.workout')} sub={t('notif.workoutSub')}>
        <Toggle on={prefs.workoutReminder} onPress={() => set({ workoutReminder: !prefs.workoutReminder })} label="Workout reminder" />
      </Row>
      <Row icon={<Flame size={18} color={brand[400]} />} title={t('notif.streak')} sub={t('notif.streakSub')}>
        <Toggle on={prefs.streakReminder} onPress={() => set({ streakReminder: !prefs.streakReminder })} label="Streak reminder" />
      </Row>

      <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-white/40">{t('notif.time')}</Text>
      <View className="flex-row gap-2">
        {TIME_PRESETS.map((h) => {
          const on = prefs.reminderHour === h
          return (
            <Pressable key={h} onPress={() => set({ reminderHour: h })} className={`flex-1 items-center rounded-xl py-2.5 active:opacity-90 ${on ? 'bg-brand-400' : 'bg-ink-700'}`}>
              <Text className={`text-[13px] font-bold ${on ? 'text-black' : 'text-white/60'}`}>{fmtHour(h)}</Text>
            </Pressable>
          )
        })}
      </View>

      <View className="mt-1">
        <Row icon={<Moon size={18} color={accent.purple} />} title={t('notif.quiet')} sub={t('notif.quietSub')}>
          <Toggle on={prefs.quiet} onPress={() => set({ quiet: !prefs.quiet })} label="Quiet hours" />
        </Row>
      </View>
      {prefs.quiet && (
        <View className="flex-row gap-2.5">
          <HourStepper label={t('notif.from')} value={prefs.quietStartHour} onChange={(v) => set({ quietStartHour: v })} />
          <HourStepper label={t('notif.to')} value={prefs.quietEndHour} onChange={(v) => set({ quietEndHour: v })} />
        </View>
      )}
    </View>
  )
}

function HourStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-1 rounded-xl border border-white/8 bg-ink-900 p-2.5">
      <Text className="mb-1.5 text-[11px] font-semibold text-white/45">{label}</Text>
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => onChange((value + 23) % 24)} className="h-8 w-8 items-center justify-center rounded-lg bg-ink-700 active:opacity-80"><Minus size={15} color="#fff" /></Pressable>
        <Text className="text-[14px] font-extrabold text-white">{fmtHour(value)}</Text>
        <Pressable onPress={() => onChange((value + 1) % 24)} className="h-8 w-8 items-center justify-center rounded-lg bg-brand-400/20 active:opacity-80"><Plus size={15} color={brand[400]} /></Pressable>
      </View>
    </View>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string; icon?: ReactNode }[]; onChange: (v: T) => void }) {
  const n = options.length
  const idx = Math.max(0, options.findIndex((o) => o.v === value))
  const [w, setW] = useState(0)
  // Slide the highlight pill between options instead of hard-swapping the
  // background, so switching units/theme reads as one smooth motion.
  const anim = useRef(new Animated.Value(idx)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: idx, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: !IS_WEB }).start()
  }, [idx, anim])

  const PAD = 4, GAP = 4
  const itemW = w > 0 ? (w - PAD * 2 - GAP * (n - 1)) / n : 0
  const translateX = anim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => PAD + i * (itemW + GAP)),
  })

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} className="relative flex-row gap-1 rounded-xl bg-ink-700 p-1">
      {itemW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: PAD, bottom: PAD, left: 0, width: itemW, borderRadius: 8, backgroundColor: brand[400], transform: [{ translateX }] }}
        />
      )}
      {options.map((o) => (
        <Pressable
          key={o.v}
          onPress={() => onChange(o.v)}
          accessibilityRole="button"
          accessibilityLabel={o.l}
          accessibilityState={{ selected: value === o.v }}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5 active:opacity-90"
        >
          {o.icon}
          <Text className={`text-sm font-semibold ${value === o.v ? 'text-black' : 'text-white/60'}`}>{o.l}</Text>
        </Pressable>
      ))}
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-2xl border border-white/5 bg-ink-800 p-3">
      <Text className="text-lg font-extrabold text-white">{value}</Text>
      <Text className="text-[11px] text-white/45">{label}</Text>
    </View>
  )
}
