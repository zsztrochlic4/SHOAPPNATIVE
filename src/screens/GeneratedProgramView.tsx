import { View, Text } from 'react-native'
import { ShieldCheck, HeartPulse, Info, Clock3 } from 'lucide-react-native'
import { Chip } from '../components/ui'
import { brand } from '../theme'
import type { StoredProgram, ProgramStatus } from '../backend/runtime/activate'

/* ---------------------------------------------------------------- */
/*  Holding screen — shown whenever the generation gate is closed.   */
/* ---------------------------------------------------------------- */

type Tone = 'brand' | 'warn' | 'danger'

function holdingCopy(reason: string | null): { title: string; body: string; tone: Tone } {
  const r = reason ?? ''
  if (r === 'awaiting_professional_signoff' || r.startsWith('signoff'))
    return {
      tone: 'brand',
      title: 'Your program is being finalised',
      body: 'We’re completing the final safety checks before your personalised program goes live. Your profile is saved — we’ll let you know the moment it’s ready.',
    }
  if (r === 'screening_do_not_generate')
    return {
      tone: 'danger',
      title: 'Please seek medical advice first',
      body: 'Based on your answers, we can’t build a program right now. Please speak with a doctor or qualified health professional before training. Your answers are saved so you can return once you’ve been cleared.',
    }
  if (r === 'screening_require_clearance')
    return {
      tone: 'warn',
      title: 'One quick clearance step',
      body: 'One of your answers means we’d like a health professional to give you the go-ahead before we build your program. Once you’ve been cleared, we’ll unlock it here.',
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
  }
}

const TONE_STYLE: Record<Tone, { ring: string; bg: string; color: string }> = {
  brand: { ring: 'border-brand-400/25', bg: 'bg-brand-400/10', color: brand[400] },
  warn: { ring: 'border-amber-400/25', bg: 'bg-amber-400/10', color: '#fbbf24' },
  danger: { ring: 'border-red-400/25', bg: 'bg-red-400/10', color: '#f87171' },
}

export function ProgramHolding({ status }: { status: ProgramStatus }) {
  const { title, body, tone } = holdingCopy(status.reason)
  const st = TONE_STYLE[tone]
  const IconCmp = tone === 'brand' ? ShieldCheck : tone === 'danger' ? HeartPulse : Info
  return (
    <View className={`items-center rounded-3xl border ${st.ring} ${st.bg} px-6 py-10`}>
      <View className={`h-16 w-16 items-center justify-center rounded-2xl ${st.bg}`}>
        <IconCmp size={30} color={st.color} />
      </View>
      <Text className="mt-5 text-center text-xl font-extrabold text-white">{title}</Text>
      <Text className="mt-2.5 max-w-[320px] text-center text-[14px] leading-6 text-white/60">{body}</Text>
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
  const training = program.days.length
  return (
    <View className="gap-3">
      <View className="rounded-2xl border border-brand-400/20 bg-brand-400/5 p-4">
        <Text className="text-sm font-bold text-white">{program.splitName} · {training}-day recommended program</Text>
        <Text className="mt-1.5 text-[12.5px] leading-5 text-white/55">{program.recommendationNote}</Text>
      </View>

      {program.days.map((d) => (
        <View key={d.weekday} className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-white">{d.weekday} · {d.dayType}</Text>
            <Chip color="green">{d.exercises.length} ex</Chip>
          </View>
          <View className="mt-3 gap-2.5">
            {d.exercises.map((e, i) => (
              <View key={`${e.exerciseId}-${i}`} className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[14px] font-semibold text-white">{e.name}</Text>
                  <Text className="mt-0.5 text-[12px] text-white/45">{e.muscleGroup}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-[13px] font-semibold text-white/85">{e.sets} × {repRange(e)}</Text>
                  <View className="mt-0.5 flex-row items-center gap-1">
                    <Text className="text-[12px] text-white/45">RIR {e.rirMin}</Text>
                    {e.injuryAdjusted && (
                      <View className="rounded-md bg-amber-400/15 px-1.5 py-0.5">
                        <Text className="text-[10px] font-semibold text-amber-300">injury-adjusted</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Weekly volume */}
      <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
        <Text className="mb-2 text-[13px] font-bold text-white">Weekly sets by muscle</Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
          {Object.entries(program.weeklySetsByMuscle).map(([m, n]) => {
            const t = program.volumeTargets[m]
            return (
              <Text key={m} className="text-[12px] text-white/55">
                {m} <Text className="font-semibold text-white/80">{n}</Text>
                {t ? <Text className="text-white/35"> ({t.min}–{t.max})</Text> : null}
              </Text>
            )
          })}
        </View>
      </View>

      {program.coverageNotes.length > 0 && (
        <View className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          {program.coverageNotes.map((c, i) => (
            <Text key={i} className="text-[12px] leading-5 text-white/50">{c}</Text>
          ))}
        </View>
      )}

      {/* Set-by-set logging is now wired: today's session on the Today tab logs against this
       *  program and feeds the progression engine. */}
      <View className="flex-row items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <Clock3 size={15} color="rgba(255,255,255,0.4)" />
        <Text className="flex-1 text-[12px] leading-5 text-white/45">
          {program.startingLoadNote} Head to the Today tab to log each session set by set — your
          weights adapt automatically as you progress.
        </Text>
      </View>
    </View>
  )
}
