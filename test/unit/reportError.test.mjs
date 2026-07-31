// The crash-reporting seam: a registered reporter receives errors, reporting
// never throws (even with a broken reporter), and clearing detaches it.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { reportError, setErrorReporter } from '../../.sweep-out/lib/reportError.js'

// Silence the expected console.error noise from reportError during these tests.
const origError = console.error
test.before(() => {
  console.error = () => {}
})
test.after(() => {
  console.error = origError
  setErrorReporter(null)
})

test('a registered reporter receives the error and context', () => {
  const seen = []
  setErrorReporter((err, ctx) => seen.push({ err, ctx }))
  const boom = new Error('boom')
  reportError(boom, { boundary: 'test' })
  assert.equal(seen.length, 1)
  assert.equal(seen[0].err, boom)
  assert.deepEqual(seen[0].ctx, { boundary: 'test' })
})

test('reporting never throws when the reporter itself throws', () => {
  setErrorReporter(() => {
    throw new Error('reporter is broken')
  })
  assert.doesNotThrow(() => reportError(new Error('x')))
})

test('clearing the reporter detaches it', () => {
  let calls = 0
  setErrorReporter(() => calls++)
  reportError(new Error('a'))
  setErrorReporter(null)
  reportError(new Error('b'))
  assert.equal(calls, 1)
})
