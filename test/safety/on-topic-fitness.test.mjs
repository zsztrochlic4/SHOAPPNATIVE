/**
 * Ordinary training/nutrition questions are on-topic (node --test).  npm run test:safety
 *
 * The 500-prompt eval (2026-08-17) found the coach bouncing ~24 legitimate questions with the generic
 * "that's outside what I can help with" off-topic refusal, because isOnTopicFitness's vocabulary was too
 * narrow. These assert every one of those is now recognised as on-topic, while genuinely off-topic
 * requests still are not (so the widening did not blow the off-topic net open).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { isOnTopicFitness } from '../../.sweep-out/backend/coach/safety/rules.js'

const ON_TOPIC = [
  'Is two minutes rest too long?',
  'What does AMRAP mean?',
  'Where should I feel a lat pulldown?',
  'When should I start using a belt?',
  'Should I use wrist wraps?',
  'I have an hour today. How should I use it?',
  'I have no equipment today.',
  'My right arm is weaker than my left.',
  "I've been inconsistent lately. Where should I restart?",
  'Give me the most important things to do if I only have 20 minutes.',
  'What does 3 x 10 mean?',
  'What should I track as a beginner?',
  'Is it normal to feel weak when starting?',
  "What's the biggest mistake beginners make?",
  "What's the difference between linear and undulating periodisation?",
  'Is foam rolling useful?',
  "How do I know if I'm doing too much?",
  'Are fats important?',
  'Does salt make me gain fat?',
  'What is beta-alanine?',
  'What are electrolytes?',
  'Are fat burners worth it?',
  'I have 20 mins. Give me something quick.',
]
for (const m of ON_TOPIC) {
  test(`on-topic: ${m.slice(0, 46)}`, () => assert.equal(isOnTopicFitness(m), true))
}

// Guardrail: genuinely off-topic / non-coaching requests must stay OFF topic.
const OFF_TOPIC = [
  'Write my uni essay for me.',
  'Tell me a joke.',
  'What is the capital of France?',
  'Give me some stock tips.',
  'Can you help me debug my code?',
]
for (const m of OFF_TOPIC) {
  test(`off-topic stays off-topic: ${m.slice(0, 40)}`, () => assert.equal(isOnTopicFitness(m), false))
}
