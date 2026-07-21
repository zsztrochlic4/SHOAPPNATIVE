import { Share, Platform } from 'react-native'

/**
 * Share some text via the OS share sheet. On web (where RN's Share is a no-op)
 * it uses the Web Share API when available, else copies to the clipboard, so the
 * button always does something real. Never throws.
 */
export async function shareText(message: string, title?: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as unknown as { share?: (d: object) => Promise<void>; clipboard?: { writeText: (s: string) => Promise<void> } }) : undefined
      if (nav?.share) { await nav.share({ text: message, title }); return 'shared' }
      if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(message); return 'copied' }
      return 'failed'
    }
    const res = await Share.share(title ? { message, title } : { message })
    return res.action === Share.sharedAction ? 'shared' : 'failed'
  } catch {
    return 'failed'
  }
}
