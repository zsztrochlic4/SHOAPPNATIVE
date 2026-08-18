// The community sync gate: demo accounts (frozen clock) must never post to the
// competitive backend, or their collapsed-onto-one-day sessions trip the server's
// `impossible_session_cadence` anti-cheat rule and get held off the ladder.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldPostCommunityStats } from '../../.sweep-out/community/syncGate.js'

test('real user, username claimed, backend on → posts', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: false }), true)
})

test('demo account never posts (frozen clock would trip impossible_session_cadence)', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: true }), false)
})

test('no username → does not post', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: false, demo: false }), false)
})

test('backend flag off → does not post', () => {
  assert.equal(shouldPostCommunityStats({ backendOn: false, hasUsername: true, demo: false }), false)
})

test('demo dominates even with username + backend on', () => {
  // The whole point: an onboarded, username-claimed demo must still be excluded.
  assert.equal(shouldPostCommunityStats({ backendOn: true, hasUsername: true, demo: true }), false)
})
