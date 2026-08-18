/**
 * Community content moderation — the blocklist half (the report/triage half lives
 * in functions/src/communityModeration.ts). PURE and firebase-free so the SAME
 * code screens text on the client (instant feedback while typing) and on the
 * server (authoritative — the callable rejects blocked text even if a client
 * bypasses the UI). Synced into functions via functions/scripts/sync-shared.mjs.
 *
 * Two jobs:
 *   1. Reserved handles — block impersonation of the app/staff (admin, official,
 *      strengthhub, support …). Whole-name match for usernames; token match inside
 *      group names ("StrengthHub Official").
 *   2. Offensive language — profanity + slurs in usernames and group names.
 *
 * The false-positive trap (the "Scunthorpe problem"): naive substring matching
 * flags innocent words (class, assassin, analysis, Penistone). We avoid it by
 * matching the broad word list on WORD BOUNDARIES (separators preserved), and only
 * a small, unambiguous set of hard slurs on the fully-stripped string (so
 * separator/leet evasion like "s.l.u.r" is still caught). The unit test pins both
 * the catches and a list of must-pass innocent names.
 *
 * The lists are a sensible STARTER set, not exhaustive. The owner extends them as
 * real reports come in; adding a term is a one-line change here (re-synced on the
 * next functions build). Kept deliberately small and readable over comprehensive.
 */

export type ScreenResult = { ok: true } | { ok: false; reason: string }

/** Handles nobody may take — impersonation / confusion of the app or its staff.
 *  Single source of truth (simulate.ts and both callables defer to this). */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'coach', 'official', 'staff',
  'support', 'help', 'team', 'strengthhub', 'strengthhubonline', 'sho', 'shoapp',
  'system', 'root', 'owner', 'null', 'undefined', 'me', 'you', 'anonymous', 'deleted',
])

/** Leetspeak / homoglyph folding so "sh1t", "a$$", "f4g" normalise to letters.
 *  Applied before BOTH matching passes. */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', '$': 's', '!': 'i', '+': 't', '(': 'c', '|': 'i',
}

/** Lowercase + fold leet, char by char. Preserves separators for tokenising. */
function foldChars(raw: string): string {
  const lowered = raw.toLowerCase()
  let out = ''
  for (const ch of lowered) out += LEET[ch] ?? ch
  return out
}

/** Split into folded alphanumeric tokens, each with runs of 3+ identical chars
 *  collapsed to one ("faaaggot" → "faggot") so repeat-padding can't evade. */
function tokenize(raw: string): string[] {
  return foldChars(raw)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => t.replace(/(.)\1{2,}/g, '$1'))
}

/** SUBSTRING pass — slurs + unambiguous profanity matched anywhere WITHIN a token,
 *  so concatenated handles ("fuckyou", "pussylover") and leet evasion ("sh1tlord")
 *  are caught. A term here may only appear inside an innocent word if that word is
 *  in ALLOWLIST below. The unit test's must-pass list guards this. */
const SUBSTRING_BLOCK: readonly string[] = [
  // hard slurs
  'nigger', 'nigga', 'faggot', 'retard', 'chink', 'spic', 'kike', 'tranny',
  'coon', 'wetback', 'paki', 'kkk', 'goatse',
  // unambiguous profanity (not substrings of common words, save the allowlist)
  'fuck', 'shit', 'bullshit', 'bitch', 'asshole', 'arsehole', 'dickhead',
  'motherfucker', 'pussy', 'porn', 'whore', 'slut', 'wanker', 'jizz', 'nazi',
]

/** WHOLE-TOKEN pass — short, ambiguous roots that DO occur inside innocent words
 *  ("class"→ass, "analysis"→anal, "cockburn"→cock, "therapist"→rapist,
 *  "grape"→rape). Blocked only when they stand alone as a token, so the innocent
 *  words pass without needing an allowlist entry each. */
const WHOLE_TOKEN_BLOCK: ReadonlySet<string> = new Set([
  'ass', 'cunt', 'cock', 'dick', 'penis', 'vagina', 'sex', 'anal', 'cum',
  'tit', 'tits', 'boobs', 'rape', 'rapist', 'prick', 'twat', 'bastard', 'hitler',
])

/** Innocent words that legitimately CONTAIN a SUBSTRING_BLOCK term (matsushita /
 *  shiitake → "shit"). Checked per token before the substring pass. Extend as real
 *  false positives surface. */
const ALLOWLIST: ReadonlySet<string> = new Set(['matsushita', 'shiitake'])

/** Slurs that must still be caught when letters are spaced out ("n i g g e r").
 *  Applied only to runs of very short tokens, so real multi-word names
 *  ("Chin Kim") are not joined into a false hit. */
const HARD_SLURS: readonly string[] = [
  'nigger', 'nigga', 'faggot', 'chink', 'spic', 'kike', 'coon', 'paki', 'kkk',
]

function tokenIsProfane(tok: string): boolean {
  if (ALLOWLIST.has(tok)) return false
  if (WHOLE_TOKEN_BLOCK.has(tok)) return true
  for (const s of SUBSTRING_BLOCK) if (tok.includes(s)) return true
  return false
}

/** Join runs of consecutive ≤2-char tokens and test them for a spaced-out slur. */
function spacedSlurHit(toks: string[]): boolean {
  let run: string[] = []
  const flush = (): boolean => {
    if (run.length >= 3) {
      const joined = run.join('').replace(/(.)\1{2,}/g, '$1')
      if (HARD_SLURS.some((s) => joined.includes(s))) return true
    }
    run = []
    return false
  }
  for (const t of toks) {
    if (t.length <= 2) run.push(t)
    else if (flush()) return true
  }
  return flush()
}

/** Does this text contain profanity or a slur? */
export function containsProfanity(raw: string): boolean {
  const toks = tokenize(raw)
  if (toks.some(tokenIsProfane)) return true
  return spacedSlurHit(toks)
}

/** Screen a proposed USERNAME. Assumes the caller already validated format
 *  (length + charset). Returns a user-facing reason when blocked. */
export function screenUsername(raw: string): ScreenResult {
  const canonical = raw.trim().toLowerCase()
  if (RESERVED_HANDLES.has(canonical)) return { ok: false, reason: 'That username is reserved' }
  // A folded, separator-stripped exact match catches "admin_", "0fficial".
  if (RESERVED_HANDLES.has(tokenize(raw).join(''))) return { ok: false, reason: 'That username is reserved' }
  if (containsProfanity(raw)) return { ok: false, reason: 'Please choose a different username' }
  return { ok: true }
}

/** Reserved impersonation tokens blocked inside a GROUP NAME ("StrengthHub Support"). */
const GROUP_RESERVED_TOKENS: readonly string[] = ['strengthhub', 'admin', 'official', 'moderator', 'support', 'staff']

/** Screen a proposed GROUP NAME. Blocks profanity/slurs anywhere and reserved
 *  impersonation tokens appearing as a whole word. */
export function screenGroupName(raw: string): ScreenResult {
  if (containsProfanity(raw)) return { ok: false, reason: 'Please choose a different group name' }
  const toks = new Set(tokenize(raw))
  for (const token of GROUP_RESERVED_TOKENS) {
    if (toks.has(token)) return { ok: false, reason: 'Please choose a different group name' }
  }
  return { ok: true }
}
