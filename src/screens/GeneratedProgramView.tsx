import { useState } from 'react'
import { View, Text, Pressable, Linking } from 'react-native'
import { ShieldCheck, HeartPulse, Info, Clock3, ChevronDown, Mail, Zap } from 'lucide-react-native'
import { Chip } from '../components/ui'
import { useNav } from '../nav'
import { useT } from '../lib/useT'
import { brand } from '../theme'
import type { StoredProgram, ProgramStatus } from '../backend/runtime/activate'

/* ---------------------------------------------------------------- */
/*  Holding screen — shown whenever the generation gate is closed.   */
/* ---------------------------------------------------------------- */

type Tone = 'brand' | 'warn' | 'danger'

const SUPPORT_EMAIL = 'info@strengthhubonline.com'

function holdingCopy(reason: string | null): { title: string; body: string; tone: Tone; support?: boolean; quick?: boolean } {
  const r = reason ?? ''
  if (r === 'awaiting_professional_signoff' || r.startsWith('signoff'))
    return {
      tone: 'brand',
      title: 'Your program is being finalised',
      body: 'We’re completing the final safety checks before your personalised program goes live. Your profile is saved — we’ll let you know the moment it’s ready. In the meantime, Quick Workouts below are ready to go.',
      // While the personalised promise is held, the safe general product —
      // time-based quick circuits that need no per-user prescription — keeps
      // the user training (audit F-007: never a paying dead end).
      quick: true,
      support: true,
    }
  if (r === 'screening_do_not_generate')
    return {
      tone: 'danger',
      title: 'Please seek medical advice first',
      body: 'Based on your answers, we can’t build a program right now. Please speak with a doctor or qualified health professional before training. Your answers are saved so you can return once you’ve been cleared.',
      support: true,
    }
  if (r === 'screening_require_clearance')
    return {
      tone: 'warn',
      title: 'One quick clearance step',
      body: 'One of your answers means we’d like a health professional to give you the go-ahead before we build your program. Once you’ve been cleared, contact us and we’ll unlock it.',
      support: true,
    }
  if (r === 'age_under_18')
    return {
      tone: 'warn',
      title: 'For ages 18 and over',
      body: 'StrengthHub creates personalised training programs for people aged 18 and over.',
    }
  if (r === 'age_unverified')
    return {
      tone: 'warn',
      title: 'Add your date of birth',
      body: 'We need your date of birth to build your program safely.',
    }
  if (r === 'waiver_not_accepted')
    return {
      tone: 'warn',
      title: 'Accept the terms to continue',
      body: 'Please accept the terms and the fitness-not-medical-advice acknowledgement, and we’ll build your program.',
    }
  return {
    tone: 'warn',
    title: 'We hit a snag',
    body: 'We couldn’t build your program just now. Please try again in a moment.',
    support: true,
  }
}

const TONE_STYLE: Record<Tone, { ring: string; bg: string; color: string }> = {
  brand: { ring: 'border-brand-400/25', bg: 'bg-brand-400/10', color: brand[400] },
  warn: { ring: 'border-amber-400/25', bg: 'bg-amber-400/10', color: '#fbbf24' },
  danger: { ring: 'border-red-400/25', bg: 'bg-red-400/10', color: '#f87171' },
}

export function ProgramHolding({ status }: { status: ProgramStatus }) {
  const nav = useNav()
  const t = useT()
  const { title, body, tone, support, quick } = holdingCopy(status.reason)
  const st = TONE_STYLE[tone]
  const IconCmp = tone === 'brand' ? ShieldCheck : tone === 'danger' ? HeartPulse : Info
  return (
    <View className={`items-center rounded-3xl border ${st.ring} ${st.bg} px-6 py-10`}>
      <View className={`h-16 w-16 items-center justify-center rounded-2xl ${st.bg}`}>
        <IconCmp size={30} color={st.color} />
      </View>
      <Text className="mt-5 text-center text-xl font-extrabold text-white">{title}</Text>
      <Text className="mt-2.5 max-w-[320px] text-center text-[14px] leading-6 text-secondary">{body}</Text>
      {quick && (
        <Pressable
          onPress={() => nav.open('quick')}
          accessibilityRole="button"
          accessibilityLabel="Start a quick workout"
          className="btn-primary mt-6 flex-row items-center gap-2 px-5 py-3 active:opacity-90"
        >
          <Zap size={15} color="#000" />
          <Text className="text-[13.5px] font-bold text-black">{t('Start a quick workout')}</Text>
        </Pressable>
      )}
      {support && (
        // A blocked/held user shouldn't be at a dead end — give them a way to reach
        // a human. (Re-screening after clearance stays a manual, human-in-the-loop
        // step by design, so it never bypasses the safety gate.)
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          accessibilityRole="link"
          accessibilityLabel={`Email support at ${SUPPORT_EMAIL}`}
          className="mt-6 flex-row items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 py-2.5 active:opacity-80"
        >
          <Mail size={14} color="rgba(255,255,255,0.7)" />
          <Text className="text-[13px] font-semibold text-white/80">{t('Contact us')}</Text>
        </Pressable>
      )}
    </View>
  )
}

/* ---------------------------------------------------------------- */
/*  Generated program — the recommended plan (read-only in Phase 1). */
/* ---------------------------------------------------------------- */

function repRange(e: StoredProgram['days'][number]['exercises'][number]): string {
  if (e.repsMin != null && e.repsMax != null) return `${e.repsMin}–${e.repsMax} reps`
  if (e.durationSecMax != null) return `${e.durationSecMax}s`
  return '—'
}

export function GeneratedProgramView({ program }: { program: StoredProgram }) {
  // Defensive: the program can arrive partially hydrated (a seeded/legacy doc, or a mid-sync state),
  // so never assume the computed arrays/maps are present — degrade gracefully instead of crashing the
  // whole screen behind the error boundary.
  const days = Array.isArray(program?.days) ? program.days : []
  const training = days.length
  // Accordion: one day open at a time (first by default), matching the design.
  const [openDay, setOpenDay] = useState<string | null>(days[0]?.weekday ?? null)
  const tr = useT()
  return (
    <View className="gap-2.5">
      <View className="rounded-[20px] border border-brand-400/20 bg-brand-400/[0.06] p-4">
        <Text className="text-[14px] font-bold text-white">{program.splitName} · {tr('{n}-day program', { n: training })}</Text>
        <Text className="mt-1.5 text-[12.5px] leading-5 text-secondary">{program.recommendationNote}</Text>
      </View>

      {days.map((d) => {
        const open = openDay === d.weekday
        const exercises = Array.isArray(d.exercises) ? d.exercises : []
        return (
          <View key={d.weekday} className="overflow-hidden rounded-[20px] border border-white/5 bg-ink-800">
            <Pressable onPress={() => setOpenDay(open ? null : d.weekday)} className="flex-row items-center gap-3 p-4 active:opacity-90">
              <View className="w-[34px] shrink-0"><Text className="text-[11px] font-bold uppercase tracking-wider text-tertiary">{d.weekday.slice(0, 3)}</Text></View>
              <View className="min-w-0 flex-1">
                <Text className="text-[14.5px] font-bold text-white">{d.dayType}</Text>
                <Text numberOfLines={1} className="mt-0.5 text-[12px] text-secondary">{exercises.map((e) => e.muscleGroup).filter((m, i, a) => a.indexOf(m) === i).slice(0, 3).join(' · ')}</Text>
              </View>
              <Chip color="green">{tr('{n} ex', { n: exercises.length })}</Chip>
              <ChevronDown size={17} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </Pressable>
            {open && (
              <View className="px-4 pb-4">
                <View className="mb-1 h-px bg-white/5" />
                <View className="mt-2 gap-2.5">
                  {exercises.map((e, i) => (
                    <View key={`${e.exerciseId}-${i}`} className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-[13.5px] font-semibold text-white">{e.name}</Text>
                        <Text className="mt-px text-[11.5px] text-secondary">{e.muscleGroup}</Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-[13px] font-semibold text-white/85">{e.sets} × {repRange(e)}</Text>
                        <View className="mt-0.5 flex-row items-center gap-1">
                          <Text className="text-[12px] text-secondary">RIR {e.rirMin}</Text>
                          {e.injuryAdjusted && (
                            <View className="rounded-md bg-amber-400/15 px-1.5 py-0.5">
                              <Text className="text-[10px] font-semibold text-amber-300">{tr('injury-adjusted')}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )
      })}

      {/* Weekly volume — chips of sets logged vs target per muscle. */}
      <View className="rounded-[20px] border border-white/5 bg-ink-800 p-4">
        <Text className="mb-2.5 text-[13px] font-bold text-white">{tr('Weekly sets by muscle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(program.weeklySetsByMuscle ?? {}).map(([m, n]) => {
            const t = program.volumeTargets?.[m]
            return (
              <View key={m} className="flex-row items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1.5">
                <Text className="text-[12px] text-secondary">{m}</Text>
                <Text className="text-[12px] font-bold text-white/90">{n}</Text>
                {t ? <Text className="text-[11px] text-tertiary">({t.min}–{t.max})</Text> : null}
              </View>
            )
          })}
        </View>
      </View>

      {(program.coverageNotes?.length ?? 0) > 0 && (
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          {(program.coverageNotes ?? []).map((c, i) => (
            <Text key={i} className="text-[12px] leading-5 text-secondary">{c}</Text>
          ))}
        </View>
      )}

      {/* Set-by-set logging is now wired: today's session on the Today tab logs against this
       *  program and feeds the progression engine. */}
      <View className="flex-row items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <Clock3 size={15} color="rgba(255,255,255,0.4)" />
        <Text className="flex-1 text-[12px] leading-5 text-secondary">
          {program.startingLoadNote}{' '}
          {tr('Head to the Today tab to log each session set by set — your weights adapt automatically as you progress.')}
        </Text>
      </View>
    </View>
  )
}
