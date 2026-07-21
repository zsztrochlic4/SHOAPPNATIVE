import { createContext, useContext } from 'react'

export type Overlay =
  | 'notifications'
  | 'settings'
  | 'activeWorkout'
  | 'createSession'
  | 'customize'
  | 'logWeight'
  | 'logHabit'
  | 'logActivity'
  | 'createPost'
  | 'recap'
  | 'leaderboard'
  | 'photos'
  | 'quick'
  | 'badges'
  | 'examMode'
  | 'coach'
  | 'coachChat'
  | 'beginner'
  | 'budgetEats'
  | 'exerciseDetail'
  | 'partnerMatch'
  | 'prCelebration'
  | 'postDetail'
  | 'challengeDetail'

export type NavCtx = {
  open: (o: Overlay, params?: Record<string, unknown>) => void
  close: () => void
  goTab: (t: 'dashboard' | 'workout' | 'nutrition' | 'progress' | 'community') => void
  /** Full-screen side menu, layered under sheets so items return to it. */
  menuOpen: boolean
  openMenu: () => void
  closeMenu: () => void
}

const Ctx = createContext<NavCtx | null>(null)
export const NavProvider = Ctx.Provider

export function useNav() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useNav must be used within NavProvider')
  return c
}
