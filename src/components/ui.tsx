import type { ReactNode } from 'react'
import { View, Text, Pressable, ScrollView, type ViewProps } from 'react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { Sun } from 'lucide-react-native'
import { useColors, brand } from '../theme'

/* ------------------------------------------------------------------ */
/*  Card — the surface used across every screen                        */
/* ------------------------------------------------------------------ */
export function Card({ className = '', style, children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`card ${className}`}
      style={[
        {
          // Soft elevation roughly matching the web `shadow-card`.
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  ProgressRing — circular progress indicator                         */
/* ------------------------------------------------------------------ */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  color = '#7ED957',
  track,
  children,
}: {
  value: number // 0 - 100
  size?: number
  stroke?: number
  color?: string
  track?: string
  children?: ReactNode
}) {
  const colors = useColors()
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={track ?? colors.ringTrack}
            strokeWidth={stroke}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  ProgressBar — linear progress                                      */
/* ------------------------------------------------------------------ */
export function ProgressBar({
  value,
  color = '#7ED957',
  className = '',
  height = 8,
}: {
  value: number
  color?: string
  className?: string
  height?: number
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <View className={`w-full overflow-hidden rounded-full bg-white/10 ${className}`} style={{ height }}>
      <View style={{ height: '100%', borderRadius: 999, width: `${clamped}%`, backgroundColor: color }} />
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  SectionHeader — title with optional "See all" action               */
/* ------------------------------------------------------------------ */
export function SectionHeader({
  title,
  action,
  onAction,
  right,
}: {
  title: string
  action?: string
  onAction?: () => void
  right?: ReactNode
}) {
  return (
    <View className="mb-3 mt-7 flex-row items-center justify-between">
      <Text className="section-title">{title}</Text>
      {right
        ? right
        : action && (
            <Pressable onPress={onAction} hitSlop={8}>
              <Text className="see-all">{action}</Text>
            </Pressable>
          )}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  SegmentedTabs — the underline tab bar used on every section        */
/* ------------------------------------------------------------------ */
export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[]
  active: string
  onChange: (t: string) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: 24, minWidth: '100%' }}
      className="-mx-5 px-5"
    >
      <View className="flex-row gap-6 border-b border-white/5">
        {tabs.map((t) => {
          const isActive = t === active
          return (
            <Pressable key={t} onPress={() => onChange(t)} className="pb-3">
              {t === 'Coach' ? (
                <Sun size={18} color={isActive ? brand[400] : 'rgba(148,148,148,0.75)'} />
              ) : (
                <Text className={`text-[15px] font-semibold ${isActive ? 'text-brand-400' : 'text-white/45'}`}>{t}</Text>
              )}
              {isActive && <View className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-brand-400" />}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}

/* ------------------------------------------------------------------ */
/*  Chip                                                               */
/* ------------------------------------------------------------------ */
const chipMap: Record<string, string> = {
  green: 'bg-brand-400/15',
  gray: 'bg-white/10',
  blue: 'bg-accent-blue/15',
  orange: 'bg-accent-orange/15',
  purple: 'bg-accent-purple/15',
}
const chipText: Record<string, string> = {
  green: 'text-brand-300',
  gray: 'text-white/70',
  blue: 'text-accent-blue',
  orange: 'text-accent-orange',
  purple: 'text-accent-purple',
}

export function Chip({
  children,
  color = 'green',
  className = '',
}: {
  children: ReactNode
  color?: 'green' | 'gray' | 'blue' | 'orange' | 'purple'
  className?: string
}) {
  return (
    <View className={`chip ${chipMap[color]} ${className}`}>
      <Text className={`text-xs font-medium ${chipText[color]}`}>{children}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  ScreenHeader — large page title with leading/trailing slots        */
/* ------------------------------------------------------------------ */
export function ScreenHeader({
  title,
  leading,
  trailing,
}: {
  title: string
  leading?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <View className="mb-4 flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        {leading}
        <Text className="text-[28px] font-extrabold tracking-tight text-white">{title}</Text>
      </View>
      {trailing}
    </View>
  )
}
