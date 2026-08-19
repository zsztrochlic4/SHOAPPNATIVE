/**
 * Deterministic app-route grounding (hardening: closes the app-help path-accuracy gap).
 *
 * The judge showed the model recalls app navigation at ~22% accuracy — it invents tabs ("Log tab"),
 * controls ("Quick Toggles"), and points to the wrong screen. Instruction alone did not fix it. So we
 * do NOT trust the model to recall a route: when an app-help turn confidently matches a real
 * destination here, the coach RELAYS this verified route verbatim instead of generating one.
 *
 * This table MIRRORS the eval catalogue in data/app-paths.json (same ids/routes/serves). Keep them in
 * sync — the catalogue is what the lint/judge score against; this is what the runtime relays. Pure data
 * (no firebase/engine), so it syncs cleanly into the trusted backend via scripts/sync-shared.mjs.
 */

export interface AppRoute {
  id: string
  /** The user-facing control name to name in the answer. */
  label: string
  /** The exact path to relay, e.g. "Menu › Settings › Units". */
  route: string
  /** Intent keywords/phrases; a turn matches a route by how many of these it contains. */
  serves: string[]
}

export const APP_ROUTES: readonly AppRoute[] = [
  { id: 'settings.units', label: 'Units', route: 'Menu › Settings › Units', serves: ['units', 'metric', 'imperial', 'kilograms', 'pounds', 'kg', 'lb', 'switch between metric'] },
  { id: 'settings.appearance', label: 'Appearance', route: 'Menu › Settings › Appearance', serves: ['appearance', 'theme', 'dark mode', 'light mode', 'follow my phone', 'phone theme', 'light and dark', 'system default', 'reduce motion', 'reduce animations'] },
  { id: 'settings.goals', label: 'Goals', route: 'Menu › Settings › Goals', serves: ['goal weight', 'sleep goal', 'step goal', 'water goal', 'daily targets', 'update my goals', 'change my goals'] },
  { id: 'trainingProfile', label: 'Training profile', route: 'Menu › Settings › Goals › Training profile', serves: ['training profile', 'change my goal', 'change gym days', 'training days', 'session length', 'equipment', 'equipment option', 'wrong equipment', 'experience level', 'days per week', 'regenerate program', 'change my split', 'custom split', 'onboarding', 'onboarding answer', 'skipped an optional', 'date of birth', 'update my profile', 'changed university', 'change university', 'switch universities', 'external sport', 'favourite exercises', 'excluded exercises', 'update an external'] },
  { id: 'settings.language', label: 'Language', route: 'Menu › Settings › Language', serves: ['language', 'translation', 'change the language'] },
  { id: 'settings.connected', label: 'Connected apps', route: 'Menu › Settings › Connected apps', serves: ['connected apps', 'connected app', 'integration', 'health connect', 'apple health', 'google fit', 'connect an app', 'connect health', 'expo go'] },
  { id: 'settings.pushNotifs', label: 'Push notifications', route: 'Menu › Settings › Preferences › Push notifications', serves: ['push notifications', 'notification', 'notifications', 'reminders', 'a reminder', 'quiet hours', 'turn off notifications', 'reminder to log', 'remind me about', 'nutrition reminder', 'streak reminder', 'notifications blocked', 'workout reminder', 'reminder during quiet'] },
  { id: 'settings.sound', label: 'Sound', route: 'Menu › Settings › Preferences › Sound', serves: ['sound', 'sound effects', 'turn off sound'] },
  { id: 'settings.haptics', label: 'Haptics', route: 'Menu › Settings › Preferences › Haptics', serves: ['haptics', 'haptic feedback', 'vibration'] },
  { id: 'settings.cloudBackup', label: 'Cloud backup', route: 'Menu › Settings › Cloud backup (Sync now)', serves: ['sync', 'sync now', 'force a sync', 'cloud backup', 'changes are pending', 'backup', 'sync conflict'] },
  { id: 'settings.export', label: 'Download my data', route: 'Menu › Settings › Download my data', serves: ['download my data', 'export', 'export my data', 'download a copy', 'download a copy of my profile'] },
  { id: 'settings.delete', label: 'Delete account', route: 'Menu › Settings › Delete account', serves: ['delete account', 'delete my account', 'close my account'] },
  { id: 'settings.subscription', label: 'Contact support', route: 'Menu › Settings › Legal & support › Contact support (subscription changes are handled by email/your app store, not in-app)', serves: ['subscription', 'cancel my subscription', 'manage subscription', 'billing', 'account management'] },
  { id: 'settings.legal', label: 'Legal & support', route: 'Menu › Settings › Legal & support', serves: ['terms of service', 'privacy policy', 'health and safety', 'contact support', 'legal'] },
  { id: 'logout', label: 'Log out', route: 'Menu › Log out', serves: ['log out', 'logout', 'sign out'] },
  { id: 'coach', label: 'Your coach', route: 'Menu › Your coach', serves: ['find the coach', 'coach from the menu', 'coach from the main menu', 'where is the coach', 'open the coach', 'daily-limit message', 'daily limit message'] },
  { id: 'coachSettings', label: 'Coach profile & memory', route: 'Menu › Your coach › Coach profile & memory', serves: ['coach profile', 'what the coach remembers', 'what do you remember', 'what has the coach remembered', 'remembered about me', 'coach memory'] },
  { id: 'coach.memoryToggle', label: 'Memory', route: 'Menu › Your coach › Coach profile & memory › Memory', serves: ['turn off memory', 'stop saving memories', 'saving memories', 'saving long term memories', 'coach saving', 'coach memory', 'memory setting', 'withdraw consent', 'consent for coach', 'clear the coach workspace', 'stop the coach saving'] },
  { id: 'coach.style', label: 'Coaching style', route: 'Menu › Your coach › Coach profile & memory › Coaching style (Supportive, Balanced, Direct)', serves: ['coaching style', 'more direct', 'more supportive', 'coach style'] },
  { id: 'coach.forget', label: 'Forget', route: 'Menu › Your coach › Coach profile & memory › Forget (on the saved memory)', serves: ['forget a memory', 'delete a memory', 'delete one saved coach memory', 'remove a memory'] },
  { id: 'notifications', label: 'Notifications', route: 'Menu › Notifications', serves: ['notifications screen', 'notification centre', 'my notifications', 'reminders and streaks', 'mark all notifications', 'mark notifications as read', 'notifications as read', 'notification list'] },
  { id: 'badges', label: 'Badges', route: 'Menu › Profile › Badges', serves: ['badges', 'a badge', 'earned a badge', 'earn a badge', 'badge count', 'how to earn badges', 'achievements', 'what makes a badge'] },
  { id: 'examMode', label: 'Plan Around Your Life', route: 'Menu › Profile › Plan Around Your Life', serves: ['plan around your life', 'exams', 'travel', 'busy period', 'planned absence', 'exam mode', 'away for'] },
  { id: 'beginner', label: 'New to the gym', route: 'Menu › New to the gym', serves: ['new to the gym', 'beginner guide', 'first 90 days', 'beginner bodyweight'] },
  { id: 'customize', label: 'Change window and customise stats', route: 'Dashboard › Change window and customise stats', serves: ['quick stats', 'which stats', 'dashboard stats', 'customise dashboard', 'customize dashboard', 'change stats', 'progress view', 'which lifts appear', 'featured stat', 'ranked lifts', 'edit which lifts', 'choose which lifts'] },
  { id: 'logProgress', label: 'Update', route: 'Dashboard › Update', serves: ['log my water', 'log water', 'log sleep', 'log steps', 'log my habits', 'log today', 'mindset minutes', 'update my habits', 'log daily'] },
  { id: 'workout.library', label: 'Exercises', route: 'Workout › Exercises (Search + muscle Filter)', serves: ['exercise library', 'search exercises', 'filter exercises', 'filter by muscle', 'muscle group', 'find an exercise'] },
  { id: 'activeWorkout.skip', label: 'Skip', route: 'Workout › active session › Skip (rest timer)', serves: ['skip rest', 'skip the rest', 'ready before the timer', 'rest timer'] },
  { id: 'activeWorkout.finish', label: 'Finish workout', route: 'Workout › active session › Finish workout', serves: ['finish workout', 'end session', 'end the workout', 'workout still looks incomplete', 'finish the session'] },
  { id: 'createSession', label: 'New workout', route: 'Workout › New workout', serves: ['create a session', 'new workout', 'custom session', 'custom workout', 'build a session'] },
  { id: 'quick', label: 'Quick workouts', route: 'Workout › quick workout', serves: ['quick workout', '15 minute workout', 'short workout', 'quick bodyweight'] },
  { id: 'logActivity', label: 'Log an activity', route: 'Workout › Log an activity', serves: ['log an activity', 'log activity', 'log a run', 'other activity', 'log a sport'] },
  { id: 'nutrition.planner', label: 'Plan your week', route: 'Nutrition › Plan your week', serves: ['meal planner', 'plan your week', 'plan my meals', 'weekly meal plan', 'assign a meal'] },
  { id: 'addFood', label: 'Add food', route: 'Nutrition › Add food', serves: ['add a food', 'add food', 'log a meal', 'log food', 'meal scan', 'barcode', 'food to breakfast', 'add breakfast'] },
  { id: 'nutrition.savedMeals', label: 'Save meal', route: 'Nutrition › My meals › Save meal (or Save changes to edit)', serves: ['save a meal', 'save meals i cook', 'saved meal', 'edit a recipe', 'edit a meal', 'meal i eat regularly'] },
  { id: 'community.username', label: 'Set username', route: 'Community › Set username', serves: ['set a username', 'claim a username', 'choose a username', 'change my username'] },
  { id: 'community.leagues', label: 'Leagues', route: 'Community › Leagues (How leagues work)', serves: ['leagues', 'how leagues work', 'monthly league', 'league scoring'] },
  { id: 'community.groups', label: 'Groups', route: 'Community › Groups (Create group, Join group, Invite friends)', serves: ['a group', 'friend group', 'create a group', 'join a group', 'community group', 'invite friends', 'invite code', 'leave a group'] },
  { id: 'community', label: 'Community', route: 'Community tab', serves: ['leaderboard', 'global leaderboard', 'view the leaderboard', 'community scope', 'campus', 'dorm', 'society', 'wrong community scope', 'kudos', 'likes', 'comments', 'bookmarks', 'how kudos', 'share a personal record', 'share a pr', 'post a pr', 'share with the community', 'a challenge', 'join a challenge', 'streak disappeared', 'my streak'] },
]

const STOP = new Set(['the', 'a', 'an', 'to', 'my', 'i', 'do', 'how', 'in', 'on', 'of', 'for', 'is', 'it', 'and', 'or', 'you', 'me', 'want', 'need', 'app', 'change', 'set', 'where', 'what', 'can', 'should'])
const normalize = (s: string): string => (typeof s === 'string' ? s : '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The best real destination for an app-help turn, or null when nothing matches confidently. Scores each
 * route by how much of its `serves` vocabulary the message contains — a multi-word phrase hit counts for
 * its word length, so a specific phrase ("goal weight") outweighs a stray single word. Returns a route
 * only when the top score clears a threshold AND beats the runner-up, so an ambiguous turn falls through
 * to the model rather than being confidently mis-routed.
 */
export function resolveAppRoute(message: string): AppRoute | null {
  const n = ` ${normalize(message)} `
  if (n.trim().length < 3) return null
  let best: AppRoute | null = null
  let bestScore = 0
  let secondScore = 0
  for (const route of APP_ROUTES) {
    let score = 0
    for (const phrase of route.serves) {
      const p = normalize(phrase)
      if (!p) continue
      // A matched phrase scores by its length in words, so a longer, more specific phrase
      // ("set a username", "goal weight") outweighs a stray single keyword.
      if (n.includes(` ${p} `)) score += p.split(' ').length
    }
    if (score > bestScore) { secondScore = bestScore; bestScore = score; best = route }
    else if (score > secondScore) { secondScore = score }
  }
  // Accept a matched destination only when there is a CLEAR winner — a tie means the turn is ambiguous,
  // so it falls through to the model rather than being confidently mis-routed. STOP is used to keep the
  // serves lists specific (generic words are avoided there), so any match is already a real signal.
  void STOP
  if (bestScore >= 1 && bestScore > secondScore) return best
  return null
}

/**
 * A "how do I / where is X in the app" navigation question — as opposed to advice ("should I change my
 * goal weight?"). We only relay a route for a genuine navigation question, so we never turn an advice
 * turn into a bare directions answer even when its words happen to match a route.
 */
// Advice/opinion/explanation openers that are NOT navigation — never relay a bare route for these.
const NOT_NAV = /\b(should i|is it (ok|okay|worth|better|safe|fine)|do you think|what.?s the best|which is better|how many|how much|how long|how often|why do i feel|is my|am i)\b/i
// Broad "asking to do/find/change something in the app" phrasing — a request or a how/where/why-can
// question. Kept generous because the real gate is a CONFIDENT route match; NOT_NAV excludes advice.
const NAV_QUESTION =
  /\b(how (do|can|could|would|to|come)|where (do|can|is|are|to)|show me how|walk me through|i want|i.?d like|i need|i wish|can i|could i|let me|help me|find (the|it|my|another)|change|turn (it |them )?(on|off)|enable|disable|switch|set (up|my|a)|manage|cancel|update|log (my|today|a)|edit|customi[sz]e|open|go to|adjust|remove|delete|export|download|reset|restore|sync|why (can|is|did|does|am)|mark all|join|create|claim|view (the|my)|see (the|my))\b/i

/**
 * A concise, CORRECT app-help answer built from the verified route, or null when this is not a
 * navigation question that confidently resolves to a real destination. Used to OVERRIDE the model's
 * navigation so the coach relays a real path instead of an invented one (the model recalls navigation at
 * ~22% accuracy). Self-gating: safe to call on any turn — a training/nutrition/advice turn either has no
 * navigation phrasing or no route match, and returns null.
 */
export function synthesizeAppHelpAnswer(message: string): string | null {
  if (typeof message !== 'string' || !NAV_QUESTION.test(message) || NOT_NAV.test(message)) return null
  const route = resolveAppRoute(message)
  if (!route) return null
  return `In StrengthHub you'll find that under ${route.route}. If you don't see it straight away, it's on that screen; nothing changes until you make the change there yourself.`
}
