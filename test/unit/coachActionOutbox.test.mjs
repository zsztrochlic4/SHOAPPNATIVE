// Coach action-outcome outbox (audit R5-007): the durable-outbox merge that keeps a terminal
// outcome from being lost to a crash/offline window and converges on the latest state per action.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeOutcomeIntent } from '../../.sweep-out/lib/coachActionOutboxCore.js'

const intent = (actionId, outcome, queuedAt, reasonCode) => ({ actionId, outcome, queuedAt, ...(reasonCode ? { reasonCode } : {}) })

test('queues a new outcome', () => {
  const out = mergeOutcomeIntent([], intent('a1', 'applied', '1'))
  assert.equal(out.length, 1)
  assert.equal(out[0].actionId, 'a1')
})

test('a later terminal state supersedes the earlier queued one for the same action', () => {
  let list = mergeOutcomeIntent([], intent('a1', 'applied', '1'))
  list = mergeOutcomeIntent(list, intent('a1', 'rolled_back', '2'))
  assert.equal(list.length, 1, 'no duplicate entry for the same action')
  assert.equal(list[0].outcome, 'rolled_back', 'latest state wins')
})

test('distinct actions coexist', () => {
  let list = mergeOutcomeIntent([], intent('a1', 'applied', '1'))
  list = mergeOutcomeIntent(list, intent('a2', 'failed', '2', 'persist_failed'))
  assert.equal(list.length, 2)
  assert.deepEqual(list.map((e) => e.actionId).sort(), ['a1', 'a2'])
})

test('the outbox is bounded to the newest entries (runaway backstop)', () => {
  let list = []
  for (let i = 0; i < 10; i++) list = mergeOutcomeIntent(list, intent(`a${i}`, 'applied', String(i)), 3)
  assert.equal(list.length, 3)
  assert.deepEqual(list.map((e) => e.actionId), ['a7', 'a8', 'a9'])
})
