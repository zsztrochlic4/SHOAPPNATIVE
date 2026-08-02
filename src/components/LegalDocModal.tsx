/**
 * LegalDocModal — full-screen in-app viewer for StrengthHub's legal / safety
 * documents (Terms of Use, Privacy Policy, Health & safety information).
 *
 * Renders the structured content from `src/content/legal.ts` natively, so the
 * acknowledgement links in onboarding (and the footer links in the paywall)
 * show real content without depending on an external website. Works pre-login.
 */
import { useMemo } from 'react'
import { View, Text, Pressable, ScrollView, type TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { AppModal } from './WebFrame'
import { cssVars, useThemeName } from '../theme'
import { LEGAL_DOCS, type LegalBlock, type LegalDocKey } from '../content/legal'

function useRgb() {
  const name = useThemeName()
  return useMemo(() => {
    const map = cssVars[name]
    return (t: string, a?: number) => {
      const parts = (map[t] || '0 0 0').split(' ')
      return a === undefined ? `rgb(${parts.join(',')})` : `rgba(${parts.join(',')},${a})`
    }
  }, [name])
}

/** Split "text with **bold** parts" into <Text> runs, bolding the ** segments. */
function RichText({ text, style, bold }: { text: string; style: TextStyle; bold: TextStyle }) {
  const parts = text.split('**')
  return (
    <Text style={style}>
      {parts.map((seg, i) => (i % 2 === 1 ? <Text key={i} style={bold}>{seg}</Text> : seg))}
    </Text>
  )
}

function Block({ block, rgb }: { block: LegalBlock; rgb: (t: string, a?: number) => string }) {
  const bodyStyle: TextStyle = { fontSize: 15, lineHeight: 24, color: rgb('--fg', 0.75) }
  const boldStyle: TextStyle = { fontWeight: '700', color: rgb('--fg') }

  if ('h' in block) {
    return (
      <Text style={{ fontSize: 17, fontWeight: '800', letterSpacing: -0.3, color: rgb('--fg'), marginTop: 26, marginBottom: 8 }}>
        {block.h}
      </Text>
    )
  }
  if ('ul' in block) {
    return (
      <View style={{ marginTop: 4 }}>
        {block.ul.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', marginTop: 8, paddingRight: 4 }}>
            <Text style={{ ...bodyStyle, color: rgb('--brand-400') }}>{'•'}  </Text>
            <View style={{ flex: 1 }}>
              <RichText text={item} style={bodyStyle} bold={boldStyle} />
            </View>
          </View>
        ))}
      </View>
    )
  }
  return (
    <View style={{ marginTop: 12 }}>
      <RichText text={block.p} style={bodyStyle} bold={boldStyle} />
    </View>
  )
}

export function LegalDocModal({ docKey, onClose }: { docKey: LegalDocKey | null; onClose: () => void }) {
  const rgb = useRgb()
  const insets = useSafeAreaInsets()
  const doc = docKey ? LEGAL_DOCS[docKey] : null

  return (
    <AppModal visible={!!doc} onRequestClose={onClose} animationType="slide">
      <View style={{ flex: 1, backgroundColor: rgb('--ink-900') }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: rgb('--fg', 0.06) }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', letterSpacing: -0.5, color: rgb('--fg') }}>
                {doc?.title ?? ''}
              </Text>
              {!!doc && (
                <Text style={{ marginTop: 4, fontSize: 12.5, color: rgb('--fg', 0.45) }}>
                  Last updated {doc.lastUpdated}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={10}
              style={{ width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: rgb('--fg', 0.06) }}
            >
              <X size={20} color={rgb('--fg', 0.75)} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>

        {/* body */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator
        >
          {doc?.blocks.map((block, i) => (
            <Block key={i} block={block} rgb={rgb} />
          ))}
        </ScrollView>
      </View>
    </AppModal>
  )
}
