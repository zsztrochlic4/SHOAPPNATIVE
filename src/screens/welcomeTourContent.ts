/**
 * Pure content model for the first-run Welcome tour (see screens/WelcomeTour.tsx).
 *
 * Kept free of React Native imports so the personalisation — first name, goal phrase,
 * training days, and their fallbacks — is unit-testable in isolation. The visual card
 * (colours, icons, motion) lives in WelcomeTour.tsx; this only decides the copy.
 */
import type { Goal } from '../store/types'

export type WelcomeStep = {
  kicker: string
  title: string
  lead: string
  secondary?: string
}

/** The user's onboarding goal → the phrase used in the Train card title. */
export const GOAL_PHRASE: Record<Goal, string> = {
  'build-muscle': 'building muscle',
  'lose-fat': 'losing fat',
  'gain-strength': 'getting stronger',
  'stay-healthy': 'getting fitter',
}

/** First token of a full name, trimmed. Empty string when there's nothing usable. */
export function firstNameFrom(name: string | undefined | null): string {
  return (name || '').trim().split(/\s+/)[0] || ''
}

export type WelcomeTourInput = {
  name?: string | null
  goal?: Goal
  daysPerWeek?: number
}

/**
 * Build the four tour steps, personalised from the user's onboarding answers. Every
 * personalised line has a safe fallback so a missing name / goal / day count never
 * leaves a blank or a broken sentence.
 */
export function buildWelcomeSteps({ name, goal, daysPerWeek }: WelcomeTourInput): WelcomeStep[] {
  const firstName = firstNameFrom(name)
  const goalPhrase = goal ? GOAL_PHRASE[goal] : undefined
  const daysValid = typeof daysPerWeek === 'number' && Number.isInteger(daysPerWeek) && daysPerWeek >= 1 && daysPerWeek <= 7

  const welcomeTitle = firstName ? `${firstName}, you're all set!` : `You're all set!`
  const trainTitle =
    goalPhrase && daysValid ? `Built for ${goalPhrase}, ${daysPerWeek} days a week` : 'Your program, ready to go'

  return [
    {
      kicker: 'WELCOME',
      title: welcomeTitle,
      lead: 'Training, food, and progress in one place, all built around your life.',
    },
    {
      kicker: 'TRAIN',
      title: trainTitle,
      lead: 'Tap an exercise to watch the demo. Mark each set complete as you go.',
      secondary: 'Your coach is one tap away whenever you need help.',
    },
    {
      kicker: 'NUTRITION',
      title: 'Eat well without tracking your meals',
      lead: 'Choose from 300 simple recipes and ask your coach for nutrition tips whenever you need them.',
    },
    {
      kicker: 'COMMUNITY',
      title: 'Train with friends',
      lead: 'Join a group and keep your streak going.',
      secondary: 'The weekly leaderboard is based on effort and consistency.',
    },
  ]
}
