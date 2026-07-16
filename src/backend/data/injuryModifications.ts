/**
 * GENERATED from workbook sheet "Injury Modifications" via SheetJS. Do not hand-edit.
 * Source of truth is the workbook / CLEAN csv.
 */
import type { InjuryModRow } from './types'

export const INJURY_MODIFICATIONS: InjuryModRow[] = [
  {
    "region": "lower_back",
    "matchesStressRegion": "lower_back",
    "avoidPatterns": "Hinge (heavy), loaded spinal flexion/rotation under load",
    "prefer": "Supported=Yes, machine and chest-supported variations, hip-dominant work without spinal load",
    "rirBump": 1,
    "excludeIds": [
      "BK01",
      "BK10",
      "BK02",
      "SH01",
      "CO06"
    ],
    "downgradeIds": [
      "HG01",
      "BK12",
      "BK13",
      "QD01",
      "QD06",
      "HG07",
      "HG08",
      "FB01",
      "FB02",
      "FB07",
      "FB11",
      "CO14"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "The big free-weight hinges and standing barbell work come out first. Keep training the muscles through supported and machine options: chest-supported rows, leg press, hip thrust, back extension held short of end range."
  },
  {
    "region": "knee",
    "matchesStressRegion": "knee",
    "avoidPatterns": "Deep knee flexion under load, high-impact jumping, plyometrics",
    "prefer": "Supported=Yes, machine leg work, partial-range and hip-dominant options, Impact=Low only",
    "rirBump": 1,
    "excludeIds": [
      "QD13",
      "FB03",
      "FB08",
      "FB10",
      "HG06"
    ],
    "downgradeIds": [
      "QD01",
      "QD06",
      "QD03",
      "QD04",
      "QD08",
      "QD11",
      "QD10",
      "QD14",
      "FB05",
      "FB06",
      "FB09"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "Cut jumping and deep loaded squats. Keep quads and hamstrings via leg press in a comfortable range, leg extension and curl machines, and hinge patterns that spare the knee."
  },
  {
    "region": "shoulder",
    "matchesStressRegion": "shoulder",
    "avoidPatterns": "Overhead pressing, wide-grip and deep pressing, behind-neck work",
    "prefer": "Neutral-grip and supported presses, rows over overhead work, partial range, Impact=Low",
    "rirBump": 1,
    "excludeIds": [
      "SH01",
      "SH08",
      "CH10",
      "BI05"
    ],
    "downgradeIds": [
      "SH02",
      "SH07",
      "SH11",
      "CH01",
      "CH09",
      "CH03",
      "TR01",
      "TR05",
      "TR06",
      "BK04",
      "FB03",
      "FB04",
      "FB09"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "Overhead and heavy flat pressing come out first. Keep chest and shoulders through neutral-grip dumbbell presses, machine presses in a pain-free range, and plenty of pulling. Rear-delt and rotator-friendly work is encouraged."
  },
  {
    "region": "wrist",
    "matchesStressRegion": "wrist",
    "avoidPatterns": "Loaded wrist extension, straight-bar pressing and curling, push-up positions",
    "prefer": "Neutral-grip and machine options, straps or handles that keep the wrist neutral, avoid full weight-bearing on the hand",
    "rirBump": 1,
    "excludeIds": [
      "CH04",
      "TR06",
      "SH08"
    ],
    "downgradeIds": [
      "CH01",
      "CH09",
      "TR01",
      "SH01",
      "BI01",
      "TR05"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "Take out push-up positions and straight-bar work that force wrist extension. Machines, neutral-grip dumbbells and cables let the user keep training with a neutral wrist."
  },
  {
    "region": "hip",
    "matchesStressRegion": "hip",
    "avoidPatterns": "Deep hip flexion under load, wide stance, explosive hinging",
    "prefer": "Supported and machine work, moderate range, controlled tempo, Impact=Low",
    "rirBump": 1,
    "excludeIds": [
      "QD13",
      "FB01",
      "FB11",
      "FB08"
    ],
    "downgradeIds": [
      "QD01",
      "QD06",
      "HG01",
      "HG07",
      "HG08",
      "QD03",
      "QD04",
      "QD11",
      "HG13"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "Cut explosive and deep-range hip work. Keep legs and glutes through machine and supported options in a comfortable range, and single-leg work only if pain-free."
  },
  {
    "region": "ankle",
    "matchesStressRegion": "ankle",
    "avoidPatterns": "High-impact jumping, hopping, running-based conditioning",
    "prefer": "Low-impact conditioning (bike, rower, swim), seated calf work, stable-stance lifts",
    "rirBump": 1,
    "excludeIds": [
      "CA04",
      "FB03",
      "FB08",
      "FB10",
      "QD13"
    ],
    "downgradeIds": [
      "QD03",
      "QD04",
      "QD08",
      "QD11",
      "FB05",
      "FB06",
      "CA01",
      "CA03"
    ],
    "reviewAfter": "4 weeks",
    "coachNote": "Remove jumping and running-based conditioning. Swap to bike or rower for cardio, seated calf raises, and lifts taken from a stable stance. Standing calf and lunges return once pain-free."
  }
]
