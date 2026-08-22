import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Animated, Easing, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Info } from 'lucide-react-native'
import { AppModal, IS_WEB, WEB_SCREEN } from './WebFrame'
import { SectionHeader } from './ui'
import { useStore } from '../store/store'
import { bmiInfo, type ProgressColor } from '../lib/metrics'
import { useColors, type Palette } from '../theme'
import { useT } from '../lib/useT'

function progColor(c: ProgressColor, colors: Palette): string {
  switch (c) {
    case 'brand': return colors.brand400
    case 'blue': return colors.accentBlue
    case 'orange': return colors.accentOrange
    case 'danger': return colors.danger
    case 'muted': return `${colors.fg}24`
    case 'fg': return colors.fg
    default: return colors.fg
  }
}

/** The four BMI bands, matching the bar segment widths in the design. */
const BMI_BANDS = ['Under', 'Healthy', 'Over', 'Obese'] as const

/** Which band a BMI falls in (0 Under · 1 Healthy · 2 Over · 3 Obese). */
function bmiBand(bmi: number): number {
  return bmi < 18.5 ? 0 : bmi < 25 ? 1 : bmi < 30 ? 2 : 3
}

/** Needle position as a % across the segmented bar (widths 17.5 / 32.5 / 25 / 25),
 *  interpolated within the active band so it lands where the design places it
 *  (BMI 24.5 → 47.5%). */
function needleBandPct(bmi: number): number {
  if (bmi < 18.5) return Math.max(3, (bmi / 18.5) * 17.5)
  if (bmi < 25) return 17.5 + ((bmi - 18.5) / 6.5) * 32.5
  if (bmi < 30) return 50 + ((bmi - 25) / 5) * 25
  return Math.min(97, 75 + ((bmi - 30) / 5) * 25)
}

/**
 * Body composition (BMI) card — the gauge, needle, legend and "What is BMI?"
 * explainer. Self-contained (owns its info sheet) so it can sit on any screen;
 * it lives at the bottom of the Nutrition → Overview tab. Renders nothing until
 * there's enough profile data for a BMI (`bmiInfo` returns null otherwise).
 */
export function BodyCompositionCard() {
  const { state } = useStore()
  const colors = useColors()
  const t = useT()
  const bmi = bmiInfo(state)
  const [infoOpen, setInfoOpen] = useState(false)

  if (!bmi) return null

  const accent = progColor(bmi.color, colors)
  const band = bmiBand(bmi.bmi)
  const segWidths = [17.5, 32.5, 25, 25]

  return (
    <>
      <SectionHeader title={t('Body composition')} />
      <View className="border border-white/5 bg-ink-800" style={{ borderRadius: 20, padding: 18 }}>
        {/* header */}
        <View className="flex-row items-center justify-between">
          <Text style={{ fontSize: 14, fontWeight: '600', color: `${colors.fg}b3` }}>{t('Your BMI')}</Text>
          <Pressable
            onPress={() => setInfoOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="What is BMI?"
            hitSlop={8}
            className="items-center justify-center rounded-full active:opacity-70"
            style={{ width: 22, height: 22, borderWidth: 1, borderColor: `${colors.fg}40` }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: `${colors.fg}66`, lineHeight: 14 }}>?</Text>
          </Pressable>
        </View>

        {/* value · caption · category chip, all on one baseline */}
        <View className="mt-1.5 flex-row flex-wrap items-baseline" style={{ gap: 12 }}>
          <Text className="text-white" style={{ fontSize: 40, fontWeight: '800', letterSpacing: -1.2, lineHeight: 40 }}>{bmi.bmi.toFixed(1)}</Text>
          <Text style={{ fontSize: 14, color: `${colors.fg}80` }}>{t('Your weight is')}</Text>
          <View style={{ paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, backgroundColor: `${accent}2e` }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: accent }}>{bmi.label}</Text>
          </View>
        </View>

        {/* segmented band bar — only the active band is coloured; needle marks the value */}
        <View className="relative" style={{ marginTop: 16 }}>
          <View className="flex-row" style={{ height: 8, gap: 4 }}>
            {segWidths.map((w, i) => (
              <View key={i} style={{ flex: w, borderRadius: 999, backgroundColor: i === band ? accent : `${colors.fg}1f` }} />
            ))}
          </View>
          {/* needle with an ink-800 halo so it reads over any band */}
          <View style={{ position: 'absolute', top: -5, left: `${needleBandPct(bmi.bmi)}%`, transform: [{ translateX: -3.5 }] }}>
            <View style={{ width: 7, height: 18, borderRadius: 4, backgroundColor: colors.ink800 }} />
            <View style={{ position: 'absolute', top: 2, left: 2, width: 3, height: 14, borderRadius: 2, backgroundColor: colors.needle }} />
          </View>
        </View>

        {/* labels — the active band is highlighted in its category colour */}
        <View className="flex-row justify-between" style={{ marginTop: 12 }}>
          {BMI_BANDS.map((label, i) => (
            <Text key={label} style={{ fontSize: 12, fontWeight: i === band ? '600' : '400', color: i === band ? accent : `${colors.fg}66` }}>{t(label)}</Text>
          ))}
        </View>
      </View>

      <BmiInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} colors={colors} />
    </>
  )
}

/* ================================================================== */
/*  BmiInfoSheet — the "What is BMI?" explainer (self-contained sheet)  */
/* ================================================================== */
function BmiInfoSheet({ open, onClose, colors }: { open: boolean; onClose: () => void; colors: Palette }) {
  const t = useT()
  const win = useWindowDimensions()
  const screenH = IS_WEB ? WEB_SCREEN.height : win.height
  const insets = useSafeAreaInsets()
  const [render, setRender] = useState(open)
  const [panelH, setPanelH] = useState(480)
  const progress = useRef(new Animated.Value(0)).current
  const EASE = Easing.bezier(0.22, 1, 0.36, 1)

  useEffect(() => {
    if (open) {
      setRender(true)
      Animated.timing(progress, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: !IS_WEB }).start()
    } else if (render) {
      Animated.timing(progress, { toValue: 0, duration: 260, easing: EASE, useNativeDriver: !IS_WEB }).start(({ finished }) => { if (finished) setRender(false) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const rows = [
    { c: colors.accentBlue, label: 'Underweight', range: 'Below 18.5' },
    { c: colors.brand400, label: 'Healthy', range: '18.5 – 24.9' },
    { c: colors.accentYellow, label: 'Overweight', range: '25.0 – 29.9' },
    { c: colors.danger, label: 'Obese', range: '30.0 and above' },
  ]

  return (
    <AppModal visible={render} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', opacity: progress }}>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}
          style={{
            maxHeight: screenH * 0.7, backgroundColor: colors.ink800,
            borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom,
            shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 60, shadowOffset: { width: 0, height: -24 }, elevation: 24,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [panelH, 0] }) }],
          }}
        >
          <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 999, backgroundColor: `${colors.fg}33`, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 19, fontWeight: '800', letterSpacing: -0.2, color: colors.fg }}>{t('What is BMI?')}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ height: 32, width: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: `${colors.fg}1a` }}><X size={16} color={colors.fg} /></Pressable>
            </View>
            <Text style={{ marginTop: 14, fontSize: 14, lineHeight: 22, color: `${colors.fg}b3` }}>
              Body Mass Index estimates whether your weight sits in a healthy range for your height. It's your weight in kilograms divided by your height in metres squared.
            </Text>
            <View style={{ marginTop: 16, gap: 9 }}>
              {rows.map((r) => (
                <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.c }} />
                  <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.fg }}>{t(r.label)}</Text>
                  <Text style={{ fontSize: 13, color: `${colors.fg}80` }}>{r.range}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 18, flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, backgroundColor: `${colors.accentBlue}1a`, borderWidth: 1, borderColor: `${colors.accentBlue}40` }}>
              <Info size={18} color={colors.accentBlue} />
              <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 19, color: `${colors.fg}b3` }}>
                BMI doesn't account for muscle mass, so it can read high for strength athletes. Treat it as one signal, not the whole picture.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </AppModal>
  )
}
