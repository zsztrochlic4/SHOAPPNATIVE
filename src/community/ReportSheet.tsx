/**
 * Report an offensive username or group. A compact bottom sheet: pick a reason,
 * optionally add a note, submit. Routes through service.reportContent (owner
 * triage queue live; accepted locally with the backend off). Shared by the global
 * leaderboard (report a user) and the group screens (report a group / member).
 */
import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { Check } from 'lucide-react-native'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useColors, brand } from '../theme'
import { useStore } from '../store/store'
import { reportContent, REPORT_REASONS, type ReportReason } from './service'

export interface ReportTarget {
  type: 'user' | 'group'
  id: string
  label: string
}

/** Both report call sites pass a user's label as `@username`; blocks are keyed by
 *  that username (unique app-wide, and the only id group members carry). */
function usernameOf(target: ReportTarget | null): string | null {
  if (!target || target.type !== 'user') return null
  return target.label.replace(/^@/, '') || null
}

export function ReportSheet({ open, target, onClose }: { open: boolean; target: ReportTarget | null; onClose: () => void }) {
  const colors = useColors()
  const toast = useToast()
  const { dispatch } = useStore()
  const [reason, setReason] = useState<ReportReason>('offensive_name')
  const [note, setNote] = useState('')
  const [block, setBlock] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const blockName = usernameOf(target)
  // Default "also block" on for user reports; reset each time the sheet opens.
  useEffect(() => { if (open) { setBlock(true) } }, [open, target?.id])

  const submit = async () => {
    if (submitting || !target) return
    setSubmitting(true)
    try {
      const res = await reportContent({
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label,
        reason,
        note: note.trim() || undefined,
      })
      if (res.ok) {
        if (blockName && block) {
          dispatch({ type: 'BLOCK_USER', uid: blockName })
          toast(`Reported and blocked @${blockName}`)
        } else {
          toast('Thanks, our team will review this')
        }
        setNote('')
        setReason('offensive_name')
        onClose()
      } else {
        toast("Couldn't send that. Try again.")
      }
    } catch {
      toast("Couldn't send that. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const what = target?.type === 'group' ? 'group' : 'user'
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${what}`}>
      <Text className="text-[13px] leading-snug text-secondary">
        Reporting {target ? <Text className="font-semibold text-white" style={{ color: colors.fg }}>{target.label}</Text> : `this ${what}`}. Our team reviews reports privately; the person isn't told who reported them.
      </Text>

      <View className="mt-3 flex-row flex-wrap gap-2">
        {REPORT_REASONS.map((r) => {
          const active = r.value === reason
          return (
            <Pressable
              key={r.value}
              onPress={() => setReason(r.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={r.label}
              className={`rounded-full border px-3.5 py-2 active:opacity-90 ${active ? 'border-brand-400 bg-brand-400/15' : 'border-white/12 bg-ink-700'}`}
            >
              <Text className={`text-[13px] ${active ? 'font-bold text-brand-300' : 'text-secondary'}`}>{r.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View className="mt-3 rounded-2xl border border-white/12 bg-ink-700 px-3.5 py-3">
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          placeholder="Add any detail (optional)"
          placeholderTextColor="rgba(255,255,255,0.3)"
          accessibilityLabel="Report detail"
          textAlignVertical="top"
          className="min-h-[72px] text-[15px] leading-snug text-white"
          style={{ color: colors.fg }}
        />
      </View>
      <Text className="mt-1.5 px-1 text-[11px] text-tertiary">{note.length}/500</Text>

      {blockName && (
        <Pressable
          onPress={() => setBlock((b) => !b)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: block }}
          accessibilityLabel={`Also block @${blockName}`}
          className="mt-3 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-ink-700 px-3.5 py-3 active:opacity-90"
        >
          <View
            className="h-5 w-5 items-center justify-center rounded-md border"
            style={block ? { backgroundColor: brand[400], borderColor: brand[400] } : { borderColor: 'rgba(255,255,255,0.3)' }}
          >
            {block ? <Check size={14} color="#000" /> : null}
          </View>
          <View className="flex-1">
            <Text className="text-[13px] font-semibold text-white" style={{ color: colors.fg }}>Also block @{blockName}</Text>
            <Text className="text-[12px] leading-snug text-tertiary">Hides them from your leaderboards and group feeds.</Text>
          </View>
        </Pressable>
      )}

      <Pressable
        onPress={submit}
        disabled={submitting || !target}
        accessibilityRole="button"
        accessibilityLabel="Submit report"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        className="btn-primary mt-3 flex-row items-center justify-center gap-2 py-3 active:opacity-90"
        style={submitting ? { opacity: 0.7 } : undefined}
      >
        {submitting ? <ActivityIndicator size="small" color="#000" /> : <Text className="text-[15px] font-bold text-black">Submit report</Text>}
      </Pressable>
    </Sheet>
  )
}
