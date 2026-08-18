// Community content moderation (blocklist). Verifies the shared screen used on
// BOTH the client and the claimUsername/createGroup callables: it catches
// profanity, slurs (incl. leet/separator evasion) and reserved impersonation
// handles, while NOT flagging innocent names (the "Scunthorpe problem"). The
// must-pass list is the important half — a false positive blocks a real user.
//   npm run test:unit
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  screenUsername,
  screenGroupName,
  containsProfanity,
  RESERVED_HANDLES,
} from '../../.sweep-out/community/contentModeration.js'

/* --- innocent names MUST pass (no false positives) --- */
const INNOCENT = [
  'scunthorpe', 'penistone', 'assassin', 'class', 'classic', 'analysis', 'grape',
  'shiitake', 'cockburn', 'therapist', 'matsushita', 'dickens', 'cummings',
  'lifter42', 'strong_sam', 'benchpressbeth', 'squatqueen', 'run4fun', 'coco',
]
test('innocent usernames are allowed', () => {
  for (const name of INNOCENT) {
    assert.equal(screenUsername(name).ok, true, `false positive on username "${name}"`)
  }
})
test('innocent group names are allowed', () => {
  for (const name of ['Scunthorpe Lifters', 'The Assassins', 'Analysis Crew', 'Class of 2020', 'Cockburn Barbell']) {
    assert.equal(screenGroupName(name).ok, true, `false positive on group "${name}"`)
  }
})

/* --- offensive content MUST be blocked --- */
test('profane usernames are blocked', () => {
  for (const name of ['fuckyou', 'sh1t_lord', 'a55hole', 'b1tch', 'pussylover', 'pornking']) {
    assert.equal(screenUsername(name).ok, false, `missed profanity in "${name}"`)
  }
})
test('slurs are blocked incl. leet/separator evasion', () => {
  for (const name of ['n1gger', 'f4ggot', 'ret4rd', 'faaaggot']) {
    assert.equal(containsProfanity(name), true, `missed slur in "${name}"`)
    assert.equal(screenUsername(name).ok, false)
  }
})
test('profane group names are blocked', () => {
  for (const name of ['Fuck Squad', 'The Sh1t Show', 'Bitch Lifters']) {
    assert.equal(screenGroupName(name).ok, false, `missed profanity in group "${name}"`)
  }
})

/* --- reserved impersonation handles MUST be blocked --- */
test('reserved handles are blocked', () => {
  for (const name of ['admin', 'moderator', 'official', 'strengthhub', 'support', '0fficial', 'admin__']) {
    assert.equal(screenUsername(name).ok, false, `reserved handle "${name}" was allowed`)
  }
})
test('reserved impersonation tokens in group names are blocked', () => {
  for (const name of ['StrengthHub Official', 'Admin Team', 'Support Desk']) {
    assert.equal(screenGroupName(name).ok, false, `impersonation group "${name}" was allowed`)
  }
})
test('RESERVED_HANDLES is the shared source of truth', () => {
  assert.equal(RESERVED_HANDLES.has('admin'), true)
  assert.equal(RESERVED_HANDLES.has('strengthhub'), true)
})
