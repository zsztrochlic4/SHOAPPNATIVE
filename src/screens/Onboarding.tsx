import type { ReactNode } from 'react'
import { useState } from 'react'
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react-native'
import { useDispatch } from '../store/store'
import { LogoMark, Wordmark } from '../components/Logo'
import type { Equipment, Experience, Goal, Profile } from '../store/types'
import { todayKey } from '../lib/date'

type Sex = 'male' | 'female' | 'other'

const goals: { id: Goal; label: string; desc: string }[] = [
  { id: 'build-muscle', label: 'Build muscle', desc: 'Add size and strength' },
  { id: 'lose-fat', label: 'Lose fat', desc: 'Lean down, keep strength' },
  { id: 'gain-strength', label: 'Get stronger', desc: 'Focus on the big lifts' },
  { id: 'stay-healthy', label: 'Stay healthy', desc: 'Move, feel good, balance' },
]

const experiences: { id: Experience; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: 'New to training (0-1 yr)' },
  { id: 'intermediate', label: 'Intermediate', desc: 'Consistent (1-3 yrs)' },
  { id: 'advanced', label: 'Advanced', desc: 'Experienced (3+ yrs)' },
]

const equipments: { id: Equipment; label: string; desc: string }[] = [
  { id: 'full-gym', label: 'Full Gym', desc: 'Campus or commercial gym' },
  { id: 'home-basic', label: 'Home Basics', desc: 'Dumbbells & bands' },
  { id: 'dorm-bodyweight', label: 'Dorm / Bodyweight', desc: 'No equipment needed' },
]

const DIET_OPTIONS = ['No restrictions', 'Vegetarian', 'Vegan', 'Halal', 'Dairy-free', 'Gluten-free', 'High-protein']

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
  const [sex, setSex] = useState<Sex | ''>('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [goalWeightKg, setGoalWeightKg] = useState('')
  const [goal, setGoal] = useState<Goal>('build-muscle')
  const [exp, setExp] = useState<Experience>('beginner')
  const [days, setDays] = useState(4)
  const [sessionMin, setSessionMin] = useState(60)
  const [equipment, setEquipment] = useState<Equipment>('full-gym')
  const [injuries, setInjuries] = useState('')
  const [diet, setDiet] = useState<string[]>([])
  const [budget, setBudget] = useState(false)
  const [motivation, setMotivation] = useState('')

  const steps = ['Welcome', 'About you', 'Your body', 'Your goal', 'Experience', 'Schedule', 'Equipment', 'Limitations', 'Food', 'Motivation']
  const total = steps.length
  const canNext = step === 1 ? name.trim().length > 0 : true

  function toggleDiet(d: string) {
    setDiet((cur) => {
      if (d === 'No restrictions') return cur.includes(d) ? [] : ['No restrictions']
      const next = cur.filter((x) => x !== 'No restrictions')
      return next.includes(d) ? next.filter((x) => x !== d) : [...next, d]
    })
  }

  function finish() {
    const profile: Partial<Profile> = {
      name: name.trim() || 'Athlete',
      age: parseInt(age) || 20,
      goal,
      experience: exp,
      daysPerWeek: days,
      sessionMinutes: sessionMin,
      equipment,
      newToGym: exp === 'beginner',
      createdAtKey: todayKey,
      injuries: injuries.trim(),
      dietaryPrefs: diet.map((d) => d.toLowerCase()),
      budgetMode: budget,
      motivation: motivation.trim(),
      ...targetsFor(goal),
    }
    if (sex) profile.sex = sex
    const h = parseInt(heightCm); if (h) profile.heightCm = h
    const cw = parseFloat(weightKg); if (cw) profile.startWeightKg = Math.round(cw * 10) / 10
    const gw = parseFloat(goalWeightKg); if (gw) profile.goalWeightKg = Math.round(gw * 10) / 10
    dispatch({ type: 'COMPLETE_ONBOARDING', profile })
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
          <View key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand-400' : 'bg-white/10'}`} />
        ))}
      </View>

      <View className="flex-1">
        {step === 0 && (
          <View className="flex-1 items-center justify-center">
            <LogoMark size={84} />
            <Text className="mt-7 text-[13px] font-bold uppercase tracking-[0.18em] text-white/40">Welcome to</Text>
            <View className="mt-2.5"><Wordmark size="lg" /></View>
            <Text className="mt-4 max-w-[280px] text-center text-[15px] text-white/55">
              A few quick questions and your coach will build training and nutrition around you, not a generic template.
            </Text>
          </View>
        )}

        {step === 1 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">First, the basics</Text>
            <Text className="mt-1 text-[14px] text-white/50">We'll personalise everything around you.</Text>
            <Text className="mt-6 text-sm font-semibold text-white/70">What should we call you?</Text>
            <TextInput
              autoFocus value={name} onChangeText={setName} placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-2 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
            />
            <Text className="mt-5 text-sm font-semibold text-white/70">Age</Text>
            <TextInput
              value={age} onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 2))} keyboardType="numeric"
              placeholder="21" placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-2 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
            />
            <Text className="mt-5 text-sm font-semibold text-white/70">Sex <Text className="text-white/35">(for accurate calorie targets)</Text></Text>
            <View className="mt-2 flex-row gap-2">
              {(['male', 'female', 'other'] as Sex[]).map((s) => (
                <Pressable
                  key={s} onPress={() => setSex(s)}
                  className={`flex-1 items-center rounded-xl border py-3 active:opacity-90 ${sex === s ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
                >
                  <Text className={`text-sm font-bold capitalize ${sex === s ? 'text-brand-400' : 'text-white/50'}`}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">Your body</Text>
            <Text className="mt-1 text-[14px] text-white/50">Helps set calories and track progress. You can skip any of these.</Text>
            <NumField label="Height (cm)" value={heightCm} onChangeText={setHeightCm} placeholder="178" />
            <NumField label="Current weight (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="75" decimal />
            <NumField label="Goal weight (kg)" value={goalWeightKg} onChangeText={setGoalWeightKg} placeholder="80" decimal />
          </View>
        )}

        {step === 3 && (
          <Picker title="What's your main goal?" sub="You can change this anytime.">
            {goals.map((g) => (
              <OptionCard key={g.id} selected={goal === g.id} onPress={() => setGoal(g.id)} title={g.label} desc={g.desc} />
            ))}
          </Picker>
        )}

        {step === 4 && (
          <Picker title="How experienced are you?" sub="So we set the right starting weights.">
            {experiences.map((e) => (
              <OptionCard key={e.id} selected={exp === e.id} onPress={() => setExp(e.id)} title={e.label} desc={e.desc} />
            ))}
          </Picker>
        )}

        {step === 5 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">Your schedule</Text>
            <Text className="mt-1 text-[14px] text-white/50">Around lectures and life. Be realistic.</Text>

            <Text className="mt-7 text-sm font-semibold text-white/70">Days per week</Text>
            <View className="mt-2 flex-row justify-between gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <PillButton key={n} active={n === days} onPress={() => setDays(n)} label={String(n)} />
              ))}
            </View>

            <Text className="mt-6 text-sm font-semibold text-white/70">Time per session</Text>
            <View className="mt-2 flex-row justify-between gap-2">
              {[30, 45, 60, 75].map((m) => (
                <PillButton key={m} active={m === sessionMin} onPress={() => setSessionMin(m)} label={`${m}m`} />
              ))}
            </View>
          </View>
        )}

        {step === 6 && (
          <Picker title="What can you train with?" sub="We'll match every exercise to your setup.">
            {equipments.map((e) => (
              <OptionCard key={e.id} selected={equipment === e.id} onPress={() => setEquipment(e.id)} title={e.label} desc={e.desc} />
            ))}
          </Picker>
        )}

        {step === 7 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">Anything to work around?</Text>
            <Text className="mt-1 text-[14px] text-white/50">Injuries, pain, or movements to avoid. Your plan will steer clear.</Text>
            <View className="mt-4 flex-row flex-wrap gap-2">
              {['None', 'Lower back', 'Knees', 'Shoulders', 'Wrists'].map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setInjuries(q === 'None' ? '' : (injuries ? `${injuries}, ${q}` : q))}
                  className="rounded-full border border-white/10 bg-ink-800 px-3.5 py-2 active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-white/70">{q}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={injuries} onChangeText={setInjuries} multiline
              placeholder="e.g. left knee pain, avoid overhead pressing"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-3 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
              style={{ minHeight: 90, textAlignVertical: 'top' }}
            />
          </View>
        )}

        {step === 8 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">How do you eat?</Text>
            <Text className="mt-1 text-[14px] text-white/50">So nutrition advice fits your plate. Pick any that apply.</Text>
            <View className="mt-5 flex-row flex-wrap gap-2">
              {DIET_OPTIONS.map((d) => {
                const on = diet.includes(d)
                return (
                  <Pressable
                    key={d} onPress={() => toggleDiet(d)}
                    className={`rounded-full border px-4 py-2.5 active:opacity-90 ${on ? 'border-brand-400 bg-brand-400/10' : 'border-white/10 bg-ink-800'}`}
                  >
                    <Text className={`text-[13px] font-semibold ${on ? 'text-brand-400' : 'text-white/60'}`}>{d}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Pressable
              onPress={() => setBudget((b) => !b)}
              className={`mt-5 w-full flex-row items-center justify-between rounded-2xl border p-4 active:opacity-90 ${budget ? 'border-brand-400/50 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
            >
              <View className="flex-1">
                <Text className="font-bold text-white">On a tight budget?</Text>
                <Text className="text-[13px] text-white/50">We'll favour cheap, high-protein meals.</Text>
              </View>
              <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${budget ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>
                {budget && <Check size={14} strokeWidth={3} color="#000" />}
              </View>
            </Pressable>
          </View>
        )}

        {step === 9 && (
          <View>
            <Text className="text-2xl font-extrabold text-white">What's driving you?</Text>
            <Text className="mt-1 text-[14px] text-white/50">Optional, but it helps your coach keep you motivated when it's hard.</Text>
            <TextInput
              value={motivation} onChangeText={setMotivation} multiline
              placeholder="e.g. feel confident for summer, keep up with mates, build a habit that sticks"
              placeholderTextColor="rgba(255,255,255,0.35)"
              className="mt-5 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
          </View>
        )}
      </View>

      {/* nav buttons */}
      <View className="mt-6 flex-row items-center gap-3">
        {step > 0 && (
          <Pressable onPress={() => setStep((s) => s - 1)} className="h-12 w-12 items-center justify-center rounded-full bg-ink-700 active:opacity-80">
            <ChevronLeft size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
        )}
        {step < total - 1 ? (
          <Pressable
            disabled={!canNext} onPress={() => setStep((s) => s + 1)}
            className={`btn-primary flex-1 flex-row items-center justify-center active:opacity-90 ${canNext ? '' : 'opacity-40'}`}
          >
            <Text className="font-semibold text-black">Continue </Text>
            <ChevronRight size={18} color="#000" />
          </Pressable>
        ) : (
          <Pressable onPress={finish} className="btn-primary flex-1 flex-row items-center justify-center active:opacity-90">
            <Text className="font-semibold text-black">Build my plan </Text>
            <Check size={18} color="#000" />
          </Pressable>
        )}
      </View>
    </ScrollView>
  )
}

function NumField({ label, value, onChangeText, placeholder, decimal }: { label: string; value: string; onChangeText: (t: string) => void; placeholder: string; decimal?: boolean }) {
  return (
    <View className="mt-5">
      <Text className="text-sm font-semibold text-white/70">{label}</Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChangeText(t.replace(decimal ? /[^\d.]/g : /\D/g, '').slice(0, decimal ? 6 : 3))}
        keyboardType={decimal ? 'decimal-pad' : 'numeric'}
        placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.35)"
        className="mt-2 w-full rounded-xl border border-white/8 bg-ink-800 px-4 py-3.5 text-white"
      />
    </View>
  )
}

function PillButton({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-12 flex-1 items-center justify-center rounded-xl border active:opacity-80 ${active ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
    >
      <Text className={`text-base font-bold ${active ? 'text-brand-400' : 'text-white/40'}`}>{label}</Text>
    </Pressable>
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
      className={`w-full flex-row items-center justify-between rounded-2xl border p-4 active:opacity-90 ${selected ? 'border-brand-400 bg-brand-400/10' : 'border-white/8 bg-ink-800'}`}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-bold text-white">{title}</Text>
        <Text className="text-[13px] text-white/50">{desc}</Text>
      </View>
      <View className={`h-6 w-6 items-center justify-center rounded-full border-2 ${selected ? 'border-brand-400 bg-brand-400' : 'border-white/25'}`}>
        {selected && <Check size={14} strokeWidth={3} color="#000" />}
      </View>
    </Pressable>
  )
}
