// GENERATED FILE — do not edit by hand.
// Source: data/quick-workouts/8x12min.xlsx
// Regenerate: npm run workouts:build
// 8 workouts (beginner → advanced): Full-Body Starter [Beginner] · Legs & Glutes [Beginner] · Recovery & Reset [Beginner] · Upper Body & Core [Intermediate] · Posterior Chain Strength [Intermediate] · Core Control [Intermediate] · Conditioning Circuit [Intermediate] · Intermediate Challenge [Intermediate]
import type { QuickWorkout } from '../store/types'

export const QUICK_WORKOUTS_SEED: QuickWorkout[] = [
  {
    "id": "BW12-01",
    "name": "Full-Body Starter",
    "level": "Beginner",
    "order": 1,
    "focus": "Beginner full-body strength and posture",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-02",
    "name": "Legs & Glutes",
    "level": "Beginner",
    "order": 2,
    "focus": "Lower-body strength and endurance",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "QD04",
            "name": "Walking Lunge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "5-6 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "QD12",
            "name": "Wall Sit",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "17 sec/side",
            "perSide": true
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "QD04",
            "name": "Walking Lunge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "5-6 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "QD12",
            "name": "Wall Sit",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "17 sec/side",
            "perSide": true
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "QD04",
            "name": "Walking Lunge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "5-6 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "QD09",
            "name": "Bodyweight Squat",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "QD12",
            "name": "Wall Sit",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 35,
            "restSec": 15,
            "repHint": "17 sec/side",
            "perSide": true
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-04",
    "name": "Recovery & Reset",
    "level": "Beginner",
    "order": 3,
    "focus": "Low-intensity movement, posture and core control",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CO12",
            "name": "Bird Dog",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 35,
            "restSec": 15
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CO12",
            "name": "Bird Dog",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 35,
            "restSec": 15
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "CO12",
            "name": "Bird Dog",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "HG03",
            "name": "Glute Bridge",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "BK18",
            "name": "Prone Reverse Snow Angel",
            "workSec": 35,
            "restSec": 15
          },
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 35,
            "restSec": 15
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-03",
    "name": "Upper Body & Core",
    "level": "Intermediate",
    "order": 4,
    "focus": "Balanced pushing, pulling and core strength",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "BK17",
            "name": "Seated Towel Row Isometric",
            "workSec": 40,
            "restSec": 10,
            "repHint": "3 x 10 sec holds"
          },
          {
            "exerciseId": "SH08",
            "name": "Pike Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "BK17",
            "name": "Seated Towel Row Isometric",
            "workSec": 40,
            "restSec": 10,
            "repHint": "3 x 10 sec holds"
          },
          {
            "exerciseId": "SH08",
            "name": "Pike Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "CH04",
            "name": "Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "BK17",
            "name": "Seated Towel Row Isometric",
            "workSec": 40,
            "restSec": 10,
            "repHint": "3 x 10 sec holds"
          },
          {
            "exerciseId": "SH08",
            "name": "Pike Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-05",
    "name": "Posterior Chain Strength",
    "level": "Intermediate",
    "order": 5,
    "focus": "Hamstrings, glutes, back and posture",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "HG07",
            "name": "Single Leg Romanian Deadlift",
            "workSec": 40,
            "restSec": 10,
            "repHint": "5 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "BK16",
            "name": "Prone Lat Pull-Down",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "HG07",
            "name": "Single Leg Romanian Deadlift",
            "workSec": 40,
            "restSec": 10,
            "repHint": "5 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "BK16",
            "name": "Prone Lat Pull-Down",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "HG07",
            "name": "Single Leg Romanian Deadlift",
            "workSec": 40,
            "restSec": 10,
            "repHint": "5 reps/side",
            "perSide": true
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "HG11",
            "name": "Single Leg Glute Bridge",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "BK16",
            "name": "Prone Lat Pull-Down",
            "workSec": 40,
            "restSec": 10
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-06",
    "name": "Core Control",
    "level": "Intermediate",
    "order": 6,
    "focus": "Core strength and trunk control",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO07",
            "name": "Side Plank",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "CO09",
            "name": "Reverse Crunch",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO07",
            "name": "Side Plank",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "CO09",
            "name": "Reverse Crunch",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "CO02",
            "name": "Dead Bug",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO07",
            "name": "Side Plank",
            "workSec": 40,
            "restSec": 10,
            "repHint": "20 sec/side",
            "perSide": true
          },
          {
            "exerciseId": "CO09",
            "name": "Reverse Crunch",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO01",
            "name": "Plank",
            "workSec": 40,
            "restSec": 10
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-07",
    "name": "Conditioning Circuit",
    "level": "Intermediate",
    "order": 7,
    "focus": "Cardio and full-body conditioning",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "FB08",
            "name": "Jumping Jack",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB10",
            "name": "High Knees",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB04",
            "name": "Mountain Climber",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB09",
            "name": "Bear Crawl",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "FB08",
            "name": "Jumping Jack",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB10",
            "name": "High Knees",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB04",
            "name": "Mountain Climber",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB09",
            "name": "Bear Crawl",
            "workSec": 40,
            "restSec": 10
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "FB08",
            "name": "Jumping Jack",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB10",
            "name": "High Knees",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB04",
            "name": "Mountain Climber",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "FB09",
            "name": "Bear Crawl",
            "workSec": 40,
            "restSec": 10
          }
        ]
      }
    ]
  },
  {
    "id": "BW12-08",
    "name": "Intermediate Challenge",
    "level": "Intermediate",
    "order": 8,
    "focus": "Strength, power, posterior chain and core",
    "minutes": 12,
    "rounds": [
      {
        "round": 1,
        "build": true,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CH12",
            "name": "Feet Elevated Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "QD13",
            "name": "Jump Squat",
            "workSec": 35,
            "restSec": 10,
            "repHint": "6-8 reps"
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO11",
            "name": "Hollow Body Hold",
            "workSec": 45,
            "restSec": 10
          }
        ]
      },
      {
        "round": 2,
        "roundRestSec": 60,
        "stations": [
          {
            "exerciseId": "CH12",
            "name": "Feet Elevated Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "QD13",
            "name": "Jump Squat",
            "workSec": 35,
            "restSec": 10,
            "repHint": "6-8 reps"
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO11",
            "name": "Hollow Body Hold",
            "workSec": 45,
            "restSec": 10
          }
        ]
      },
      {
        "round": 3,
        "stations": [
          {
            "exerciseId": "CH12",
            "name": "Feet Elevated Push Up",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "QD13",
            "name": "Jump Squat",
            "workSec": 35,
            "restSec": 10,
            "repHint": "6-8 reps"
          },
          {
            "exerciseId": "HG14",
            "name": "Slider Hamstring Curl",
            "workSec": 40,
            "restSec": 10
          },
          {
            "exerciseId": "CO11",
            "name": "Hollow Body Hold",
            "workSec": 45,
            "restSec": 10
          }
        ]
      }
    ]
  }
]
