import { type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'

/**
 * Screen-reader equivalent for a chart (audit SA-012).
 *
 * Charts are drawn with SVG/Views that convey nothing to VoiceOver/TalkBack. This
 * wraps a visual in a single accessible element with a `role="image"` and a
 * text-alternative `summary` (e.g. "Readiness 82 of 100, ahead of plan"), and
 * hides the decorative children from assistive tech so the summary is the ONE
 * thing announced. Callers pass a concise, data-bearing summary string.
 */
export function AccessibleChart({
  summary,
  children,
  style,
}: {
  summary: string
  children: ReactNode
  style?: ViewStyle
}) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={style}>
      {/* The visual is decorative once the summary carries the data — hide it from
          assistive tech so nothing is double-announced. */}
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {children}
      </View>
    </View>
  )
}
