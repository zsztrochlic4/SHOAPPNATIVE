/**
 * One coach/user message. Matches the design: coach bubbles on the left with a
 * grouped avatar (only on the FIRST message of a run), user bubbles on the right
 * in brand green, plus the two swipe gestures:
 *   • drag LEFT  → reveal every row's timestamp (a SHARED offset, like iMessage).
 *   • drag RIGHT → reply to this message (a glyph fades in; past the threshold it
 *     arms the reply banner, with a haptic).
 * Citations are NEVER rendered inline — evidence is surfaced as a follow-up only
 * when the user asks (see useCoachChat / CLAUDE.md).
 */
import { useEffect, useRef } from 'react'
import { View, Text, Animated, Easing, PanResponder } from 'react-native'
import { MessageCircle, Reply } from 'lucide-react-native'
import type { Palette } from '../theme'
import { withAlpha } from '../lib/color'
import { thud } from '../lib/haptics'
import { IS_WEB } from '../components/WebFrame'
import { useReducedMotion, motionDuration } from '../lib/a11y'
import { SafetyContactButtons } from '../components/SafetyContactButtons'
import { CoachActionCard } from './CoachActionCard'
import { isProposalRenderable } from './proposal'
import type { ChatMessage, AppState } from '../store/types'
import type { CoachActionProposal } from '../backend/coach/contracts'
import type { SwapOption } from '../backend/runtime/coachActionResolver'

/** A small coach avatar — the speech-bubble mark inside a brand-ringed disc. */
function MiniAvatar({ colors }: { colors: Palette }) {
  return (
    <View
      style={{
        width: 26, height: 26, borderRadius: 13, backgroundColor: colors.ink700,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.4, borderColor: withAlpha(colors.brand400, 0.5),
      }}
    >
      <MessageCircle size={14} color={colors.brand400} strokeWidth={2.2} />
    </View>
  )
}

export function CoachMessageRow({
  m,
  state,
  coachName,
  showAvatar,
  revealX,
  colors,
  onReply,
  onProposalConfirmed,
  undoActive,
  onUndo,
  applying,
  applyFailed,
  onRetryApply,
  swapOptions,
  onChooseSwap,
  shareText,
  onPublishShare,
  onCancelShare,
}: {
  m: ChatMessage
  state: AppState
  coachName: string
  showAvatar: boolean
  revealX: Animated.Value
  colors: Palette
  onReply: (m: ChatMessage) => void
  onProposalConfirmed: (proposal: CoachActionProposal, actionId?: string) => void
  undoActive?: boolean
  onUndo?: () => void
  applying?: boolean
  applyFailed?: boolean
  onRetryApply?: () => void
  swapOptions?: SwapOption[]
  onChooseSwap?: (option: SwapOption) => void
  shareText?: string
  onPublishShare?: () => void
  onCancelShare?: () => void
}) {
  const user = m.role === 'user'
  const reduceMotion = useReducedMotion()
  const replyX = useRef(new Animated.Value(0)).current
  const iconOpacity = useRef(new Animated.Value(0)).current
  const enter = useRef(new Animated.Value(0)).current
  const mode = useRef<null | 'reveal' | 'reply'>(null)

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: motionDuration(300), easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: !IS_WEB }).start()
  }, [enter])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > Math.abs(g.dy) * 1.4 && Math.abs(g.dx) > 8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { mode.current = null },
      onPanResponderMove: (_e, g) => {
        if (!mode.current) {
          if (Math.abs(g.dx) < 6) return
          mode.current = g.dx < 0 ? 'reveal' : 'reply'
        }
        if (mode.current === 'reveal') {
          revealX.setValue(Math.max(g.dx, -72))
        } else {
          const off = Math.min(Math.max(g.dx, 0), 80)
          replyX.setValue(off)
          iconOpacity.setValue(Math.min(off / 48, 1))
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (mode.current === 'reveal') {
          Animated.spring(revealX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        } else if (mode.current === 'reply') {
          if (g.dx >= 48) { thud(); onReply(m) }
          Animated.spring(replyX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
          Animated.timing(iconOpacity, { toValue: 0, duration: 150, useNativeDriver: !IS_WEB }).start()
        }
        mode.current = null
      },
      onPanResponderTerminate: () => {
        Animated.spring(revealX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        Animated.spring(replyX, { toValue: 0, tension: 120, friction: 14, useNativeDriver: !IS_WEB }).start()
        iconOpacity.setValue(0)
        mode.current = null
      },
    }),
  ).current

  const translateX = Animated.add(revealX, replyX)

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        position: 'relative',
        width: '100%',
        opacity: reduceMotion ? 1 : enter,
        transform: [{ translateX }, { translateY: reduceMotion ? 0 : enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {/* Reply glyph off the left edge — revealed by a rightward drag. */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', right: '100%', top: 0, bottom: 0, justifyContent: 'center', paddingRight: 10, opacity: iconOpacity }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: withAlpha(colors.brand400, 0.18), alignItems: 'center', justifyContent: 'center' }}>
          <Reply size={16} color={colors.brand400} strokeWidth={2} />
        </View>
      </Animated.View>

      {/* Coach = avatar (or aligned spacer) + bubble on the left; user = bubble on the right. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: user ? 'flex-end' : 'flex-start' }}>
        {!user && (showAvatar ? <MiniAvatar colors={colors} /> : <View style={{ width: 26 }} />)}
        <View style={{ maxWidth: user ? '82%' : '86%', alignItems: user ? 'flex-end' : 'flex-start' }}>
          {/* Quoted message this one replies to. */}
          {m.replyTo && (
            <View style={{ maxWidth: '100%', backgroundColor: withAlpha(colors.fg, 0.06), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: withAlpha(colors.fg, 0.5), marginBottom: 1 }}>{m.replyTo.role === 'user' ? 'You' : coachName}</Text>
              <Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 16, color: withAlpha(colors.fg, 0.55) }}>{m.replyTo.text}</Text>
            </View>
          )}

          <View
            style={{
              paddingHorizontal: 15, paddingVertical: 11,
              borderRadius: 20,
              borderBottomLeftRadius: user ? 20 : 7,
              borderBottomRightRadius: user ? 7 : 20,
              backgroundColor: user ? colors.brand400 : colors.ink800,
            }}
          >
            <Text style={{ fontSize: 14.5, lineHeight: 21, color: user ? '#07110b' : colors.fg, fontWeight: user ? '600' : '400' }}>{m.text}</Text>
            {m.role === 'coach' && m.buttons && <SafetyContactButtons buttons={m.buttons} />}
            {m.role === 'coach' && m.proposal && isProposalRenderable(m.proposal) && (
              <CoachActionCard
                proposal={m.proposal}
                state={state}
                colors={colors}
                onProposalConfirmed={onProposalConfirmed}
                undoActive={undoActive}
                onUndo={onUndo}
                applying={applying}
                applyFailed={applyFailed}
                onRetryApply={onRetryApply}
                swapOptions={swapOptions}
                onChooseSwap={onChooseSwap}
                shareText={shareText}
                onPublishShare={onPublishShare}
                onCancelShare={onCancelShare}
              />
            )}
          </View>
        </View>
      </View>

      {/* Timestamp off the right edge — revealed by a leftward drag. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: '100%', top: 0, bottom: 0, justifyContent: 'center', paddingLeft: 16 }}>
        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: withAlpha(colors.fg, 0.4) }}>{m.time}</Text>
      </View>
    </Animated.View>
  )
}

/** Three bouncing dots while the coach "types". Honours reduce-motion (static fallback). */
export function TypingDots({ colors }: { colors: Palette }) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (reduceMotion) return
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: -4, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay((dots.length - 1 - i) * 150),
        ]),
      ),
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [dots, reduceMotion])
  return (
    <View style={{ gap: 5 }} accessibilityRole="text" accessibilityLabel="Coach is thinking">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <MiniAvatar colors={colors} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderBottomLeftRadius: 7, backgroundColor: colors.ink800, paddingHorizontal: 16, paddingVertical: 15 }}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: withAlpha(colors.fg, 0.4), transform: [{ translateY: d }] }} />
          ))}
        </View>
      </View>
      {/* A quiet "thinking" caption so the considered pause reads as intentional, not slow. */}
      <Text style={{ marginLeft: 44, fontSize: 11.5, fontWeight: '600', color: withAlpha(colors.fg, 0.38) }}>Coach is thinking…</Text>
    </View>
  )
}
