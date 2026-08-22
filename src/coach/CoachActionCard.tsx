/**
 * The ONE reusable card every coach-proposed change renders through — never a
 * bespoke layout per action (CLAUDE.md "Coach action / confirmation cards").
 *
 *  • Header: a coloured category dot + uppercase category label.
 *  • Short plain-language description of what will change.
 *  • Optional before→after diff (old muted + struck through, new tinted to the
 *    category colour) — shown only when the change has a clean old→new value.
 *  • Confirm (primary brand green) + Cancel (ghost), 44px min targets. Nothing
 *    changes until Confirm; a subtle haptic fires on confirm ONLY.
 *
 * After confirm it carries the real action lifecycle (applying / applied+undo /
 * pick-a-swap / publish-PR / failed+retry) so the single card covers every state.
 */
import { useCallback, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ArrowRight } from 'lucide-react-native'
import type { Palette } from '../theme'
import { withAlpha } from '../lib/color'
import { useT } from '../lib/useT'
import { thud } from '../lib/haptics'
import { respondToCoachProposal } from '../lib/coachWorkspace'
import type { CoachActionProposal } from '../backend/coach/contracts'
import type { SwapOption } from '../backend/runtime/coachActionResolver'
import { categoryColor, categoryLabel, proposalCategory, proposalDisplayTitle, proposalDiff, type CoachCategory } from './proposal'
import type { AppState } from '../store/types'

export function CoachActionCard({
  proposal,
  state,
  colors,
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
  proposal: CoachActionProposal
  state: AppState
  colors: Palette
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
  const [proposalStatus, setProposalStatus] = useState(proposal.status ?? null)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState(false)
  const t = useT()

  const cat: CoachCategory = proposalCategory(proposal)
  const c = categoryColor(cat, colors)
  const diff = proposalDiff(proposal, state)

  const resolveProposal = useCallback(async (decision: 'confirm' | 'reject') => {
    if (resolving || proposalStatus !== 'pending') return
    setResolving(true)
    setResolveError(false)
    try {
      const result = await respondToCoachProposal(proposal.id, decision)
      setProposalStatus(result.status as CoachActionProposal['status'])
      // Haptic on CONFIRM only — declining is silent.
      if (decision === 'confirm') { thud(); onProposalConfirmed({ ...proposal, status: 'confirmed' }, result.actionId) }
    } catch (e: unknown) {
      const code = String((e as { code?: string })?.code ?? '')
      const detail = String((e as { message?: string })?.message ?? '')
      const trulyGone = code.includes('failed-precondition') || code.includes('not-found') || /expired|no longer pending|not found/i.test(detail)
      if (trulyGone) setProposalStatus('expired')
      else setResolveError(true)
    } finally {
      setResolving(false)
    }
  }, [proposal, onProposalConfirmed, proposalStatus, resolving])

  return (
    <View
      style={{
        marginTop: 11,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: withAlpha(colors.fg, 0.08),
        backgroundColor: colors.ink700,
        padding: 13,
      }}
    >
      {/* Category header — coloured dot + uppercase label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 8, height: 8, borderRadius: 4, backgroundColor: c,
            shadowColor: c, shadowOpacity: 0.6, shadowRadius: 5, shadowOffset: { width: 0, height: 0 },
          }}
        />
        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: c }}>
          {categoryLabel(cat)}
        </Text>
      </View>

      {/* Title + plain-language description */}
      <Text style={{ marginTop: 8, fontSize: 13.5, fontWeight: '700', color: colors.fg }}>{proposalDisplayTitle(proposal)}</Text>
      <Text style={{ marginTop: 3, fontSize: 12, lineHeight: 17, color: withAlpha(colors.fg, 0.55) }}>{proposal.summary}</Text>

      {/* before → after diff (only when there's a clean old→new value) */}
      {diff && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2 }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: withAlpha(colors.fg, 0.06) }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: withAlpha(colors.fg, 0.45), textDecorationLine: 'line-through' }}>{diff.from}</Text>
          </View>
          <ArrowRight size={18} color={withAlpha(colors.fg, 0.4)} strokeWidth={2.2} />
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, backgroundColor: withAlpha(c, 0.16) }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: c }}>{diff.to}</Text>
          </View>
        </View>
      )}

      {proposalStatus === 'pending' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 11 }}>
            <Pressable
              disabled={resolving}
              onPress={() => void resolveProposal('confirm')}
              accessibilityRole="button"
              accessibilityLabel={`Confirm: ${proposalDisplayTitle(proposal)}`}
              accessibilityHint="Applies this change to your plan"
              accessibilityState={{ disabled: resolving, busy: resolving }}
              style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.brand400, opacity: resolving ? 0.5 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#07110b' }}>{resolving ? t('Saving…') : t('Confirm')}</Text>
            </Pressable>
            <Pressable
              disabled={resolving}
              onPress={() => void resolveProposal('reject')}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              accessibilityHint="Dismisses the suggestion without changing your plan"
              accessibilityState={{ disabled: resolving }}
              style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.fg }}>{t('Cancel')}</Text>
            </Pressable>
          </View>
          {resolveError && (
            <Text style={{ marginTop: 6, fontSize: 11, color: colors.danger }} accessibilityRole="text">
              {t('Couldn’t reach the server — your choice is still here, tap again to retry.')}
            </Text>
          )}
        </>
      ) : proposalStatus === 'confirmed' && applying ? (
        <View style={{ marginTop: 9 }} accessibilityRole="text" accessibilityLabel="Applying your change">
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: withAlpha(colors.fg, 0.55) }}>{t('Applying…')}</Text>
        </View>
      ) : proposalStatus === 'confirmed' && applyFailed && onRetryApply ? (
        <View style={{ marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.danger }}>{t('Couldn’t save')}</Text>
          <Pressable onPress={onRetryApply} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retry applying the change" style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: withAlpha(colors.brand400, pressed ? 0.16 : 0.1) })}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brand400 }}>{t('Retry')}</Text>
          </Pressable>
        </View>
      ) : proposalStatus === 'confirmed' && shareText && onPublishShare ? (
        <View style={{ marginTop: 9, gap: 8 }}>
          <View style={{ borderRadius: 12, backgroundColor: withAlpha(colors.fg, 0.05), padding: 10 }}>
            <Text style={{ fontSize: 12, lineHeight: 17, color: colors.fg }}>{shareText}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={onPublishShare} accessibilityRole="button" accessibilityLabel="Publish PR to feed" style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.brand400, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#07110b' }}>{t('Publish to feed')}</Text>
            </Pressable>
            <Pressable onPress={onCancelShare} accessibilityRole="button" accessibilityLabel="Don't publish" style={({ pressed }) => ({ minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: withAlpha(colors.fg, 0.7) }}>{t('Not now')}</Text>
            </Pressable>
          </View>
        </View>
      ) : proposalStatus === 'confirmed' && swapOptions && onChooseSwap ? (
        <View style={{ marginTop: 9, gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: withAlpha(colors.fg, 0.45) }}>{t('Pick a replacement')}</Text>
          {swapOptions.map((option) => (
            <Pressable key={option.id} onPress={() => onChooseSwap(option)} accessibilityRole="button" accessibilityLabel={`Replace with ${option.name}${option.recommended ? ', recommended' : ''}${option.muscleGroup ? `, ${option.muscleGroup}` : ''}`} style={({ pressed }) => ({ minHeight: 44, borderRadius: 11, borderWidth: option.recommended ? 1.5 : 1, borderColor: withAlpha(colors.brand400, option.recommended ? 0.7 : 0.35), paddingVertical: 9, paddingHorizontal: 12, backgroundColor: withAlpha(colors.brand400, pressed ? 0.16 : option.recommended ? 0.12 : 0.08) })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.fg }}>{option.name}</Text>
                {option.recommended && (
                  <Text style={{ fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3, color: colors.brand400, backgroundColor: withAlpha(colors.brand400, 0.16), paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>{t('RECOMMENDED')}</Text>
                )}
              </View>
              {!!option.muscleGroup && <Text style={{ marginTop: 1, fontSize: 11, color: withAlpha(colors.fg, 0.5) }}>{option.muscleGroup}</Text>}
            </Pressable>
          ))}
        </View>
      ) : proposalStatus === 'confirmed' && undoActive && onUndo ? (
        <View style={{ marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.brand400 }} accessibilityRole="text" accessibilityLabel="Change applied">{t('Applied')}</Text>
          <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button" accessibilityLabel="Undo this change" style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 11, backgroundColor: withAlpha(colors.fg, 0.07), opacity: pressed ? 0.65 : 1 })}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: withAlpha(colors.fg, 0.7) }}>{t('Undo')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ marginTop: 8, fontSize: 11.5, fontWeight: '700', color: proposalStatus === 'confirmed' ? colors.brand400 : withAlpha(colors.fg, 0.4) }}>
          {proposalStatus === 'confirmed' ? t('Confirmed') : proposalStatus === 'rejected' ? t('Cancelled') : t('Proposal expired')}
        </Text>
      )}
    </View>
  )
}
