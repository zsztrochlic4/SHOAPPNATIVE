/**
 * GENERATED from workbook sheet "Custom Split Resolution" via SheetJS. Do not hand-edit.
 * Source of truth is the workbook / CLEAN csv.
 */
import type { CustomSplitRow } from './types'

export const CUSTOM_SPLIT_RESOLUTION: CustomSplitRow[] = [
  {
    "daysPerWeek": 2,
    "userRequest": "none / balanced",
    "resolvedDayStructure": [
      "Full",
      "Full"
    ],
    "note": "Two days is always full body. Nothing to bias."
  },
  {
    "daysPerWeek": 3,
    "userRequest": "none / balanced",
    "resolvedDayStructure": [
      "Full",
      "Full",
      "Full"
    ],
    "note": "Default 3-day. Everything 3x if beginner, or PPL by preference."
  },
  {
    "daysPerWeek": 3,
    "userRequest": "legs once",
    "resolvedDayStructure": [
      "Upper",
      "Push",
      "Lower"
    ],
    "note": "One lower day, two upper-focused days. Legs hit once, directly."
  },
  {
    "daysPerWeek": 3,
    "userRequest": "upper once / legs focus",
    "resolvedDayStructure": [
      "Lower",
      "Upper",
      "Lower"
    ],
    "note": "Two lower days, one upper day. Upper muscles hit once, legs twice."
  },
  {
    "daysPerWeek": 3,
    "userRequest": "push emphasis",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Lower"
    ],
    "note": "One of each, push gets the freshest day."
  },
  {
    "daysPerWeek": 4,
    "userRequest": "none / balanced",
    "resolvedDayStructure": [
      "Upper",
      "Lower",
      "Upper",
      "Lower"
    ],
    "note": "Default 4-day. Everything twice."
  },
  {
    "daysPerWeek": 4,
    "userRequest": "legs once",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Upper",
      "Lower"
    ],
    "note": "One lower day, three upper-focused days. Legs hit once, upper muscles twice or more."
  },
  {
    "daysPerWeek": 4,
    "userRequest": "upper once / legs focus",
    "resolvedDayStructure": [
      "Lower",
      "Lower",
      "Push",
      "Pull"
    ],
    "note": "Two lower days plus push and pull. Legs emphasised."
  },
  {
    "daysPerWeek": 4,
    "userRequest": "push/pull preference (2 push 1 pull 1 leg)",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Push",
      "Lower"
    ],
    "note": "Honours a push-biased week with legs still once."
  },
  {
    "daysPerWeek": 5,
    "userRequest": "none / balanced",
    "resolvedDayStructure": [
      "Upper",
      "Lower",
      "Upper",
      "Lower",
      "Focus"
    ],
    "note": "Default 5-day with a focal day."
  },
  {
    "daysPerWeek": 5,
    "userRequest": "legs once",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Upper",
      "Focus",
      "Lower"
    ],
    "note": "One lower day, upper volume spread across four days."
  },
  {
    "daysPerWeek": 5,
    "userRequest": "legs focus",
    "resolvedDayStructure": [
      "Lower",
      "Upper",
      "Lower",
      "Push",
      "Pull"
    ],
    "note": "Two lower days across five."
  },
  {
    "daysPerWeek": 6,
    "userRequest": "none / balanced",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Legs",
      "Push",
      "Pull",
      "Legs"
    ],
    "note": "Default 6-day PPL, everything twice."
  },
  {
    "daysPerWeek": 6,
    "userRequest": "legs once",
    "resolvedDayStructure": [
      "Push",
      "Pull",
      "Upper",
      "Push",
      "Pull",
      "Lower"
    ],
    "note": "Legs once across six days, everything else high frequency."
  }
]
