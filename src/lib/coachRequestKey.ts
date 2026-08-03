/**
 * Idempotency key for a coach turn (audit SA-011).
 *
 * The client generates ONE key per distinct user message and reuses it on every
 * retry of that message, so the server (functions/src/coach.ts) can dedupe: a
 * retry returns the first turn's result instead of triggering a second Gemini
 * call, usage increment and stored turn. Format matches the server validator in
 * src/backend/coach/requestControls.ts (isValidRequestKey).
 */
export function newCoachRequestKey(): string {
  // No crypto.randomUUID guarantee across RN engines — compose time + entropy.
  const rand = Math.random().toString(36).slice(2, 10)
  const rand2 = Math.random().toString(36).slice(2, 10)
  return `req-${Date.now().toString(36)}-${rand}${rand2}`
}
