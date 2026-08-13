/**
 * The Coach conversation — the first-class main tab (chrome="tab") and, for the
 * legacy deep-link/menu entry, a full-screen sheet (chrome="sheet"). One body,
 * one engine (useCoachChat), so the two surfaces can never drift.
 *
 * Tab behaviours (CLAUDE.md "Coach as a first-class main tab"):
 *  • No back arrow; the bottom nav stays visible while chatting.
 *  • Composer sits above the nav, respecting the home-indicator inset; chips sit
 *    directly above the composer.
 *  • The keyboard auto-hides the nav (via onKeyboardVisibleChange) and lifts the
 *    composer to sit above it — animated, no layout jump.
 *  • Auto-follows new messages, EXCEPT while the user has scrolled up to read
 *    older ones; resumes as soon as they return near the bottom.
 *  • Conversation, draft text and scroll position are preserved across tabs
 *    because the tab stays mounted (App keeps it alive).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView, Animated, Easing, Keyboard, Platform,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Send, ChevronLeft, X, MessageCircle } from 'lucide-react-native'
import { PressableScale } from '../components/PressableScale'
import { CoachComingSoon } from '../components/CoachComingSoon'
import { CoachMemoryView } from '../components/CoachMemoryView'
import { CoachSafetyStrip } from '../components/CoachSafetyStrip'
import { NAV_CONTENT_HEIGHT, NAV_HOME_REGION } from '../components/BottomNav'
import { useStore } from '../store/store'
import { useNav } from '../nav'
import { useColors } from '../theme'
import { withAlpha } from '../lib/color'
import { tick } from '../lib/haptics'
import { IS_WEB } from '../components/WebFrame'
import { coachWelcome, CHAT_SUGGESTIONS } from '../lib/coachChat'
import { coachContext, coachOperational } from '../lib/coachSafety'
import { relativeLabel, todayKey } from '../lib/date'
import { useCoachChat, COACH_SCRIPTED } from './useCoachChat'
import { CoachMessageRow, TypingDots } from './CoachMessageRow'
import { CoachWelcome } from './CoachWelcome'
import type { ChatMessage } from '../store/types'

type Chrome = 'tab' | 'sheet'

export function CoachScreen({
  chrome,
  active,
  onClose,
  onKeyboardVisibleChange,
}: {
  chrome: Chrome
  active: boolean
  onClose?: () => void
  onKeyboardVisibleChange?: (visible: boolean) => void
}) {
  const { state, dispatch } = useStore()
  const nav = useNav()
  const insets = useSafeAreaInsets()
  const c = useColors()
  const chat = useCoachChat({ active })
  const {
    colors, coachName, messages, hasHistory, hasText,
    text, setText, typing, setFocused, replyingTo, setReplyingTo, retryMsg,
    coachConsented, setCoachConsented, revealX,
    send, cancelPending, handleProposalConfirmed, handlePublishShare, handleChooseSwap, handleUndo,
    undoTarget, swapChoice, shareDraft, applyingProposalId, failedApply,
  } = chat

  const welcomeSeen = state.settings.coachWelcomeSeen === true
  // Mirror the nav's own footprint: items row + (OS safe-area inset OR the drawn home-indicator pill).
  const navHeight = NAV_CONTENT_HEIGHT + (insets.bottom > 0 ? insets.bottom : NAV_HOME_REGION)

  const listRef = useRef<FlatList<ChatMessage>>(null)
  const atBottom = useRef(true)

  // Keyboard → hide the nav + lift the composer (tab only; the sheet has no nav).
  const [kbHeight, setKbHeight] = useState(0)
  const footerPad = useRef(new Animated.Value(chrome === 'tab' ? navHeight : Math.max(insets.bottom, 12) + 2)).current
  useEffect(() => {
    if (chrome !== 'tab') return
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const onShow = Keyboard.addListener(showEvt, (e) => { setKbHeight(e.endCoordinates?.height ?? 0); onKeyboardVisibleChange?.(true) })
    const onHide = Keyboard.addListener(hideEvt, () => { setKbHeight(0); onKeyboardVisibleChange?.(false) })
    return () => { onShow.remove(); onHide.remove(); onKeyboardVisibleChange?.(false) }
  }, [chrome, onKeyboardVisibleChange])

  useEffect(() => {
    if (chrome !== 'tab') return
    Animated.timing(footerPad, {
      toValue: kbHeight > 0 ? kbHeight : navHeight,
      duration: 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start()
    if (kbHeight > 0 && atBottom.current) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [kbHeight, navHeight, footerPad, chrome])

  // The greeting is a display-only opener (never persisted) shown ONLY on a truly empty thread, so the
  // first-time state reads as "coach greeting + chips, no seeded messages". Once there are any stored
  // messages, they stand on their own (no duplicate greeting).
  const greeting: ChatMessage = useMemo(
    () => ({ id: 'coach-greeting', role: 'coach', text: coachWelcome(state), dateKey: todayKey, time: '', read: true }),
    [state],
  )
  const data = useMemo(() => (messages.length === 0 ? [greeting] : messages), [greeting, messages])

  // Auto-follow, with the read-older exception: only pin to the bottom when the user is already near it.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    atBottom.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120
  }
  useEffect(() => {
    if (atBottom.current) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }, [messages.length, typing])

  const submit = (t?: string) => { tick(); void send(t) }

  // ---- gates: coming-soon → welcome → consent → conversation --------------------------------
  if (!coachOperational() && !COACH_SCRIPTED) {
    return <Shell chrome={chrome} colors={c} coachName={coachName} onClose={onClose} insetsTop={insets.top}><CoachComingSoon /></Shell>
  }
  if (!welcomeSeen) {
    return (
      <View style={{ flex: 1, backgroundColor: c.ink900, paddingTop: chrome === 'sheet' ? insets.top : 0 }}>
        <CoachWelcome onContinue={() => dispatch({ type: 'SET_SETTINGS', patch: { coachWelcomeSeen: true } })} />
      </View>
    )
  }
  if (!COACH_SCRIPTED && coachConsented !== true) {
    return (
      <View style={{ flex: 1, backgroundColor: c.ink900, paddingTop: chrome === 'sheet' ? insets.top : 0 }}>
        <CoachMemoryView onClose={() => (chrome === 'sheet' ? onClose?.() : nav.goTab('dashboard'))} onConsentChanged={setCoachConsented} />
      </View>
    )
  }

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const prev = data[index - 1]
    const showDay = index === 0 || prev?.dateKey !== item.dateKey
    const showAvatar = item.role === 'coach' && (index === 0 || prev?.role !== 'coach')
    const rowUndo = undoTarget && item.proposal && undoTarget.proposalId === item.proposal.id ? undoTarget : null
    const rowChoice = swapChoice && item.proposal && swapChoice.proposalId === item.proposal.id ? swapChoice : null
    const rowShare = shareDraft && item.proposal && shareDraft.proposalId === item.proposal.id ? shareDraft : null
    const rowApplying = !!(applyingProposalId && item.proposal && applyingProposalId === item.proposal.id)
    const rowFailed = failedApply && item.proposal && failedApply.proposalId === item.proposal.id ? failedApply : null
    return (
      <View style={{ gap: 12 }}>
        {showDay && (
          <View style={{ alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: withAlpha(colors.fg, 0.05) }}>
            <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: withAlpha(colors.fg, 0.4) }}>
              {relativeLabel(item.dateKey)}
            </Text>
          </View>
        )}
        <CoachMessageRow
          m={item}
          state={state}
          coachName={coachName}
          showAvatar={showAvatar}
          revealX={revealX}
          colors={colors}
          onReply={(message) => setReplyingTo({ role: message.role, text: message.text })}
          onProposalConfirmed={handleProposalConfirmed}
          undoActive={!!rowUndo}
          onUndo={rowUndo ? () => handleUndo(rowUndo.snapshot, rowUndo.actionId, rowUndo.appliedVersion) : undefined}
          applying={rowApplying}
          applyFailed={!!rowFailed}
          onRetryApply={rowFailed ? rowFailed.retry : undefined}
          swapOptions={rowChoice ? rowChoice.options : undefined}
          onChooseSwap={rowChoice ? (option) => handleChooseSwap(rowChoice, option) : undefined}
          shareText={rowShare ? rowShare.text : undefined}
          onPublishShare={rowShare ? () => handlePublishShare(rowShare) : undefined}
          onCancelShare={rowShare ? () => { chat.setReplyingTo(null) } : undefined}
        />
      </View>
    )
  }

  return (
    <Shell chrome={chrome} colors={c} coachName={coachName} onClose={onClose} insetsTop={insets.top}>
      <CoachSafetyStrip isAustralia={coachContext(state).isAustralia} fg={colors.fg} brand={colors.brand400} />

      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={() => { if (atBottom.current) listRef.current?.scrollToEnd({ animated: true }) }}
        ListFooterComponent={typing ? <View style={{ paddingHorizontal: 16, paddingTop: 4 }}><TypingDots colors={colors} /></View> : null}
      />

      {/* Footer: chips → reply banner → composer, lifting above the nav / keyboard. */}
      <Animated.View style={chrome === 'tab' ? { paddingBottom: footerPad } : { paddingBottom: Math.max(insets.bottom, 12) + 2 }}>
        {/* Suggestion chips, directly above the composer. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 4, gap: 8 }}
        >
          {CHAT_SUGGESTIONS.map((s) => (
            <PressableScale
              key={s}
              onPress={() => submit(s)}
              accessibilityRole="button"
              accessibilityLabel={s}
              style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: withAlpha(colors.fg, 0.06), borderWidth: 1, borderColor: withAlpha(colors.fg, 0.08) }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: withAlpha(colors.fg, 0.8) }}>{s}</Text>
            </PressableScale>
          ))}
        </ScrollView>

        {typing && (
          <PressableScale haptic={false} onPress={cancelPending} accessibilityRole="button" accessibilityLabel="Cancel waiting for the coach" containerStyle={{ alignSelf: 'center', marginTop: 6 }} style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: withAlpha(colors.fg, 0.08) }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: withAlpha(colors.fg, 0.65) }}>Cancel</Text>
          </PressableScale>
        )}
        {!typing && retryMsg && (
          <PressableScale haptic={false} onPress={() => void send(retryMsg, { resend: true })} accessibilityRole="button" accessibilityLabel="Retry your last message" containerStyle={{ alignSelf: 'center', marginTop: 6 }} style={{ paddingVertical: 7, paddingHorizontal: 16, borderRadius: 999, backgroundColor: withAlpha(colors.brand400, 0.14), borderWidth: 1, borderColor: withAlpha(colors.brand400, 0.4) }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.brand400 }}>Retry last message</Text>
          </PressableScale>
        )}

        {replyingTo && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginTop: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, backgroundColor: withAlpha(colors.fg, 0.04), borderRadius: 12, borderLeftWidth: 3, borderLeftColor: colors.brand400 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brand400, marginBottom: 1 }}>Replying to {replyingTo.role === 'user' ? 'you' : coachName}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: withAlpha(colors.fg, 0.55) }}>{replyingTo.text}</Text>
            </View>
            <PressableScale haptic={false} onPress={() => setReplyingTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply" style={{ width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(colors.fg, 0.06) }}>
              <X size={16} color={withAlpha(colors.fg, 0.6)} strokeWidth={2.2} />
            </PressableScale>
          </View>
        )}

        {/* Composer */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink800, borderRadius: 24, paddingLeft: 18, paddingRight: 6, paddingVertical: 5 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              multiline
              placeholder="Message your coach…"
              placeholderTextColor={withAlpha(colors.fg, 0.4)}
              onSubmitEditing={() => submit()}
              style={{ flex: 1, maxHeight: 112, paddingVertical: 8, fontSize: 14.5, color: colors.fg }}
            />
          </View>
          <PressableScale
            haptic={hasText && !typing}
            onPress={() => submit()}
            disabled={typing}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !hasText || typing }}
            // The one filled/primary control in the composer: a solid brand-400 circle with a
            // near-black paper-plane, always (never a grey ghost). The text field stays a muted pill.
            style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand400 }}
          >
            <Send size={20} color="#07110b" strokeWidth={2.2} />
          </PressableScale>
        </View>
      </Animated.View>
    </Shell>
  )
}

/** Shared chrome: a centred coach identity header (no back arrow on the tab; a back chevron on the
 *  sheet), over the app's ink surface. Children fill the rest. */
function Shell({
  chrome,
  colors,
  coachName,
  onClose,
  insetsTop,
  children,
}: {
  chrome: Chrome
  colors: ReturnType<typeof useColors>
  coachName: string
  onClose?: () => void
  insetsTop: number
  children: React.ReactNode
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ink900, paddingTop: chrome === 'sheet' ? insetsTop : 0 }}>
      <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: withAlpha(colors.fg, 0.06) }}>
        {chrome === 'sheet' && (
          <PressableScale
            haptic={false}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close coach"
            containerStyle={{ position: 'absolute', left: 12, top: 4 }}
            style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={22} color={colors.fg} strokeWidth={2.2} />
          </PressableScale>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink700, borderWidth: 1.6, borderColor: withAlpha(colors.brand400, 0.55) }}>
            <MessageCircle size={18} color={colors.brand400} strokeWidth={2.2} />
          </View>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 14.5, fontWeight: '800', letterSpacing: -0.2, color: colors.fg }}>{coachName}</Text>
            <Text style={{ fontSize: 11.5, color: withAlpha(colors.fg, 0.5) }}>Your AI fitness coach</Text>
          </View>
        </View>
      </View>
      {children}
    </View>
  )
}
