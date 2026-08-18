/**
 * Report an offensive username or group. A compact bottom sheet: pick a reason,
 * optionally add a note, submit. Routes through service.reportContent (owner
 * triage queue live; accepted locally with the backend off). Shared by the global
 * leaderboard (report a user) and the group screens (report a group / member).
 */
import { useState } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useColors } from '../theme'
import { reportContent, REPORT_REASONS, type ReportReason } from './service'

export interface ReportTarget {
  type: 'user' | 'group'
  id: string
  label: string
}

export function ReportSheet({ open, target, onClose }: { open: boolean; target: ReportTarget | null; onClose: () => void }) {
  const colors = useColors()
  const toast = useToast()
  const [reason, setReason] = useState<ReportReason>('offensive_name')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
      toast(res.ok ? 'Thanks — our team will review this' : "Couldn't send that. Try again.")
      if (res.ok) {
        setNote('')
        setReason('offensive_name')
        onClose()
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
