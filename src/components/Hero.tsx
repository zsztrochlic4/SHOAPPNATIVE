import type { ReactNode } from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '../theme'

/**
 * Image banner with a left-to-right ink gradient for text legibility — the RN
 * equivalent of the web `bg-gradient-to-r from-ink-900 ... to-ink-900/30`
 * overlay used on the workout / plan hero cards.
 */
export function Hero({
  image,
  children,
  className = '',
  rounded = 16,
}: {
  image?: string
  children: ReactNode
  className?: string
  rounded?: number
}) {
  const colors = useColors()
  return (
    <View className={`overflow-hidden border border-white/5 ${className}`} style={{ borderRadius: rounded }}>
      {!!image && (
        <>
          <Image source={{ uri: image }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[colors.ink900, `${colors.ink900}e6`, `${colors.ink900}4d`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}
      <View className="p-5">{children}</View>
    </View>
  )
}
