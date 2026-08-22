/**
 * Plan Around Your Life — declare a busy period (exams, travel, moving house)
 * and choose how training bends around it.
 *
 * Five steps, each one decision: hub → dates → mode → a per-mode follow-up →
 * review. Nothing is written until the review step is confirmed, which is the
 * promise the review copy makes. The saved period is mirrored straight onto the
 * backend user document as a `planned_absence` (see store/store.tsx), so what the
 * generator applies is exactly what was shown here.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, TextInput, Animated, Easing, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ChevronLeft, ChevronRight, Plus, X, Check, GraduationCap, Pause, Heart, Footprints,
  CalendarDays, ArrowDownToLine, Lock,
} from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { AppModal } from '../components/WebFrame'
import { PressableScale } from '../components/PressableScale'
import { useToast } from '../components/Toast'
import { ProgressBar } from '../components/ui'
import { useStore } from '../store/store'
import { useT } from '../lib/useT'
import { accentFor, useColors } from '../theme'
import { todayKey, fromKey, toKey } from '../lib/date'
import {
  PERIOD_MODES, WEEKDAY_KEYS, activePeriod, dateIssue, daysLabel, daysUntil, fmtPeriodDate,
  followupValid, modeMeta, newPeriodDraft, nextDayKey, normalTrainingDays, periodLength,
  periodRangeText, periodTitle, plannedPeriods, upcomingPeriods, whatHappens,
  type PeriodModeMeta,
} from '../store/periods'
import type { MovingType, PeriodMode, PlannedPeriod } from '../store/types'

type ThemeColors = ReturnType<typeof useColors>
type Screen = 'hub' | 'dates' | 'mode' | 'followup' | 'review'
type Draft = Omit<PlannedPeriod, 'id'>
type Dialog = { title: string; body: string; cancelLabel: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }

const EASE = Easing.bezier(0.22, 1, 0.36, 1)
const USE_NATIVE = Platform.OS !== 'web'

const MODE_ICONS: Record<string, typeof Pause> = {
  pause: Pause, heart: Heart, walk: Footprints, fewer: CalendarDays, deload: ArrowDownToLine, lock: Lock,
}

function ModeIcon({ meta, size, colors }: { meta: PeriodModeMeta | undefined; size: number; colors: ThemeColors }) {
  const Cmp = MODE_ICONS[meta?.icon ?? 'lock'] ?? Lock
  return <Cmp size={size} color={accentFor(meta?.accent ?? 'fg', colors)} strokeWidth={1.9} />
}

/** The pill that names a mode, tinted with that mode's accent. */
function ModeChip({ meta, colors }: { meta: PeriodModeMeta | undefined; colors: ThemeColors }) {
  if (!meta) return null
  const neutral = meta.accent === 'fg'
  const col = accentFor(meta.accent, colors)
  return (
    <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: `${col}${neutral ? '1a' : '26'}` }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: neutral ? `${colors.fg}b3` : col }}>{meta.title}</Text>
    </View>
  )
}

/**
 * The design's `screenIn`: each step fades up from 10px as it mounts. Keyed on
 * the screen name, so moving between steps replays the entrance rather than
 * snapping — the "smoother transitions" the flow was missing.
 */
function ScreenTransition({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const p = useRef(new Animated.Value(0)).current
  useEffect(() => {
    p.setValue(0)
    Animated.timing(p, { toValue: 1, duration: 360, easing: EASE, useNativeDriver: USE_NATIVE }).start()
  }, [screenKey, p])
  return (
    <Animated.View style={{ opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  )
}

export function PlanAroundLifeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore()
  const colors = useColors()
  const insets = useSafeAreaInsets()
  // Messages that land as this panel closes have to come from the app-level
  // toast — the local one would unmount with the panel before it was read.
  const appToast = useToast()
  const t = useT()

  const [screen, setScreen] = useState<Screen>('hub')
  const [draft, setDraft] = useState<Draft>(newPeriodDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [picking, setPicking] = useState<'start' | 'end'>('start')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scroller = useRef<ScrollView>(null)

  // Always land on the hub — reopening mid-flow with a half-built draft would be
  // a confusing place to arrive from the dashboard.
  useEffect(() => {
    if (!open) return
    setScreen('hub'); setDraft(newPeriodDraft()); setEditingId(null)
    setDetailOpen(false); setDialog(null); setPicking('start')
  }, [open])

  // Each step is a fresh page, so it starts at the top. Without this, moving on
  // from a long screen drops you into the middle of the next one.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false })
  }, [screen])

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const flash = (msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }

  const active = activePeriod(state)
  const upcoming = upcomingPeriods(state)
  const selected = selectedId ? [...upcoming, ...(active ? [active] : [])].find((p) => p.id === selectedId) ?? null : null

  const modeM = modeMeta(draft.mode)
  const hasFollowup = !!modeM?.followup
  const issue = dateIssue(state, draft, editingId)
  const datesOk = !!draft.start && !!draft.end && !issue
  // The days already claimed by *other* periods — shown on the calendar and
  // barred from selection, so the user can see what a period would collide with
  // rather than getting an "overlaps an existing period" error out of nowhere.
  // The period being edited is excluded, so its own days stay free to adjust.
  const takenRanges = plannedPeriods(state)
    .filter((p) => p.id !== editingId)
    .map((p) => ({ start: p.start, end: p.end }))

  const stepTotal = hasFollowup ? 4 : 3
  const stepNum = screen === 'dates' ? 1 : screen === 'mode' ? 2 : screen === 'followup' ? 3 : stepTotal

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  const back = () => {
    if (screen === 'hub') return onClose()
    if (screen === 'dates') { setEditingId(null); return setScreen('hub') }
    if (screen === 'mode') return setScreen('dates')
    if (screen === 'followup') return setScreen('mode')
    if (screen === 'review') return setScreen(hasFollowup ? 'followup' : 'mode')
  }

  const startAdd = () => { setDraft(newPeriodDraft()); setEditingId(null); setPicking('start'); setScreen('dates') }

  const startEdit = (p: PlannedPeriod) => {
    setDraft({
      start: p.start, end: p.end, mode: p.mode,
      maintDays: p.maintDays.length ? p.maintDays : ['Mon', 'Wed'],
      fewerCount: p.fewerCount || 1,
      fewerDays: p.fewerDays.length ? p.fewerDays : ['Wed'],
      movingType: p.movingType || 'both',
      note: p.note ?? '',
    })
    setEditingId(p.id); setDetailOpen(false); setPicking('start'); setScreen('dates')
  }

  // Switching mode resets the follow-up answers — they belong to the old mode.
  const selectMode = (id: PeriodMode) => {
    if (draft.mode === id) return
    const fresh = newPeriodDraft()
    patch({ mode: id, maintDays: fresh.maintDays, fewerCount: fresh.fewerCount, fewerDays: fresh.fewerDays, movingType: fresh.movingType })
  }

  const confirm = () => {
    if (issue) return flash(issue)
    const id = editingId ?? `pp-${Date.now()}`
    const period: PlannedPeriod = { ...draft, id, note: (draft.note ?? '').trim() || undefined }
    dispatch({ type: 'SAVE_PERIOD', period })
    const startsNow = daysUntil(period.start) <= 0
    // A period starting today closes the flow. Leave the draft alone on the way
    // out — the panel is still rendering the review screen through its slide-out,
    // and blanking the draft now would flash an empty "Not set" card. The open
    // effect clears it before the flow is ever seen again.
    if (startsNow) {
      appToast(t('Plan Around Your Life is on'))
      return onClose()
    }
    flash(editingId ? t('Changes saved') : t('Period saved'))
    setEditingId(null); setDraft(newPeriodDraft()); setScreen('hub')
  }

  // Close the detail sheet as the dialog opens. They are separate modals, and
  // left both open the sheet stacks on top of the dialog and hides its buttons —
  // so the confirm was unreachable. One modal at a time keeps the action tappable.
  const askCancel = (p: PlannedPeriod) => {
    setDetailOpen(false)
    setDialog({
      title: t('Cancel this period?'),
      body: t('Your training won’t change for these dates. You can always add it again later.'),
      cancelLabel: t('Keep it'), confirmLabel: t('Cancel period'), danger: true,
      onConfirm: () => { dispatch({ type: 'CANCEL_PERIOD', id: p.id }); setDialog(null); flash(t('Period cancelled')) },
    })
  }

  const askEndEarly = (p: PlannedPeriod) => {
    setDetailOpen(false)
    setDialog({
      title: t('End Plan Around Your Life early?'),
      body: t('We’ll switch you back to your normal program right away.'),
      cancelLabel: t('Stay in it'), confirmLabel: t('End now'), danger: true,
      onConfirm: () => { dispatch({ type: 'CANCEL_PERIOD', id: p.id }); setDialog(null); appToast(t('Normal training restored')); onClose() },
    })
  }

  /* ------------------------------ footer ------------------------------ */
  const footer: { label: string; onPress: () => void; disabled?: boolean; icon?: boolean } | null =
    screen === 'hub' ? { label: t('Add period'), onPress: startAdd, icon: true }
    : screen === 'dates' ? { label: t('Continue'), onPress: () => setScreen('mode'), disabled: !datesOk }
    : screen === 'mode' ? { label: t('Continue'), onPress: () => setScreen(hasFollowup ? 'followup' : 'review'), disabled: !draft.mode }
    : screen === 'followup' ? { label: t('Continue'), onPress: () => setScreen('review'), disabled: !followupValid(draft) }
    : { label: editingId ? t('Save changes') : t('Schedule This Plan'), onPress: confirm }

  return (
    <Sheet open={open} onClose={onClose} bare>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Pinned dismiss/back control — kept ABOVE the ScrollView so it never scrolls away
            (Back within the flow, Close on the hub). */}
        <View style={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 2 }}>
          <Pressable
            onPress={back}
            hitSlop={8}
            accessibilityLabel={screen === 'hub' ? 'Close' : 'Back'}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink700 }}
          >
            <ChevronLeft size={22} color={`${colors.fg}cc`} />
          </Pressable>
        </View>
        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 6, paddingBottom: 132 + insets.bottom }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {screen !== 'hub' && (
            <View style={{ marginTop: 16 }}>
              <ProgressBar value={Math.round((stepNum / stepTotal) * 100)} color={colors.brand400} height={4} />
              <Text style={{ marginTop: 16, fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: `${colors.fg}73` }}>
                Step {stepNum} of {stepTotal}
              </Text>
            </View>
          )}

          <ScreenTransition screenKey={screen}>
            {screen === 'hub' && (
              <HubScreen
                colors={colors}
                active={active}
                upcoming={upcoming}
                onOpenPeriod={(p) => { setSelectedId(p.id); setDetailOpen(true) }}
                onEndEarly={askEndEarly}
              />
            )}

            {screen === 'dates' && (
              <DatesScreen
                colors={colors}
                draft={draft}
                patch={patch}
                picking={picking}
                setPicking={setPicking}
                issue={issue}
                valid={datesOk}
                taken={takenRanges}
              />
            )}

            {screen === 'mode' && <ModeScreen colors={colors} selected={draft.mode} onSelect={selectMode} />}

            {screen === 'followup' && (
              <FollowupScreen colors={colors} draft={draft} patch={patch} normalDays={normalTrainingDays(state)} />
            )}

            {screen === 'review' && (
              <ReviewScreen
                colors={colors}
                draft={draft}
                onEditDates={() => setScreen('dates')}
                onEditMode={() => setScreen('mode')}
              />
            )}
          </ScreenTransition>
        </ScrollView>

        {/* Primary action, pinned over a fade so content scrolls away under it
         *  rather than being cut off by a hard edge. */}
        {footer && (
          <LinearGradient
            colors={['transparent', colors.ink900, colors.ink900]}
            locations={[0, 0.38, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22 + insets.bottom }}
          >
            <PressableScale onPress={footer.disabled ? () => {} : footer.onPress} scaleTo={0.975} haptic={!footer.disabled} disabled={footer.disabled}>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderRadius: 999, paddingVertical: 15,
                  backgroundColor: footer.disabled ? `${colors.fg}1f` : colors.brand400,
                }}
              >
                {footer.icon && <Plus size={19} color={footer.disabled ? `${colors.fg}66` : '#0a0a0b'} strokeWidth={2.6} />}
                <Text style={{ fontSize: 16, fontWeight: '800', color: footer.disabled ? `${colors.fg}66` : '#0a0a0b' }}>{footer.label}</Text>
              </View>
            </PressableScale>
          </LinearGradient>
        )}

        {!!toast && <Toast msg={toast} colors={colors} bottom={100 + insets.bottom} />}
      </View>

      <PeriodDetailSheet
        open={detailOpen && !!selected}
        period={selected}
        isActive={!!selected && selected.id === active?.id}
        colors={colors}
        onClose={() => setDetailOpen(false)}
        onEdit={startEdit}
        onCancel={askCancel}
        onEndEarly={askEndEarly}
      />

      <ConfirmDialog dialog={dialog} colors={colors} onDismiss={() => setDialog(null)} />
    </Sheet>
  )
}

/* ================================ hub ================================ */

function HubScreen({ colors, active, upcoming, onOpenPeriod, onEndEarly }: {
  colors: ThemeColors
  active: PlannedPeriod | null
  upcoming: PlannedPeriod[]
  onOpenPeriod: (p: PlannedPeriod) => void
  onEndEarly: (p: PlannedPeriod) => void
}) {
  const activeMeta = modeMeta(active?.mode)
  const t = useT()
  return (
    <>
      <Text style={{ marginTop: 14, fontSize: 28, fontWeight: '800', letterSpacing: -0.56, color: colors.fg }}>{t('Plan Around Your Life')}</Text>
      <Text style={{ marginTop: 7, fontSize: 14, lineHeight: 21, color: `${colors.fg}99` }}>
        {t("Add exams, travel or other busy periods and we'll adapt your training without losing your progress.")}
      </Text>

      {active && (
        <View style={{ marginTop: 20, borderRadius: 20, padding: 17, backgroundColor: `${colors.brand500}33`, borderWidth: 1, borderColor: `${colors.brand400}61` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand400 }} />
            <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 0.26, color: colors.brand300 }}>{t('ACTIVE NOW')}</Text>
          </View>
          <Text style={{ marginTop: 12, fontSize: 18, fontWeight: '700', color: colors.fg }}>{periodTitle(active)}</Text>
          <Text style={{ marginTop: 2, fontSize: 13, color: `${colors.fg}99` }}>{periodRangeText(active.start, active.end)}</Text>
          <View style={{ marginTop: 9 }}><ModeChip meta={activeMeta} colors={colors} /></View>
          <Text style={{ marginTop: 12, fontSize: 13.5, color: `${colors.fg}cc` }}>{activeMeta?.effect}</Text>
          <Text style={{ marginTop: 5, fontSize: 13.5, color: `${colors.fg}99` }}>
            {t('Normal training returns')} <Text style={{ fontWeight: '700', color: colors.fg }}>{fmtPeriodDate(nextDayKey(active.end))}</Text>
          </Text>
          <Pressable
            onPress={() => onEndEarly(active)}
            style={{ marginTop: 15, borderRadius: 13, borderWidth: 1, borderColor: `${colors.fg}29`, paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.fg }}>{t('End Plan Around Your Life early')}</Text>
          </Pressable>
        </View>
      )}

      {upcoming.length > 0 ? (
        <>
          <Text style={{ marginTop: 26, marginBottom: 11, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.84, color: `${colors.fg}73` }}>{t('Upcoming')}</Text>
          <View style={{ gap: 10 }}>
            {upcoming.map((p) => {
              const meta = modeMeta(p.mode)
              const col = accentFor(meta?.accent ?? 'fg', colors)
              return (
                <PressableScale key={p.id} onPress={() => onOpenPeriod(p)} scaleTo={0.99}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, padding: 14, backgroundColor: colors.ink800, borderWidth: 1, borderColor: `${colors.fg}0f` }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: `${col}26` }}>
                      <ModeIcon meta={meta} size={20} colors={colors} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: colors.fg }}>{periodTitle(p)}</Text>
                      <Text style={{ marginTop: 2, fontSize: 13, color: `${colors.fg}8c` }}>{periodRangeText(p.start, p.end)}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 9 }}>
                        <ModeChip meta={meta} colors={colors} />
                        <Text style={{ fontSize: 12, color: `${colors.fg}73` }}>{t('starts {label}', { label: daysLabel(daysUntil(p.start)) })}</Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={`${colors.fg}59`} />
                  </View>
                </PressableScale>
              )
            })}
          </View>
        </>
      ) : (
        <View style={{ marginTop: 26, borderRadius: 18, paddingVertical: 30, paddingHorizontal: 16, alignItems: 'center', backgroundColor: colors.ink800, borderWidth: 1, borderStyle: 'dashed', borderColor: `${colors.fg}1f` }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: `${colors.fg}80` }}>{t('No periods yet')}</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: `${colors.fg}80` }}>{t('Add one whenever a busy period is coming up.')}</Text>
        </View>
      )}

      <Text style={{ marginTop: 16, fontSize: 12, lineHeight: 18, textAlign: 'center', color: `${colors.fg}59` }}>
        {t('Add several periods, and edit or cancel any of them before they start.')}
      </Text>
    </>
  )
}

/* =============================== dates =============================== */

function DatesScreen({ colors, draft, patch, picking, setPicking, issue, valid, taken }: {
  colors: ThemeColors
  draft: Draft
  patch: (p: Partial<Draft>) => void
  picking: 'start' | 'end'
  setPicking: (p: 'start' | 'end') => void
  issue: string | null
  valid: boolean
  taken: { start: string; end: string }[]
}) {
  const t = useT()
  const days = periodLength(draft.start, draft.end)
  const summary = valid ? t('{n} day period · normal training resumes {date}', { n: days, date: fmtPeriodDate(nextDayKey(draft.end)) }) : null
  const caution = valid && days > 120 ? t('That is a long period ({n} days). Double check the dates are right.', { n: days }) : null

  // Tapping a day fills whichever field is armed, then arms the other one — so
  // the common case (pick start, pick end) is two taps with no mode switching.
  // Arming "end" before there's a start still fills the start: the first day you
  // pick is the start of the range whichever field you tapped.
  const onPickDay = (key: string) => {
    if (picking === 'start' || !draft.start) {
      patch({ start: key, end: draft.end && draft.end < key ? '' : draft.end })
      setPicking('end')
    } else if (key < draft.start) {
      // Picked an end before the start — treat it as dragging the range open
      // backwards rather than rejecting it.
      patch({ start: key, end: draft.start })
    } else {
      patch({ end: key })
    }
  }

  return (
    <>
      <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', letterSpacing: -0.48, color: colors.fg }}>{t('When will you be busy?')}</Text>
      <Text style={{ marginTop: 7, fontSize: 14, lineHeight: 21, color: `${colors.fg}99` }}>
        {t('Set the full period, whether it is exams, travel or something else.')}
      </Text>

      <View style={{ marginTop: 22, gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DateField label={t('Start date')} value={draft.start} armed={picking === 'start'} colors={colors} onPress={() => setPicking('start')} />
          <DateField label={t('End date')} value={draft.end} armed={picking === 'end'} colors={colors} onPress={() => setPicking('end')} />
        </View>

        <RangeCalendar start={draft.start} end={draft.end} taken={taken} colors={colors} onPick={onPickDay} />

        {!!summary && (
          <View style={{ borderRadius: 14, paddingVertical: 13, paddingHorizontal: 15, backgroundColor: `${colors.brand400}1a` }}>
            <Text style={{ fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.brand300 }}>{summary}</Text>
          </View>
        )}
        {!!issue && <Text style={{ fontSize: 13, fontWeight: '600', color: colors.danger }}>{issue}</Text>}
        {!!caution && (
          <View style={{ borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: `${colors.accentOrange}1f` }}>
            <Text style={{ fontSize: 13, fontWeight: '600', lineHeight: 18, color: colors.accentOrange }}>{caution}</Text>
          </View>
        )}

        <View style={{ marginTop: 4 }}>
          <Text style={{ marginBottom: 7, fontSize: 13, fontWeight: '700', color: `${colors.fg}99` }}>
            {t('What should we call this period?')} <Text style={{ fontWeight: '500', color: `${colors.fg}59` }}>{t('(optional)')}</Text>
          </Text>
          <TextInput
            value={draft.note ?? ''}
            onChangeText={(v) => patch({ note: v })}
            placeholder={t('e.g. Final exams, Away interstate, Holiday')}
            placeholderTextColor={`${colors.fg}4d`}
            style={{ borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}14`, color: colors.fg, fontSize: 16 }}
          />
        </View>
      </View>
    </>
  )
}

function DateField({ label, value, armed, colors, onPress }: { label: string; value: string; armed: boolean; colors: ThemeColors; onPress: () => void }) {
  const t = useT()
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ marginBottom: 7, fontSize: 13, fontWeight: '700', color: `${colors.fg}99` }}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={{
          borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14,
          backgroundColor: colors.ink700,
          borderWidth: 1, borderColor: armed ? `${colors.brand400}99` : `${colors.fg}14`,
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: value ? '700' : '400', color: value ? colors.fg : `${colors.fg}4d` }}>
          {value ? fmtPeriodDate(value) : t('Select')}
        </Text>
      </Pressable>
    </View>
  )
}

const CAL_WD = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Month calendar that paints the selected range, past + taken days disabled. */
function RangeCalendar({ start, end, taken, colors, onPick }: { start: string; end: string; taken: { start: string; end: string }[]; colors: ThemeColors; onPick: (key: string) => void }) {
  const isTaken = (key: string) => taken.some((r) => key >= r.start && key <= r.end)
  const today = fromKey(todayKey)
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() })

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1)
    const startDow = (first.getDay() + 6) % 7 // Monday = 0
    const count = new Date(ym.y, ym.m + 1, 0).getDate()
    const out: (string | null)[] = Array.from({ length: startDow }, () => null)
    for (let d = 1; d <= count; d++) out.push(toKey(new Date(ym.y, ym.m, d)))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [ym])

  const atFirst = ym.y === today.getFullYear() && ym.m === today.getMonth()
  const prev = () => { if (!atFirst) setYm((a) => (a.m === 0 ? { y: a.y - 1, m: 11 } : { y: a.y, m: a.m - 1 })) }
  const next = () => setYm((a) => (a.m === 11 ? { y: a.y + 1, m: 0 } : { y: a.y, m: a.m + 1 }))

  return (
    <View style={{ borderRadius: 16, padding: 10, backgroundColor: colors.ink700, borderWidth: 1, borderColor: `${colors.fg}14` }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 }}>
        <Pressable onPress={prev} disabled={atFirst} hitSlop={8} accessibilityLabel="Previous month" style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, opacity: atFirst ? 0.25 : 1 }}>
          <ChevronLeft size={20} color={`${colors.fg}b3`} />
        </Pressable>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.fg }}>{CAL_MONTHS[ym.m]} {ym.y}</Text>
        <Pressable onPress={next} hitSlop={8} accessibilityLabel="Next month" style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
          <ChevronRight size={20} color={`${colors.fg}b3`} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {CAL_WD.map((w) => (
          <View key={w} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: `${colors.fg}59` }}>{w}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((key, i) => {
          if (!key) return <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 40 }} />
          const past = key < todayKey
          const isStart = !!start && key === start
          const isEnd = !!end && key === end
          const inRange = !!start && !!end && key > start && key < end
          const edge = isStart || isEnd
          // A day already claimed by another period. The current draft's own
          // selection wins the paint, so a taken day only shows as "busy" when
          // it isn't part of the range being picked.
          const busy = !edge && !inRange && isTaken(key)
          const disabled = past || busy
          return (
            <View key={key} style={{ width: `${100 / 7}%`, height: 40, padding: 2 }}>
              <Pressable
                onPress={() => onPick(key)}
                disabled={disabled}
                accessibilityLabel={`${fmtPeriodDate(key)}${busy ? ', already booked' : ''}`}
                style={{
                  flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10,
                  opacity: past ? 0.22 : busy ? 0.55 : 1,
                  backgroundColor: edge ? colors.brand400 : inRange ? `${colors.brand400}29` : busy ? `${colors.fg}14` : 'transparent',
                  borderWidth: !edge && key === todayKey ? 1 : 0,
                  borderColor: `${colors.brand400}80`,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: edge ? '800' : '600', color: edge ? '#0a0a0b' : colors.fg, textDecorationLine: busy ? 'line-through' : 'none' }}>{fromKey(key).getDate()}</Text>
              </Pressable>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ================================ mode ================================ */

function ModeScreen({ colors, selected, onSelect }: { colors: ThemeColors; selected: PeriodMode | null; onSelect: (id: PeriodMode) => void }) {
  const t = useT()
  return (
    <>
      <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', letterSpacing: -0.48, color: colors.fg }}>{t('How should we train you?')}</Text>
      <Text style={{ marginTop: 7, fontSize: 14, lineHeight: 21, color: `${colors.fg}99` }}>
        {t("Pick one approach for this period, and we'll build the schedule around it.")}
      </Text>
      <View style={{ marginTop: 20, gap: 10 }}>
        {PERIOD_MODES.map((m) => {
          const on = selected === m.id
          const col = accentFor(m.accent, colors)
          return (
            <PressableScale key={m.id} onPress={() => onSelect(m.id)} scaleTo={0.985}>
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 16,
                  backgroundColor: on ? `${col}1f` : colors.ink800,
                  borderWidth: 1, borderColor: on ? `${col}99` : `${colors.fg}0f`,
                }}
              >
                <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${col}26` }}>
                  <ModeIcon meta={m} size={20} colors={colors} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.fg }}>{m.title}</Text>
                  <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 17.5, color: `${colors.fg}80` }}>{m.tag}</Text>
                </View>
                <Radio on={on} color={col} colors={colors} />
              </View>
            </PressableScale>
          )
        })}
      </View>
    </>
  )
}

function Radio({ on, color, colors }: { on: boolean; color: string; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: on ? color : `${colors.fg}40`,
        backgroundColor: on ? `${color}26` : 'transparent',
      }}
    >
      {on && <Check size={13} strokeWidth={3.4} color={color} />}
    </View>
  )
}

/* ============================== follow-up ============================== */

const MOVING_OPTIONS: { id: MovingType; title: string; sub: string }[] = [
  { id: 'walking', title: 'Walking', sub: 'A daily walk prompt' },
  { id: 'mobility', title: 'Mobility', sub: 'Gentle stretching sessions' },
  { id: 'both', title: 'Both', sub: 'Walking plus optional mobility' },
]

function FollowupScreen({ colors, draft, patch, normalDays }: {
  colors: ThemeColors
  draft: Draft
  patch: (p: Partial<Draft>) => void
  normalDays: string[]
}) {
  const t = useT()
  const mode = draft.mode
  const title = mode === 'maintenance' ? t('Which days can you still train?') : mode === 'fewer' ? t('How often can you train?') : t('What kind of movement?')
  const sub =
    mode === 'maintenance' ? t("We'll place your two maintenance sessions on the days that suit you.")
    : mode === 'fewer' ? t('Tell us your availability so we schedule the right sessions.')
    : t("Pick what you'd like to be nudged to do each day.")

  const toggleMaint = (day: string) => {
    const has = draft.maintDays.includes(day)
    if (!has && draft.maintDays.length >= 2) return
    patch({ maintDays: has ? draft.maintDays.filter((d) => d !== day) : [...draft.maintDays, day] })
  }

  // With one session a week, tapping a new day just moves it — an "unselect the
  // old one first" dance would be pointless friction.
  const toggleFewer = (day: string) => {
    const has = draft.fewerDays.includes(day)
    if (has) return patch({ fewerDays: draft.fewerDays.filter((d) => d !== day) })
    if (draft.fewerDays.length >= draft.fewerCount) {
      if (draft.fewerCount === 1) return patch({ fewerDays: [day] })
      return
    }
    patch({ fewerDays: [...draft.fewerDays, day] })
  }

  return (
    <>
      <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', letterSpacing: -0.48, color: colors.fg }}>{title}</Text>
      <Text style={{ marginTop: 7, fontSize: 14, lineHeight: 21, color: `${colors.fg}99` }}>{sub}</Text>

      {mode === 'maintenance' && (
        <>
          <Text style={{ marginTop: 22, marginBottom: 10, fontSize: 12, fontWeight: '600', color: `${colors.fg}73` }}>{t('Choose up to 2 days')}</Text>
          <DayChips
            colors={colors}
            selected={draft.maintDays}
            disabledWhenFull={draft.maintDays.length >= 2}
            onToggle={toggleMaint}
          />
          <Text style={{ marginTop: 11, fontSize: 12, lineHeight: 17, color: `${colors.fg}66` }}>
            {draft.maintDays.length ? t('Selected: {days}', { days: draft.maintDays.join(' & ') }) : t('Your usual days ({days}) are a good start.', { days: normalDays.join(', ') })}
          </Text>
        </>
      )}

      {mode === 'fewer' && (
        <>
          <Text style={{ marginTop: 22, marginBottom: 10, fontSize: 13, fontWeight: '700', color: `${colors.fg}a6` }}>{t('How often can you train?')}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([1, 2] as const).map((n) => {
              const on = draft.fewerCount === n
              return (
                <Pressable
                  key={n}
                  onPress={() => patch({ fewerCount: n, fewerDays: draft.fewerDays.slice(0, n) })}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 14,
                    backgroundColor: on ? `${colors.brand400}26` : colors.ink700,
                    borderWidth: 1, borderColor: on ? `${colors.brand400}99` : `${colors.fg}0f`,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: on ? colors.brand300 : `${colors.fg}cc` }}>{t(n === 1 ? 'Once per week' : 'Twice per week')}</Text>
                </Pressable>
              )
            })}
          </View>
          <Text style={{ marginTop: 20, marginBottom: 10, fontSize: 13, fontWeight: '700', color: `${colors.fg}a6` }}>
            {draft.fewerCount === 1 ? t('Which day works best?') : t('Which two days work best?')}
          </Text>
          <DayChips
            colors={colors}
            selected={draft.fewerDays}
            disabledWhenFull={draft.fewerDays.length >= draft.fewerCount && draft.fewerCount > 1}
            onToggle={toggleFewer}
          />
          <Text style={{ marginTop: 11, fontSize: 12, lineHeight: 17, color: `${colors.fg}66` }}>
            {draft.fewerDays.length ? t('Selected: {days}', { days: draft.fewerDays.join(' & ') }) : t(draft.fewerCount > 1 ? 'Choose the days you can train.' : 'Choose the day you can train.')}
          </Text>
        </>
      )}

      {mode === 'moving' && (
        <View style={{ marginTop: 22, gap: 10 }}>
          {MOVING_OPTIONS.map((o) => {
            const on = draft.movingType === o.id
            return (
              <PressableScale key={o.id} onPress={() => patch({ movingType: o.id })} scaleTo={0.985}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 16,
                    backgroundColor: on ? `${colors.brand400}1f` : colors.ink800,
                    borderWidth: 1, borderColor: on ? `${colors.brand400}99` : `${colors.fg}0f`,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.fg }}>{t(o.title)}</Text>
                    <Text style={{ marginTop: 2, fontSize: 13, color: `${colors.fg}80` }}>{t(o.sub)}</Text>
                  </View>
                  <Radio on={on} color={colors.brand400} colors={colors} />
                </View>
              </PressableScale>
            )
          })}
        </View>
      )}
    </>
  )
}

function DayChips({ colors, selected, disabledWhenFull, onToggle }: {
  colors: ThemeColors
  selected: string[]
  disabledWhenFull: boolean
  onToggle: (day: string) => void
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {WEEKDAY_KEYS.map((day) => {
        const on = selected.includes(day)
        const off = !on && disabledWhenFull
        return (
          <Pressable
            key={day}
            onPress={() => !off && onToggle(day)}
            disabled={off}
            style={{
              flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
              opacity: off ? 0.3 : 1,
              backgroundColor: on ? `${colors.brand400}26` : colors.ink700,
              borderWidth: 1, borderColor: on ? `${colors.brand400}99` : `${colors.fg}0f`,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: on ? colors.brand300 : `${colors.fg}cc` }}>{day}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/* =============================== review =============================== */

function ReviewScreen({ colors, draft, onEditDates, onEditMode }: {
  colors: ThemeColors
  draft: Draft
  onEditDates: () => void
  onEditMode: () => void
}) {
  const t = useT()
  const meta = modeMeta(draft.mode)
  const days = periodLength(draft.start, draft.end)
  const returnLabel = fmtPeriodDate(nextDayKey(draft.end))
  const note = (draft.note ?? '').trim()
  const divider = <View style={{ height: 1, backgroundColor: `${colors.fg}0f` }} />

  return (
    <>
      <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', letterSpacing: -0.48, color: colors.fg }}>{t("Here's the plan")}</Text>
      <Text style={{ marginTop: 7, fontSize: 14, lineHeight: 21, color: `${colors.fg}99` }}>
        {t("Nothing changes until you confirm. Here's exactly what we'll do.")}
      </Text>

      <View style={{ marginTop: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.ink800, borderWidth: 1, borderColor: `${colors.fg}0f` }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingVertical: 15, paddingHorizontal: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: `${colors.fg}73` }}>{t('Busy period')}</Text>
            <Text style={{ marginTop: 3, fontSize: 15, fontWeight: '700', color: colors.fg }}>{periodRangeText(draft.start, draft.end)}</Text>
            <Text style={{ marginTop: 2, fontSize: 12.5, color: `${colors.fg}80` }}>{t('{n} days', { n: days })}</Text>
          </View>
          <Pressable onPress={onEditDates} hitSlop={8}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand400 }}>{t('Edit')}</Text></Pressable>
        </View>
        {divider}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, paddingVertical: 15, paddingHorizontal: 16 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `${accentFor(meta?.accent ?? 'fg', colors)}26` }}>
              <ModeIcon meta={meta} size={20} colors={colors} />
            </View>
            <View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: `${colors.fg}73` }}>{t('Mode')}</Text>
              <Text style={{ marginTop: 3, fontSize: 15, fontWeight: '700', color: colors.fg }}>{meta?.title}</Text>
            </View>
          </View>
          <Pressable onPress={onEditMode} hitSlop={8}><Text style={{ fontSize: 13, fontWeight: '700', color: colors.brand400 }}>{t('Edit')}</Text></Pressable>
        </View>
        {divider}
        <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
          <Text style={{ marginBottom: 9, fontSize: 12, fontWeight: '600', color: `${colors.fg}73` }}>{t('What happens to your training')}</Text>
          <View style={{ gap: 8 }}>
            {whatHappens(draft).map((w) => (
              <View key={w} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9 }}>
                <View style={{ marginTop: 2 }}><Check size={13} strokeWidth={3.2} color={colors.brand400} /></View>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: `${colors.fg}d9` }}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
        {divider}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 15, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 13, color: `${colors.fg}99` }}>{t('Normal training returns')}</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.brand300 }}>{returnLabel}</Text>
        </View>
        {!!note && (
          <>
            {divider}
            <View style={{ paddingVertical: 15, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: `${colors.fg}73` }}>{t('Note')}</Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: colors.fg }}>{note}</Text>
            </View>
          </>
        )}
      </View>

      <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 15, backgroundColor: `${colors.accentPurple}1a` }}>
        <GraduationCap size={22} color={colors.accentPurple} strokeWidth={1.9} />
        <Text style={{ flex: 1, fontSize: 13, lineHeight: 19.5, color: `${colors.fg}b8` }}>
          {t("We'll switch you back to your normal program automatically on {date}. Sessions you miss during this time won't count against you.", { date: returnLabel })}
        </Text>
      </View>
    </>
  )
}

/* ============================ detail sheet ============================ */

function DetailRow({ colors, label, value, tint }: { colors: ThemeColors; label: string; value: string; tint?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 13 }}>
      <Text style={{ fontSize: 13, color: `${colors.fg}8c` }}>{label}</Text>
      <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: tint ?? colors.fg }}>{value}</Text>
    </View>
  )
}

function PeriodDetailSheet({ open, period, isActive, colors, onClose, onEdit, onCancel, onEndEarly }: {
  open: boolean
  period: PlannedPeriod | null
  isActive: boolean
  colors: ThemeColors
  onClose: () => void
  onEdit: (p: PlannedPeriod) => void
  onCancel: (p: PlannedPeriod) => void
  onEndEarly: (p: PlannedPeriod) => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(420)
  const progress = useRef(new Animated.Value(0)).current

  // Cancelling a period removes it from the store, so `period` goes null while
  // the sheet is still sliding out. Hold the last one so the exit animation has
  // something to draw instead of vanishing mid-slide.
  const shown = useRef(period)
  if (period) shown.current = period

  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: USE_NATIVE }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: 300, easing: EASE, useNativeDriver: USE_NATIVE }).start(({ finished }) => {
        if (finished) setRender(false)
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const shownPeriod = shown.current
  if (!shownPeriod) return null
  const meta = modeMeta(shownPeriod.mode)
  const col = accentFor(meta?.accent ?? 'fg', colors)
  const divider = <View style={{ height: 1, backgroundColor: `${colors.fg}12` }} />

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={{
            backgroundColor: colors.ink800, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30 + insets.bottom,
            shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 50, shadowOffset: { width: 0, height: -20 }, elevation: 24,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }],
          }}
        >
          <View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${col}26` }}>
              <ModeIcon meta={meta} size={22} colors={colors} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 20, fontWeight: '800', color: colors.fg }}>{periodTitle(shownPeriod)}</Text>
              <Text style={{ marginTop: 2, fontSize: 13, color: `${colors.fg}8c` }}>{periodRangeText(shownPeriod.start, shownPeriod.end)}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close" style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink700 }}>
              <X size={18} color={`${colors.fg}99`} />
            </Pressable>
          </View>

          <View style={{ marginTop: 18, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 2, backgroundColor: colors.ink700 }}>
            <DetailRow colors={colors} label={t('Mode')} value={meta?.title ?? '—'} />
            {divider}
            <DetailRow colors={colors} label={t('What happens')} value={meta?.effect ?? '—'} />
            {divider}
            <DetailRow colors={colors} label={t('Status')} value={isActive ? t('Active now') : t('Starts {label}', { label: daysLabel(daysUntil(shownPeriod.start)) })} />
            {divider}
            <DetailRow colors={colors} label={t('Training returns')} value={fmtPeriodDate(nextDayKey(shownPeriod.end))} tint={colors.brand300} />
          </View>

          {isActive ? (
            <Pressable
              onPress={() => onEndEarly(shownPeriod)}
              style={{ marginTop: 16, alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: `${colors.danger}73` }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.danger }}>{t('End Plan Around Your Life early')}</Text>
            </Pressable>
          ) : (
            <>
              <PressableScale onPress={() => onEdit(shownPeriod)} scaleTo={0.98}>
                <View style={{ marginTop: 16, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: colors.brand400 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#0a0a0b' }}>{t('Edit period')}</Text>
                </View>
              </PressableScale>
              <Pressable onPress={() => onCancel(shownPeriod)} style={{ marginTop: 12, alignItems: 'center', paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>{t('Cancel this period')}</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </AppModal>
  )
}

/* =========================== dialog + toast =========================== */

function ConfirmDialog({ dialog, colors, onDismiss }: { dialog: Dialog | null; colors: ThemeColors; onDismiss: () => void }) {
  const scale = useRef(new Animated.Value(0.93)).current
  useEffect(() => {
    if (!dialog) return
    scale.setValue(0.93)
    Animated.timing(scale, { toValue: 1, duration: 260, easing: EASE, useNativeDriver: USE_NATIVE }).start()
  }, [dialog, scale])

  return (
    <AppModal visible={!!dialog} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable accessibilityLabel="Dismiss" onPress={onDismiss} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {!!dialog && (
          <Animated.View style={{ width: '100%', borderRadius: 22, padding: 22, backgroundColor: colors.ink700, transform: [{ scale }], shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 60, shadowOffset: { width: 0, height: 20 }, elevation: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.fg }}>{dialog.title}</Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 21, color: `${colors.fg}a6` }}>{dialog.body}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Pressable onPress={onDismiss} style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 13, backgroundColor: colors.ink500 }}>
                <Text style={{ fontWeight: '700', color: colors.fg }}>{dialog.cancelLabel}</Text>
              </Pressable>
              <Pressable onPress={dialog.onConfirm} style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 13, backgroundColor: dialog.danger ? colors.danger : colors.brand400 }}>
                <Text style={{ fontWeight: '800', color: '#0a0a0b' }}>{dialog.confirmLabel}</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </AppModal>
  )
}

function Toast({ msg, colors, bottom }: { msg: string; colors: ThemeColors; bottom: number }) {
  const p = useRef(new Animated.Value(0)).current
  useEffect(() => {
    p.setValue(0)
    Animated.timing(p, { toValue: 1, duration: 300, easing: EASE, useNativeDriver: USE_NATIVE }).start()
  }, [msg, p])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', left: 20, right: 20, bottom, alignItems: 'center',
        opacity: p,
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      <View style={{ borderRadius: 14, paddingVertical: 11, paddingHorizontal: 18, backgroundColor: colors.ink600, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.fg }}>{msg}</Text>
      </View>
    </Animated.View>
  )
}
