/**
 * GENERATED from workbook sheet "External Commitments" via SheetJS. Do not hand-edit.
 * Source of truth is the workbook / CLEAN csv.
 */
import type { CommitmentRow } from './types'

export const EXTERNAL_COMMITMENTS: CommitmentRow[] = [
  {
    "commitmentType": "basketball",
    "examples": "Basketball, netball, volleyball",
    "loadProfile": [
      "lower_body_impact",
      "conditioning"
    ],
    "volumeCutMuscles": [
      "Quads",
      "Hamstrings & Glutes"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 4,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Never place a Legs or Lower day within adjacency_block_hours either side of the commitment."
  },
  {
    "commitmentType": "football",
    "examples": "Soccer, AFL, rugby, touch",
    "loadProfile": [
      "lower_body_impact",
      "conditioning",
      "contact"
    ],
    "volumeCutMuscles": [
      "Quads",
      "Hamstrings & Glutes"
    ],
    "volumeCutSetsMin": 3,
    "volumeCutSetsMax": 4,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 2,
    "rirPenaltyNextDay": 1,
    "notes": "Removes all standalone Interval work. The day after a match runs at rir_min plus rir_penalty_next_day."
  },
  {
    "commitmentType": "running",
    "examples": "Running, park run, athletics",
    "loadProfile": [
      "lower_body_impact",
      "conditioning"
    ],
    "volumeCutMuscles": [
      "Quads",
      "Hamstrings & Glutes"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 4,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Adjacency applies to hard or long runs only. Easy runs need no adjustment beyond the Interval slot removal."
  },
  {
    "commitmentType": "racquet",
    "examples": "Tennis, badminton, squash",
    "loadProfile": [
      "lower_body_impact",
      "unilateral",
      "conditioning"
    ],
    "volumeCutMuscles": [
      "Quads",
      "Hamstrings & Glutes"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 2,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "No extra rotation core work in commitment weeks, the sport supplies it."
  },
  {
    "commitmentType": "swimming",
    "examples": "Swimming, water polo",
    "loadProfile": [
      "full_body",
      "low_impact_conditioning"
    ],
    "volumeCutMuscles": [],
    "volumeCutSetsMin": 0,
    "volumeCutSetsMax": 0,
    "adjacencyBlockHours": 0,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Low impact, low recovery cost. Only the Interval slot removal applies."
  },
  {
    "commitmentType": "cycling",
    "examples": "Cycling, spin classes",
    "loadProfile": [
      "lower_body",
      "low_impact_conditioning"
    ],
    "volumeCutMuscles": [
      "Quads"
    ],
    "volumeCutSetsMin": 0,
    "volumeCutSetsMax": 2,
    "adjacencyBlockHours": 0,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Cut Quads sets only when riding is hard or hilly, otherwise zero."
  },
  {
    "commitmentType": "climbing",
    "examples": "Climbing, bouldering",
    "loadProfile": [
      "upper_pull",
      "grip"
    ],
    "volumeCutMuscles": [
      "Back",
      "Biceps"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 4,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 0,
    "rirPenaltyNextDay": 0,
    "notes": "Never place a Pull day within adjacency_block_hours. Grip heavy exercises (deadlifts, carries, rows) move away from climbing days. Counts as half an Interval session, round down."
  },
  {
    "commitmentType": "martial_arts",
    "examples": "Martial arts, boxing, BJJ",
    "loadProfile": [
      "full_body",
      "conditioning",
      "contact"
    ],
    "volumeCutMuscles": [
      "user_reported"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 2,
    "adjacencyBlockHours": 0,
    "intervalSlotsRemoved": 2,
    "rirPenaltyNextDay": 1,
    "notes": "Removes all standalone Interval work. Volume cut applies to whichever muscle the user reports as most worked."
  },
  {
    "commitmentType": "dance",
    "examples": "Dance, cheer, gymnastics",
    "loadProfile": [
      "full_body",
      "lower_body_impact"
    ],
    "volumeCutMuscles": [
      "Quads",
      "Hamstrings & Glutes"
    ],
    "volumeCutSetsMin": 2,
    "volumeCutSetsMax": 2,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Adjacency applies before performances and hard rehearsals."
  },
  {
    "commitmentType": "physical_job",
    "examples": "Hospitality, labouring, retail on feet",
    "loadProfile": [
      "chronic_low_load"
    ],
    "volumeCutMuscles": [],
    "volumeCutSetsMin": 0,
    "volumeCutSetsMax": 0,
    "adjacencyBlockHours": 0,
    "intervalSlotsRemoved": 0,
    "rirPenaltyNextDay": 0,
    "notes": "Start weekly volume at the bottom of the goal's range. Apply F03 after long shifts the user flags."
  },
  {
    "commitmentType": "social_sport",
    "examples": "Casual grade, under 1 hour, low intensity",
    "loadProfile": [
      "light_activity"
    ],
    "volumeCutMuscles": [],
    "volumeCutSetsMin": 0,
    "volumeCutSetsMax": 0,
    "adjacencyBlockHours": 0,
    "intervalSlotsRemoved": 0,
    "rirPenaltyNextDay": 0,
    "notes": "Counts toward general activity only. No adjustment."
  },
  {
    "commitmentType": "other",
    "examples": "Anything not listed",
    "loadProfile": [
      "unknown"
    ],
    "volumeCutMuscles": [
      "user_reported"
    ],
    "volumeCutSetsMin": 0,
    "volumeCutSetsMax": 2,
    "adjacencyBlockHours": 24,
    "intervalSlotsRemoved": 1,
    "rirPenaltyNextDay": 0,
    "notes": "Default: treat as full body conditioning, ask the user which muscles it works, then reclassify into a row above."
  }
]
