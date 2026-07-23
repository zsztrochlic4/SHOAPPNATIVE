import {
  Dumbbell,
  TrendingUp,
  Scale,
  Footprints,
  BedDouble,
  Droplet,
  Utensils,
  Leaf,
  Clock,
  Flame,
  Target,
  Brain,
  Moon,
  type LucideIcon,
} from 'lucide-react-native'

const map: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  trending: TrendingUp,
  scale: Scale,
  footprints: Footprints,
  bed: BedDouble,
  moon: Moon,
  droplet: Droplet,
  utensils: Utensils,
  leaf: Leaf,
  clock: Clock,
  flame: Flame,
  target: Target,
  brain: Brain,
}

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: string
  size?: number
  className?: string
  color?: string
}) {
  const Cmp = map[name] ?? Dumbbell
  return <Cmp size={size} color={color ?? '#7ED957'} strokeWidth={2.2} />
}
