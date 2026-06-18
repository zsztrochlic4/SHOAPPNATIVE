import type { ReactNode } from 'react'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react-native'
import { useDispatch } from '../store/store'
import { LogoMark, Wordmark } from '../components/Logo'
import type { Equipment, Experience, Goal } from '../store/types'
import { todayKey } from '../lib/date'

const goals: { id: Goal; label: string; desc: string }[] = [
  { id: 'build-muscle', label: 'Build muscle', desc: 'Add size and strength' },
  { id: 'lose-fat', label: 'Lose fat', desc: 'Lean down, keep strength' },
  { id: 'gain-strength', label: 'Get stronger', desc: 'Focus on the big lifts' },
  { id: 'stay-healthy', label: 'Stay healthy', desc: 'Move, feel good, balance' },
]

const experiences: { id: Experience; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: 'New to training (0–1 yr)' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Consistent (1–3 yrs)' },
  { id: 'advanced', label: 'Advanced', desc: 'Experienced (3+ yrs)' },
]

const equipments: { id: Equipment; label: string; desc: string }[] = [
  { id: 'full-gym', label: 'Full Gym', desc: 'Campus or commercial gym' },
  { id: 'home-basic', label: 'Home Basics', desc: 'Dumbbells & bands' },
  { id: 'dorm-bodyweight', label: 'Dorm / Bodyweight', desc: 'No equipment needed' },
]

const targetsFor = (goal: Goal) => {
  switch (goal) {
    case 'build-muscle':
      return { calorieTarget: 2600, proteinTarget: 170, carbTarget: 300, fatTarget: 75 }
    case 'lose-fat':
      return { calorieTarget: 1900, proteinTarget: 165, carbTarget: 180, fatTarget: 60 }
    case 'gain-strength':
      return { calorieTarget: 2500, proteinTarget: 160, carbTarget: 280, fatTarget: 80 }
    default:
      return { calorieTarget: 2200, proteinTarget: 140, carbTarget: 240, fatTarget: 70 }
  }
}

export default function Onboarding() {
  const dispatch = useDispatch()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [goal, setGoal] = useState<Goal>('build-muscle')
  const [exp, setExp] = useState<Experience>('beginner')
  const [days, setDays] = useState(4)
  const [equipment, setEquipment] = useState<Equipment>('full-gym')

  const steps = ['Welcome', 'About you', 'Your goal', 'Experience', 'Schedule', 'Equipment']
  const total = steps.length
  const canNext = step === 1 ? name.trim().length > 0 : true

  function finish() {
    dispatch({
      type: 'COMPLETE_ONBOARDING',
      profile: {
        name: name.trim() || 'Athlete',
        age: parseInt(age) || 20,
        goal,
        experience: exp,
        daysPerWeek: days,
        equipment,
        newToGym: exp === 'beginner',
        createdAtKey: todayKey,
        ...targetsFor(goal),
      },
    })
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* progress dots */}
      <View className="mb-8 flex-row items-center gap-1.5">
        {steps.map((_, i) => (
          <View
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-400' : 'bg-white/10'}`}
          />
        ))}
      </View>

      <View className="flex-1">
        {step === 0 && (
          <View className="flex-1 items-center justify-center">
            <LogoMark size={84} />
            <Text className="mt-7 text-[13px] font-bold uppercase tracking-[0.18em] text-white/40">Welcome to</Text>
            <View className="mt-2.5">
              <Wordmark size="lg" />
            </View>
            <Text className="mt-4 max-w-[280px] text-center text-[15px] text-white/55">
              Built for students. Train smarter, eat better, and stay consistent, even during exam season.
            </Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">First, the basics</Text>
            <Text className="mt-1 text-[14px] text-white/50">We'll personalise everything around you.</Text>
            <Text className="mt-6 text-sm font-semibold text-white/70">What should we call you?</Text>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-2 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
            />
            <Text className="mt-5 text-sm font-semibold text-white/70">Age</Text>
            <TextInput
              value={age}
              onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="numeric"
              placeholder="21"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-2 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
            />
          </View>
        )}

        {step === 2 && (
          <Picker title="What's your main goal?" sub="You can change this anytime.">
            {goals.map((g) => (
              <OptionCard key={g.id} selected={goal === g.id} onPress={() => setGoal(g.id)} title={g.label} desc={g.desc} />
            ))}
          </Picker>
        )}

        {step === 3 && (
          <Picker title="How experienced are you?" sub="So we set the right starting weights.">
            {experiences.map((e) => (
              <OptionCard key={e.id} selected={exp === e.id} onPress={() => setExp(e.id)} title={e.label} desc={e.desc} />
            ))}
          </Picker>
        )}

        {step === 4 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">Days per week?</Text>
            <Text className="mt-1 text-[14px] text-white/50">Around lectures and life. Be realistic.</Text>
            <View className="mt-8 items-center">
              <Text className="text-6xl font-extrabold text-brand-400">{days}</Text>
              <Text className="mt-1 text-sm text-white/50">days / week</Text>
              <View className="mt-6 w-full flex-row justify-between gap-2">
                {[2, 3, 4, 5, 6].map((n) => {
                  const active = n === days
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setDays(n)}
                      className={`h-12 flex-1 items-center justify-center rounded-xl border active:opacity-80 ${
                        active ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'
                      }`}
                    >
                      <Text className={`text-base font-bold ${active ? 'text-brand-400' : 'text-white/40'}`}>{n}</Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>
        )}

        {step === 5 && (
          <Picker title="What can you train with?" sub="We'll swap exercises to match.">
            {equipments.map((e) => (
              <OptionCard key={e.id} selected={equipment === e.id} onPress={() => setEquipment(e.id)} title={e.label} desc={e.desc} />
            ))}
          </Picker>
        )}
      </View>

      {/* nav buttons */}
      <View className="mt-6 flex-row items-center gap-3">
        {step > 0 && (
          <Pressable
            onPress={() => setStep((s) => s - 1)}
            className="h-12 w-12 items-center justify-center rounded-full bg-ink-700 active:opacity-80"
          >
            <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
        {step < total - 1 ? (
          <Pressable
            disabled={!canNext}
            onPress={() => setStep((s) => s + 1)}
            className={`btn-primary flex-1 flex-row items-center justify-center active:opacity-90 ${canNext ? '' : 'opacity-40'}`}
          >
            <Text className="font-semibold text-black">Continue </Text>
            <ChevronRight size={18} color="#000" />
          </Pressable>
        ) : (
          <Pressable
            onPress={finish}
            className="btn-primary flex-1 flex-row items-center justify-center active:opacity-90"
          >
            <Text className="font-semibold text-black">Start training </Text>
            <Check size={18} color="#000" />
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

function Picker({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <View>
      <Text className="text-2xl font-extrabold text-white">{title}</Text>
      <Text className="mt-1 text-[14px] text-white/50">{sub}</Text>
      <View className="mt-6 gap-3">{children}</View>
    </View>
  )
}

function OptionCard({ selected, onPress, title, desc }: { selected: boolean; onPress: () => void; title: string; desc: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={`w-full flex-row items-center justify-between rounded-2xl border p-4 active:opacity-90 ${
        selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'
      }`}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="text-[13px] text-white/50">{desc}</Text>
      </View>
      <View
        className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
          selected ? 'border-brand-400 bg-brand-400' : 'border-white/25'
        }`}
      >
        {selected && <Check size={14} strokeWidth={3} color="#000" />}
      </View>
    </Pressable>
  )
}
