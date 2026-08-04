/**
 * Group join codes. Short and easy to read aloud / type on a phone, but drawn
 * from a strong random source so they aren't guessable in practice.
 *
 * The alphabet omits visually ambiguous characters (0/O, 1/I/L) so a code shared
 * verbally or in a screenshot can't be mistyped. Six characters over a 30-symbol
 * alphabet is ~30^6 ≈ 7.3e8 combinations — ample against guessing for a private
 * friend group, while staying tap-friendly.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no O,0,I,1,L
const CODE_LEN = 6

/** Fill `out` with cryptographically strong random bytes when available, else
 *  fall back to Math.random (still fine for a non-security-critical share code). */
function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n)
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) {
    c.getRandomValues(out)
    return out
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

/** A fresh, uppercase, unambiguous 6-character join code (e.g. "W7K2QP"). */
export function generatePasscode(): string {
  // Rejection-free mapping: mask each byte into the alphabet range. The slight
  // modulo bias over 256→31 is irrelevant for a share code.
  const bytes = randomBytes(CODE_LEN)
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
  return code
}

/** Normalise a user-entered code for comparison: uppercase and drop everything
 *  that isn't a letter or digit, so "lift 88" / "lift88" both match "LIFT88".
 *  (Generated codes never contain the ambiguous 0/O/1/I/L symbols, so no
 *  look-alike folding is needed — only case and stray spacing.) */
export function normalizePasscode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** True when two codes are equal under normalisation. */
export function passcodeMatches(a: string, b: string): boolean {
  return normalizePasscode(a) === normalizePasscode(b)
}
