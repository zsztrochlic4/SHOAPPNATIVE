/**
 * Onboarding draft persistence (audit F-019 / J-04): the questionnaire's
 * answers and position survive an app reload or OS-terminated background.
 * Versioned; stale drafts (older than DRAFT_MAX_AGE_MS) are discarded so a
 * months-old half-attempt doesn't resurrect. Anonymous-scoped — onboarding is
 * the pre-auth front door, and the answers migrate into the account slot with
 * the store's identity hand-off on sign-up.
 */

export interface OnboardingDraft {
  version: 1
  answers: Record<string, unknown>
  index: number
  savedAt: number
}

const DRAFT_KEY = 'sho.onboarding.draft.v1'
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Pure validity decision (unit-testable). */
export function draftUsable(draft: unknown, nowMs: number): draft is OnboardingDraft {
  const d = draft as OnboardingDraft | null
  if (!d || d.version !== 1) return false
  if (typeof d.index !== 'number' || d.index < 0) return false
  if (!d.answers || typeof d.answers !== 'object') return false
  if (!Number.isFinite(d.savedAt) || nowMs - d.savedAt > DRAFT_MAX_AGE_MS) return false
  return true
}

async function storage() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
  return AsyncStorage
}

export async function saveOnboardingDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await (await storage()).setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* best-effort */
  }
}

export async function loadOnboardingDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await (await storage()).getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return draftUsable(parsed, Date.now()) ? parsed : null
  } catch {
    return null
  }
}

export async function clearOnboardingDraft(): Promise<void> {
  try {
    await (await storage()).removeItem(DRAFT_KEY)
  } catch {
    /* best-effort */
  }
}
