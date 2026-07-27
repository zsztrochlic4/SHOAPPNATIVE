/**
 * Extract and evaluate a top-level `export const NAME: T[] = [ ... ]` array literal from a TS source
 * file, without a TypeScript build. Used by validate-data-sync.mjs to read the static exercise/meal
 * datasets (which are plain data modules) as real JS objects.
 *
 * The array literal is located by bracket-matching (string- and comment-aware) and evaluated as a JS
 * expression via `new Function`, with an optional `scope` of identifiers the literal references
 * (e.g. the `img` image map in catalog.ts). This is trusted, in-repo source — not untrusted input.
 */

/** Find `[ ... ]` for `export const <name>`; returns the literal string including the brackets. */
export function extractArrayLiteral(source, name) {
  const decl = new RegExp(`export\\s+const\\s+${name}\\b[^=]*=\\s*\\[`)
  const m = source.match(decl)
  if (!m) throw new Error(`export const ${name} = [...] not found`)
  const open = source.indexOf('[', m.index + m[0].length - 1)
  let depth = 0
  let i = open
  let str = null // current string delimiter, or null
  for (; i < source.length; i++) {
    const ch = source[i]
    const prev = source[i - 1]
    if (str) {
      if (ch === str && prev !== '\\') str = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      str = ch
      continue
    }
    if (ch === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i)
      if (i === -1) i = source.length
      continue
    }
    if (ch === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 1
      continue
    }
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return source.slice(open, i + 1)
    }
  }
  throw new Error(`unbalanced array literal for ${name}`)
}

/** Evaluate an array literal string as JS, injecting `scope` identifiers by name. */
export function evalArrayLiteral(literal, scope = {}) {
  const names = Object.keys(scope)
  const fn = new Function(...names, `"use strict"; return (${literal});`)
  return fn(...names.map((n) => scope[n]))
}

/** Convenience: extract + evaluate in one call. */
export function loadArray(source, name, scope = {}) {
  return evalArrayLiteral(extractArrayLiteral(source, name), scope)
}

/** An `img`-like stub: any property access returns a stable placeholder string. */
export const imgStub = new Proxy({}, { get: (_t, prop) => `img:${String(prop)}` })
