/**
 * GENERATED from workbook sheet "Exercise Database" via SheetJS. Do not hand-edit.
 * Source of truth is the workbook / CLEAN csv.
 */
import type { Exercise } from './types'

export const EXERCISES: Exercise[] = [
  {
    "id": "CH01",
    "name": "Barbell Bench Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major, anterior delt, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, bench",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH02",
      "CH05",
      "CH09",
      "CH03",
      "TR01",
      "CH10",
      "CH12",
      "CH04",
      "CH11",
      "CH07"
    ],
    "substitutionCount": 10,
    "bodyRegion": "upper",
    "whyInDatabase": "The benchmark horizontal press. Loads heavily and progresses in small increments, so it anchors any strength block and gives a clean lift to track over a semester.",
    "whatItDoes": "A flat barbell press that builds raw pushing strength across the chest, shoulders and triceps.",
    "steps": [
      "Set up with your eyes under the bar and your shoulder blades pulled down and back",
      "Lower the bar to your mid chest with elbows around 45 degrees",
      "Press it back up over your shoulders and keep your ribs down"
    ],
    "commonMistake": "Bouncing the bar off your chest and letting your shoulders roll forward.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Dumbbell Bench Press if form breaks down."
  },
  {
    "id": "CH02",
    "name": "Dumbbell Bench Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major, anterior delt, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, bench",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH05",
      "CH01",
      "CH03",
      "CH12",
      "CH04",
      "CH11",
      "CH07",
      "CH06"
    ],
    "substitutionCount": 8,
    "bodyRegion": "upper",
    "whyInDatabase": "Safer than the barbell for a lifter training alone, allows a deeper stretch, and forces each side to work independently. Ideal default press for new users.",
    "whatItDoes": "A flat dumbbell press that builds the chest with a deeper stretch and even effort on both sides.",
    "steps": [
      "Lie back holding the dumbbells at chest height, wrists stacked over elbows",
      "Lower until your upper arms are level with your torso",
      "Press up and slightly together without clashing the dumbbells"
    ],
    "commonMistake": "Dropping the elbows too low and straining the front of the shoulder.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Machine Chest Press if form breaks down."
  },
  {
    "id": "CH03",
    "name": "Incline Dumbbell Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Upper pectoralis, anterior delt",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, incline bench",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "incline_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH09",
      "CH02",
      "CH05",
      "CH01",
      "CH12",
      "CH04",
      "CH11",
      "CH06"
    ],
    "substitutionCount": 8,
    "bodyRegion": "upper",
    "whyInDatabase": "Biases the upper chest, which is usually the lagging region in students who mostly do flat pressing. Covers a gap the flat press leaves.",
    "whatItDoes": "An inclined dumbbell press that targets the upper chest and front shoulders.",
    "steps": [
      "Set the bench to about 30 degrees and hold the dumbbells at chest height",
      "Lower slowly until you feel a stretch across the upper chest",
      "Press up over your collarbones, not over your face"
    ],
    "commonMistake": "Setting the bench too steep so it turns into a shoulder press.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Incline Barbell Bench Press if form breaks down."
  },
  {
    "id": "CH04",
    "name": "Push Up",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major, triceps, anterior delt",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH11",
      "CH12",
      "CH05",
      "CH02",
      "CH01",
      "TR06",
      "CH07"
    ],
    "substitutionCount": 7,
    "bodyRegion": "upper",
    "whyInDatabase": "Zero equipment, infinitely regressable to knees or a bench and progressable to feet elevated. This is the fallback chest press for dorm and travel workouts.",
    "whatItDoes": "A bodyweight press that trains the chest, triceps and core with no equipment at all.",
    "steps": [
      "Set hands slightly wider than your shoulders, body in one straight line",
      "Lower your chest to just above the floor with elbows tucked to 45 degrees",
      "Press back up and squeeze your glutes the whole time"
    ],
    "commonMistake": "Letting the hips sag so the lower back does the work.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Incline Push Up."
  },
  {
    "id": "CH05",
    "name": "Machine Chest Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Chest press machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_chest_press"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH02",
      "CH01",
      "CH03",
      "CH04",
      "CH11",
      "CH06"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "Fixed path removes the balance requirement, so a nervous first timer can still train close to failure safely. High compliance for absolute beginners.",
    "whatItDoes": "A guided chest press that lets you push hard with almost no balance or setup required.",
    "steps": [
      "Set the seat so the handles sit level with your mid chest",
      "Press out until your arms are almost straight",
      "Return under control until you feel a stretch, then repeat"
    ],
    "commonMistake": "Setting the seat too high and turning it into an awkward shoulder press.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dumbbell Bench Press."
  },
  {
    "id": "CH06",
    "name": "Cable Chest Fly",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Fly"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH07",
      "CH05",
      "CH02",
      "CH04",
      "CH11"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Constant tension through the full range and a resisted stretch at the bottom. Adds chest volume without further loading the triceps or shoulders.",
    "whatItDoes": "A cable fly that keeps constant tension on the chest through the full range.",
    "steps": [
      "Set the pulleys around chest height and take a small split stance",
      "Bring your hands together in front of your chest with a soft elbow bend",
      "Open your arms slowly until you feel a stretch, then repeat"
    ],
    "commonMistake": "Bending and straightening the elbows so it becomes a press.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dumbbell Chest Fly."
  },
  {
    "id": "CH07",
    "name": "Dumbbell Chest Fly",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Fly"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, bench",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH06",
      "CH05",
      "CH02",
      "CH04",
      "CH11"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The cable fly substitute when no cable stack exists. Keeps a pure adduction pattern available in home and hotel gyms.",
    "whatItDoes": "A dumbbell fly that stretches the chest under load and adds volume without heavy pressing.",
    "steps": [
      "Lie back holding dumbbells above your chest with elbows slightly bent",
      "Open your arms out wide until your chest stretches",
      "Bring the dumbbells back together over your chest"
    ],
    "commonMistake": "Going too heavy and dropping the arms past a comfortable stretch.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Cable Chest Fly."
  },
  {
    "id": "CH08",
    "name": "Dip (Chest Lean)",
    "muscleGroup": "Chest",
    "primaryMuscles": "Lower pectoralis, triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dip bars or parallel bars",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dip_bars"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "CH12",
      "CH02",
      "CH05",
      "CH10",
      "CH04",
      "TR05",
      "CH11"
    ],
    "substitutionCount": 7,
    "bodyRegion": "upper",
    "whyInDatabase": "One of the few bodyweight pressing patterns that loads the lower chest hard. Scales for years by adding a belt, which suits advanced users.",
    "whatItDoes": "A bodyweight dip with a forward lean that hits the lower chest hard.",
    "steps": [
      "Support yourself on the bars with straight arms and lean your chest forward",
      "Lower until your upper arms are roughly parallel to the floor",
      "Press back up, keeping the forward lean the whole rep"
    ],
    "commonMistake": "Dropping too deep and letting the shoulders shrug up around the ears.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Feet Elevated Push Up instead."
  },
  {
    "id": "CH09",
    "name": "Incline Barbell Bench Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Upper pectoralis, anterior delt, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, incline bench",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "incline_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH03",
      "CH01",
      "CH02",
      "CH05",
      "CH04",
      "CH11"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "Loads the upper chest heavier than the dumbbell version and progresses in small plate increments. This is the upper chest lift that can headline a strength block rather than fill volume.",
    "whatItDoes": "An inclined barbell press that loads the upper chest heavier than any dumbbell version.",
    "steps": [
      "Set the bench to about 30 degrees and grip just outside shoulder width",
      "Lower the bar to your upper chest with the elbows tucked slightly",
      "Press back up over your collarbones"
    ],
    "commonMistake": "Flaring the elbows straight out and putting the load on the shoulder joint.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Incline Dumbbell Press if form breaks down."
  },
  {
    "id": "CH10",
    "name": "Decline Barbell Bench Press",
    "muscleGroup": "Chest",
    "primaryMuscles": "Lower pectoralis, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, decline bench",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "decline_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH01",
      "CH02",
      "CH08",
      "CH05",
      "CH12",
      "CH04"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "Shortest range of the three bench angles, so the heaviest loads and the lowest shoulder stress. Included as a pressing variation and a shoulder friendly option, though the chest lean dip covers similar ground without a decline bench.",
    "whatItDoes": "A declined barbell press that shortens the range and emphasises the lower chest.",
    "steps": [
      "Lock your legs in and unrack the bar over your chest",
      "Lower the bar to the base of your chest",
      "Press straight back up without letting the bar drift toward your face"
    ],
    "commonMistake": "Getting up too fast after the set and feeling lightheaded.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Barbell Bench Press if form breaks down."
  },
  {
    "id": "CH11",
    "name": "Incline Push Up",
    "muscleGroup": "Chest",
    "primaryMuscles": "Pectoralis major, triceps, anterior delt",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bench, desk or wall",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "bench/desk/wall"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH04",
      "CH05",
      "CH02",
      "CH12",
      "CH07"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Gives the bodyweight tier a second horizontal press so the push up is not a single point of failure. Hand height sets the difficulty, so it regresses to a wall for a true beginner.",
    "whatItDoes": "An easier push up angle that lets beginners build pressing strength with clean form.",
    "steps": [
      "Put your hands on a bench, desk or wall and step your feet back",
      "Lower your chest to the surface with your body in one line",
      "Press back up without letting your hips drop"
    ],
    "commonMistake": "Picking a surface so high that the chest barely works.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Push Up."
  },
  {
    "id": "CH12",
    "name": "Feet Elevated Push Up",
    "muscleGroup": "Chest",
    "primaryMuscles": "Upper pectoralis, anterior delt, triceps",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Chest",
      "Press"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bench, chair or bed",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "bench/chair/bed"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "CH04",
      "CH11",
      "CH08",
      "CH02",
      "CH05"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The progression a bodyweight user hits once standard push ups get easy. Shifts load toward the upper chest and keeps the pattern challenging without any weight to add.",
    "whatItDoes": "A harder push up that shifts more bodyweight onto the chest and shoulders.",
    "steps": [
      "Put your feet on a bench or chair and set your hands under your shoulders",
      "Lower your chest toward the floor with the body in one straight line",
      "Press back up and keep your hips from sagging"
    ],
    "commonMistake": "Letting the hips pike up to make the rep easier.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Push Up."
  },
  {
    "id": "BK01",
    "name": "Conventional Deadlift",
    "muscleGroup": "Back",
    "primaryMuscles": "Erectors, lats, glutes, hamstrings",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Back",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, plates",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell",
      "plates"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "BK12",
      "BK10",
      "BK13",
      "HG01",
      "HG08",
      "HG02",
      "HG09",
      "HG07",
      "HG12"
    ],
    "substitutionCount": 9,
    "bodyRegion": "lower",
    "whyInDatabase": "The highest absolute load a person can move, and the best single test of posterior chain strength. Gated behind a technique check because the risk is real.",
    "whatItDoes": "The full body pull that loads the back, glutes and hamstrings heavier than anything else. Advanced users only.",
    "steps": [
      "Stand with the bar over your mid foot and grip just outside your shins",
      "Set your back flat, chest up, then push the floor away",
      "Stand tall, then lower the bar by pushing your hips back"
    ],
    "commonMistake": "Rounding the lower back and yanking the bar off the floor.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Trap Bar Deadlift instead."
  },
  {
    "id": "BK02",
    "name": "Barbell Bent Over Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, rhomboids, mid traps, rear delt",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back",
      "lower_back"
    ],
    "substitutionIds": [
      "BK08",
      "BK03",
      "BK06",
      "BK07",
      "BK14",
      "BK05"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "Heavy bilateral horizontal pull that builds mid back thickness while also training the hinge isometrically. Balances the bench press in any push and pull split.",
    "whatItDoes": "A heavy horizontal pull that builds thickness through the mid back.",
    "steps": [
      "Hinge forward until your torso is around 45 degrees, back flat",
      "Pull the bar to your lower ribs and squeeze your shoulder blades",
      "Lower under control until your arms are straight"
    ],
    "commonMistake": "Standing up on every rep and turning it into a shrug.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Chest Supported Dumbbell Row if form breaks down."
  },
  {
    "id": "BK03",
    "name": "Dumbbell Single Arm Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, rhomboids, mid traps",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbell, bench",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK08",
      "BK06",
      "BK02",
      "BK07",
      "BK14"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Chest supported by the free hand, so the lower back is spared. Unilateral loading exposes and fixes side to side imbalances early.",
    "whatItDoes": "A one arm row that lets you pull heavy with the chest supported and no lower back strain.",
    "steps": [
      "Brace one hand and knee on a bench with a flat back",
      "Pull the dumbbell to your hip, leading with the elbow",
      "Lower it all the way down until you feel the lat stretch"
    ],
    "commonMistake": "Twisting the torso to heave the weight up.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Chest Supported Dumbbell Row if form breaks down."
  },
  {
    "id": "BK04",
    "name": "Chin Up",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, biceps, teres major",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Back",
      "Vertical Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Pull up bar",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "pull_up_bar"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BK05",
      "BK15",
      "BK11",
      "BK07",
      "BK06",
      "BK08"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "The clearest strength milestone most students care about. Trains lats and biceps together and needs only a bar.",
    "whatItDoes": "The benchmark vertical pull for lat width and relative strength. Advanced users only.",
    "steps": [
      "Hang from the bar with palms facing you, hands shoulder width",
      "Pull your chest toward the bar and drive your elbows down",
      "Lower all the way to straight arms under control"
    ],
    "commonMistake": "Kipping with the legs instead of pulling with the back.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Lat Pulldown instead."
  },
  {
    "id": "BK05",
    "name": "Lat Pulldown",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, teres major, biceps",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Back",
      "Vertical Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Cable pulldown machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_lat_pulldown"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BK04",
      "BK15",
      "BK11",
      "BK09",
      "BK06",
      "BK08"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "The scalable stand in for the chin up. Lets a user who cannot yet do one pull up train the identical pattern with sub bodyweight load.",
    "whatItDoes": "A machine vertical pull that builds lat width at any strength level.",
    "steps": [
      "Set the thigh pad snug and grip the bar wider than your shoulders",
      "Pull the bar to your upper chest and drive your elbows down",
      "Let it rise slowly until your arms are straight"
    ],
    "commonMistake": "Leaning back hard and rowing instead of pulling down.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Chin Up."
  },
  {
    "id": "BK06",
    "name": "Seated Cable Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, rhomboids, mid traps",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Cable row machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_cable_row"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK08",
      "BK03",
      "BK02",
      "BK07",
      "BK14"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Constant tension horizontal pull with a supported spine. Safe to push near failure, which is where most back growth actually comes from.",
    "whatItDoes": "A seated cable row that builds the mid back with constant tension and a safe torso position.",
    "steps": [
      "Sit tall with a slight knee bend and grip the handle",
      "Pull the handle to your stomach, elbows close to your sides",
      "Let your arms straighten fully without slumping forward"
    ],
    "commonMistake": "Rocking the torso back and forth to move the stack.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Chest Supported Dumbbell Row."
  },
  {
    "id": "BK07",
    "name": "Inverted Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, rhomboids, rear delt",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bar, rings or table edge",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "low_bar/rings/sturdy_table"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK14",
      "BK08",
      "BK03",
      "BK06",
      "BI07"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The bodyweight horizontal pull. Difficulty is adjusted purely by foot position, which makes it the pulling counterpart to the push up.",
    "whatItDoes": "A bodyweight row that trains the whole back with nothing but a bar or a table edge.",
    "steps": [
      "Lie under a bar and grip it slightly wider than your shoulders",
      "Pull your chest to the bar with your body in one straight line",
      "Lower until your arms are straight"
    ],
    "commonMistake": "Letting the hips drop so the body sags instead of staying rigid.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Bent Over Row."
  },
  {
    "id": "BK08",
    "name": "Chest Supported Dumbbell Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Rhomboids, mid traps, rear delt",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, incline bench",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "incline_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK03",
      "BK06",
      "BK07",
      "BK14",
      "BK02"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Removes all momentum and lower back involvement, so the upper back does the work. Excellent for desk bound students with poor postural endurance.",
    "whatItDoes": "A supported dumbbell row that removes the lower back entirely and isolates the mid back.",
    "steps": [
      "Lie chest down on an incline bench with a dumbbell in each hand",
      "Row both dumbbells toward your hips, squeezing the shoulder blades",
      "Lower until the arms hang straight"
    ],
    "commonMistake": "Lifting the chest off the bench to help the weight up.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Dumbbell Single Arm Row if form breaks down."
  },
  {
    "id": "BK09",
    "name": "Straight Arm Pulldown",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Back",
      "Vertical Pull"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BK11",
      "BK05",
      "BK08",
      "BK06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Isolates the lats without the biceps limiting the set. Useful when arm fatigue is capping back volume.",
    "whatItDoes": "A straight arm pulldown that isolates the lats without the biceps taking over.",
    "steps": [
      "Stand a step back from a high pulley and hinge slightly forward",
      "With soft elbows, sweep the bar down to your thighs",
      "Let it rise back to head height and feel the lat stretch"
    ],
    "commonMistake": "Bending the elbows and turning it into a triceps pushdown.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Lat Pulldown."
  },
  {
    "id": "BK10",
    "name": "Rack Pull",
    "muscleGroup": "Back",
    "primaryMuscles": "Erectors, traps, glutes",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Back",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, rack",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell",
      "rack"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "BK12",
      "BK01",
      "HG01",
      "BK13",
      "HG09",
      "HG08"
    ],
    "substitutionCount": 6,
    "bodyRegion": "lower",
    "whyInDatabase": "Shortened range deadlift for users who lack the hip mobility or confidence to pull from the floor. Keeps heavy hinge loading available.",
    "whatItDoes": "A shortened deadlift from the rack that overloads the upper back and lockout.",
    "steps": [
      "Set the bar just below your knees and grip it outside your shins",
      "Set your back flat, chest tall, then stand up by driving your hips forward",
      "Lower the bar back to the pins under control"
    ],
    "commonMistake": "Hyperextending the lower back at the top of the lift.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Trap Bar Deadlift if form breaks down."
  },
  {
    "id": "BK11",
    "name": "Band Lat Pulldown",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, teres major, biceps",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Back",
      "Vertical Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band, anchor",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band",
      "anchor_point"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BK05",
      "BK15",
      "BK09",
      "BK07",
      "BK14"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The only sub bodyweight vertical pull that needs no machine. Without it, a home user who cannot yet do a chin up has no way to train the vertical pull at all.",
    "whatItDoes": "A banded pulldown that trains the lats when you have no bar, machine or gym.",
    "steps": [
      "Anchor a band overhead and kneel or stand facing it",
      "Pull your hands down toward your chest, elbows driving to your sides",
      "Let the band rise back up slowly"
    ],
    "commonMistake": "Using a band so light the back never actually works.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Lat Pulldown."
  },
  {
    "id": "SH01",
    "name": "Barbell Overhead Press",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Anterior delt, lateral delt, triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Shoulders",
      "Vertical Push"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "lower_back"
    ],
    "substitutionIds": [
      "SH02",
      "SH07",
      "SH11",
      "SH08",
      "SH03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The primary vertical press and the main progressable shoulder strength lift. Also trains bracing under load from a standing position.",
    "whatItDoes": "A standing barbell press that builds overhead strength and a braced, stable trunk.",
    "steps": [
      "Take the bar at collarbone height, hands just outside your shoulders",
      "Squeeze your glutes and press the bar overhead, moving your head back slightly",
      "Finish with the bar over the middle of your feet, then lower to your chest"
    ],
    "commonMistake": "Leaning back through the lower spine instead of bracing the core.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Seated Dumbbell Shoulder Press if form breaks down."
  },
  {
    "id": "SH02",
    "name": "Seated Dumbbell Shoulder Press",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Anterior delt, lateral delt, triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Shoulders",
      "Vertical Push"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, bench",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "SH07",
      "SH01",
      "SH11",
      "SH08",
      "SH03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Friendlier shoulder path than a barbell and no rack needed. The default overhead press for most user profiles.",
    "whatItDoes": "A seated overhead press that builds round, strong shoulders.",
    "steps": [
      "Start with the dumbbells at ear height",
      "Press up without shrugging",
      "Stop just short of locking out, then lower slowly"
    ],
    "commonMistake": "Leaning back and turning it into an incline press.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Arnold Press if form breaks down."
  },
  {
    "id": "SH03",
    "name": "Dumbbell Lateral Raise",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Lateral delt",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Shoulders",
      "Lateral Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder"
    ],
    "substitutionIds": [
      "SH04",
      "SH09",
      "SH02",
      "SH11"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The only exercise that truly targets the lateral delt, which no press hits well. Drives the shoulder width most aesthetic goals ask for.",
    "whatItDoes": "A raise that isolates the side delt and builds shoulder width.",
    "steps": [
      "Stand with dumbbells at your sides and a soft elbow bend",
      "Lift out to the sides until your hands reach shoulder height",
      "Lower slowly and stop the swing before the next rep"
    ],
    "commonMistake": "Going too heavy and swinging the weight up with the traps.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Cable Lateral Raise."
  },
  {
    "id": "SH04",
    "name": "Cable Lateral Raise",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Lateral delt",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Shoulders",
      "Lateral Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine",
    "skillLevel": "Intermediate",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder"
    ],
    "substitutionIds": [
      "SH03",
      "SH09",
      "SH07",
      "SH08"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Loads the bottom of the range where dumbbells are nearly weightless. A better stimulus per set once a user has a base.",
    "whatItDoes": "A cable side raise that keeps the side delt loaded even at the bottom of the rep.",
    "steps": [
      "Set the pulley low and grip the handle with the far hand",
      "Raise your arm out to the side up to shoulder height",
      "Lower slowly and fight the cable on the way down"
    ],
    "commonMistake": "Letting the arm drift forward so the front delt takes over.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dumbbell Lateral Raise."
  },
  {
    "id": "SH05",
    "name": "Rear Delt Fly",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Rear delt, rhomboids",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Shoulders",
      "Rear Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells or cables",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell/cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "SH12",
      "SH06",
      "SH10"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Directly opposes all the pressing volume in the program. Keeps the shoulder joint balanced and reduces impingement risk over a long block.",
    "whatItDoes": "A rear delt fly that balances out all the pressing you do and helps your posture.",
    "steps": [
      "Hinge forward with a flat back, arms hanging straight down",
      "Open your arms out wide with soft elbows",
      "Lower slowly and stay hinged the whole set"
    ],
    "commonMistake": "Using heavy weight and turning the fly into a row.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Pull Apart."
  },
  {
    "id": "SH06",
    "name": "Face Pull",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Rear delt, external rotators, mid traps",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Shoulders",
      "Rear Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine, rope",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine",
      "rope_attachment"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "SH05",
      "SH12",
      "SH10"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Trains external rotation and scapular retraction together. The single best insurance policy against shoulder pain in a high volume push program.",
    "whatItDoes": "A cable pull that hits the rear delts and upper back and helps undo desk posture.",
    "steps": [
      "Set a rope at head height and take a step back",
      "Pull the rope to your forehead, splitting your hands apart",
      "Let it return forward slowly"
    ],
    "commonMistake": "Setting the pulley too low so it turns into a face height row.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Rear Delt Fly."
  },
  {
    "id": "SH07",
    "name": "Arnold Press",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Anterior delt, lateral delt",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Shoulders",
      "Vertical Push"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "SH02",
      "SH01",
      "SH11",
      "SH08",
      "SH03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Adds rotation so the anterior and lateral heads both take load through a longer range. A pressing variation for users who need novelty to stay engaged.",
    "whatItDoes": "A rotating dumbbell press that hits the front and side delts in one movement.",
    "steps": [
      "Start with the dumbbells at chest height, palms facing you",
      "Rotate your palms out as you press overhead",
      "Reverse the rotation on the way back down"
    ],
    "commonMistake": "Rushing the rotation instead of turning smoothly through the press.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Seated Dumbbell Shoulder Press if form breaks down."
  },
  {
    "id": "SH08",
    "name": "Pike Push Up",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Anterior delt, triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Shoulders",
      "Vertical Push"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "SH11",
      "SH02",
      "SH07",
      "SH01",
      "SH09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The bodyweight vertical press. Keeps overhead pushing in the program when a user has no equipment at all.",
    "whatItDoes": "An overhead push up that builds shoulder strength with no weights.",
    "steps": [
      "Start in a push up, then walk your feet in so your hips point at the ceiling",
      "Lower the top of your head toward the floor between your hands",
      "Press back up until your arms are straight"
    ],
    "commonMistake": "Letting the hips drop so it becomes a normal push up.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Overhead Press."
  },
  {
    "id": "SH09",
    "name": "Band Lateral Raise",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Lateral delt",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Shoulders",
      "Lateral Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder"
    ],
    "substitutionIds": [
      "SH03",
      "SH04",
      "SH12",
      "SH08"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Closes the gap where a bodyweight beginner had no shoulder option at all, since the pike push up is intermediate. Bands load the lateral delt where bodyweight cannot.",
    "whatItDoes": "A banded side raise that trains shoulder width anywhere.",
    "steps": [
      "Stand on the band and hold the ends at your sides",
      "Raise your arms out to shoulder height against the band",
      "Lower slowly and keep tension the whole set"
    ],
    "commonMistake": "Shrugging the shoulders up as the band gets tight.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dumbbell Lateral Raise."
  },
  {
    "id": "SH10",
    "name": "Prone Y-T-W Raise",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Rear delt, mid traps, lower traps",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Shoulders",
      "Rear Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "SH12",
      "SH05",
      "SH06"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Floor based scapular and rear delt work with no kit at all. Directly counters the rounded shoulder posture students accumulate over a day of lectures and laptop work.",
    "whatItDoes": "A floor drill that wakes up the rear delts and mid back before or after training.",
    "steps": [
      "Lie face down with your arms overhead in a Y shape",
      "Lift your arms off the floor, then sweep them to a T, then a W",
      "Lower slowly and keep your neck relaxed"
    ],
    "commonMistake": "Cranking the neck up instead of lifting from the shoulder blades.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Pull Apart."
  },
  {
    "id": "QD01",
    "name": "Barbell Back Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes, adductors",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, rack",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "rack"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD06",
      "QD05",
      "QD02",
      "QD03",
      "QD11",
      "QD09",
      "QD08",
      "QD12"
    ],
    "substitutionCount": 8,
    "bodyRegion": "lower",
    "whyInDatabase": "The reference lower body strength lift. Nothing else loads the legs this heavily while training bracing and hip and knee extension together.",
    "whatItDoes": "The benchmark leg exercise. Loads the quads, glutes and whole body harder than anything else.",
    "steps": [
      "Set the bar on your upper back and step out with feet shoulder width",
      "Sit down between your hips, knees tracking over your toes",
      "Drive through your mid foot back to standing"
    ],
    "commonMistake": "Letting the chest collapse forward and the hips shoot up first.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Front Squat if form breaks down."
  },
  {
    "id": "QD02",
    "name": "Goblet Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbell or kettlebell",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell/kettlebell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD01",
      "QD05",
      "QD09",
      "QD11",
      "QD08",
      "QD12"
    ],
    "substitutionCount": 6,
    "bodyRegion": "lower",
    "whyInDatabase": "The teaching squat. The front load naturally corrects torso position, so a beginner learns depth and posture without a coach present.",
    "whatItDoes": "A front loaded squat that teaches good depth and position almost automatically.",
    "steps": [
      "Hold a dumbbell against your chest with both hands",
      "Squat down between your hips, keeping your chest tall",
      "Stand back up and squeeze your glutes at the top"
    ],
    "commonMistake": "Rounding the upper back as the weight pulls you forward.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Barbell Back Squat if form breaks down."
  },
  {
    "id": "QD03",
    "name": "Bulgarian Split Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Lunge",
    "substitutionGroup": [
      "Quads",
      "Lunge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, bench",
    "skillLevel": "Intermediate",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "ankle"
    ],
    "substitutionIds": [
      "QD11",
      "QD04",
      "QD08",
      "QD02",
      "QD05"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Brutal quad and glute stimulus from light loads, which matters when a home user only owns 12kg dumbbells. Also exposes imbalances.",
    "whatItDoes": "A rear foot elevated split squat that hammers one leg at a time with light weight.",
    "steps": [
      "Put your back foot on a bench and set your front foot well forward",
      "Lower straight down until your back knee is just off the floor",
      "Drive through your front foot to stand back up"
    ],
    "commonMistake": "Standing too close to the bench so the front knee jams forward.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Split Squat if form breaks down."
  },
  {
    "id": "QD04",
    "name": "Walking Lunge",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Lunge",
    "substitutionGroup": [
      "Quads",
      "Lunge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Optional dumbbells",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Fat Loss",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [
      "dumbbell"
    ],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "ankle"
    ],
    "substitutionIds": [
      "QD11",
      "QD08",
      "QD03",
      "QD09",
      "QD02"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Trains single leg strength, balance and conditioning at once. Bodyweight version needs no equipment and raises heart rate fast.",
    "whatItDoes": "A moving lunge that builds legs, balance and conditioning at once.",
    "steps": [
      "Step forward into a long stride",
      "Lower your back knee toward the floor, torso tall",
      "Drive through the front foot and step straight into the next rep"
    ],
    "commonMistake": "Taking short steps so the front knee travels far past the toes.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Split Squat if form breaks down."
  },
  {
    "id": "QD05",
    "name": "Leg Press",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Leg press machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_leg_press"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD01",
      "QD02",
      "QD03",
      "QD09",
      "QD12"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Heavy quad loading with a supported spine. Lets a user train legs hard on days when fatigue or a back issue rules out squatting.",
    "whatItDoes": "A machine squat pattern that lets you push heavy with zero balance demand.",
    "steps": [
      "Set your feet mid platform, shoulder width apart",
      "Lower the sled until your knees reach around 90 degrees",
      "Press back up without locking the knees out hard"
    ],
    "commonMistake": "Letting the lower back round off the pad at the bottom.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Barbell Back Squat."
  },
  {
    "id": "QD06",
    "name": "Front Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, upper back",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, rack",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "rack"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD02",
      "QD01",
      "QD05",
      "QD03",
      "QD09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Shifts load onto the quads and forces an upright torso. A useful squat variation for users whose back squat is limited by hip mobility.",
    "whatItDoes": "A front racked squat that keeps you upright and loads the quads hardest. Advanced users only.",
    "steps": [
      "Rack the bar on your front delts with your elbows high",
      "Squat straight down, keeping your elbows up the whole way",
      "Drive up through your mid foot"
    ],
    "commonMistake": "Letting the elbows drop, which dumps the bar forward.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Goblet Squat instead."
  },
  {
    "id": "QD07",
    "name": "Leg Extension",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, rectus femoris",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Quads",
      "Knee Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Leg extension machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_leg_extension"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee"
    ],
    "substitutionIds": [
      "QD14",
      "QD10",
      "QD05",
      "QD09",
      "QD12"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "The only common movement that trains the rectus femoris with the hip extended. Adds quad volume without any systemic fatigue.",
    "whatItDoes": "A machine isolation that targets the quads directly with no fatigue anywhere else.",
    "steps": [
      "Set the pad on your lower shin and sit back into the seat",
      "Straighten your legs and pause briefly at the top",
      "Lower under control without letting the weight slam"
    ],
    "commonMistake": "Swinging the weight up with momentum from the hips.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Sissy Squat."
  },
  {
    "id": "QD08",
    "name": "Step Up",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Lunge",
    "substitutionGroup": [
      "Quads",
      "Lunge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bench or box, optional dumbbells",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "bench/box/step"
    ],
    "optionalEquipmentTags": [
      "dumbbell"
    ],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "ankle"
    ],
    "substitutionIds": [
      "QD11",
      "QD04",
      "QD03",
      "QD09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Low skill, low impact and highly transferable to stairs and daily life. A safe entry point to single leg training for deconditioned users.",
    "whatItDoes": "A step up that builds single leg strength and carries straight over to stairs and sport.",
    "steps": [
      "Place one foot fully on a box around knee height",
      "Drive through that heel to stand up tall",
      "Lower slowly under control with the same leg"
    ],
    "commonMistake": "Pushing off the back foot instead of driving with the top leg.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Split Squat if form breaks down."
  },
  {
    "id": "QD09",
    "name": "Bodyweight Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD02",
      "QD11",
      "QD12",
      "QD05",
      "QD08"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "The squat pattern was entirely absent from the bodyweight tier. This restores it, teaches the movement before load is added, and needs nothing but floor space.",
    "whatItDoes": "The base squat pattern. Trains the legs and grooves the movement before you add load.",
    "steps": [
      "Stand with feet shoulder width, toes slightly out",
      "Sit down between your hips as far as you comfortably can",
      "Stand back up and squeeze your glutes"
    ],
    "commonMistake": "Cutting the depth short and only using the top half of the range.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Goblet Squat."
  },
  {
    "id": "QD10",
    "name": "Reverse Nordic Curl",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, rectus femoris",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Quads",
      "Knee Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee"
    ],
    "substitutionIds": [
      "QD14",
      "QD07",
      "QD12",
      "QD09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Loaded quad stretch with no equipment, and the only alternative to the leg extension machine. Removes a hard dependency on a single piece of gym kit.",
    "whatItDoes": "A brutal bodyweight quad isolation that also protects the knees over time.",
    "steps": [
      "Kneel tall on a soft surface with your glutes squeezed",
      "Lean back slowly, keeping a straight line from knees to head",
      "Go only as far as you can control, then pull yourself back up"
    ],
    "commonMistake": "Breaking at the hips instead of staying in one straight line.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Sissy Squat."
  },
  {
    "id": "QD11",
    "name": "Split Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Lunge",
    "substitutionGroup": [
      "Quads",
      "Lunge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip",
      "ankle"
    ],
    "substitutionIds": [
      "QD04",
      "QD08",
      "QD03",
      "QD09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Stationary, so it needs no room to travel and no balance to walk. The safest single leg entry point and the regression the Bulgarian split squat was missing.",
    "whatItDoes": "A stationary lunge. All the single leg benefit with none of the balance drama.",
    "steps": [
      "Take a long stride and stay in that split stance",
      "Lower your back knee toward the floor",
      "Push through your front foot to stand back up"
    ],
    "commonMistake": "Leaning the torso forward over the front knee.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Walking Lunge."
  },
  {
    "id": "QD12",
    "name": "Wall Sit",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Wall",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "wall"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD09",
      "QD02",
      "QD05",
      "QD11"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Isometric, silent and needs a wall. Ideal for a shared house or a gap between lectures, and progressed by time rather than load.",
    "whatItDoes": "A static hold that builds quad endurance with no equipment and no impact.",
    "steps": [
      "Slide down a wall until your knees are at 90 degrees",
      "Keep your back flat against the wall and your weight in your heels",
      "Hold for time and breathe normally"
    ],
    "commonMistake": "Resting the hands on the thighs to take the load off.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Bodyweight Squat."
  },
  {
    "id": "QD13",
    "name": "Jump Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps, glutes",
    "movementPattern": "Squat",
    "substitutionGroup": [
      "Quads",
      "Squat"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Power",
    "primaryGoalFit": "Fat Loss",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "High",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee",
      "hip",
      "lower_back"
    ],
    "substitutionIds": [
      "QD09",
      "QD02",
      "QD04",
      "QD08"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Adds power and a conditioning stimulus to the squat pattern. Lets a short bodyweight session drive heart rate without abandoning lower body training.",
    "whatItDoes": "An explosive squat that trains power and burns a lot of energy fast.",
    "steps": [
      "Drop into a quarter squat with your arms back",
      "Jump as high as you can, driving the arms up",
      "Land softly, absorb it through the knees and hips, then reset"
    ],
    "commonMistake": "Landing stiff legged with a loud, hard thud.",
    "safetyNote": "Never taken to failure. End the set as soon as speed or landing quality drops."
  },
  {
    "id": "HG01",
    "name": "Romanian Deadlift",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings, glutes, erectors",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Hamstrings & Glutes",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Barbell or dumbbells",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell/dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG07",
      "HG08",
      "BK13",
      "HG09",
      "HG02",
      "HG03",
      "HG12"
    ],
    "substitutionCount": 7,
    "bodyRegion": "lower",
    "whyInDatabase": "The main hip hinge for hamstring length and strength. Teaches the hinge pattern that protects the back in everyday lifting.",
    "whatItDoes": "A hip hinge that stretches and strengthens the hamstrings and glutes.",
    "steps": [
      "Hold the bar at your hips with a soft knee bend",
      "Push your hips back and slide the bar down your thighs",
      "Stop when you feel a hamstring stretch, then drive your hips forward"
    ],
    "commonMistake": "Bending the knees and turning it into a deadlift.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Single Leg Romanian Deadlift if form breaks down."
  },
  {
    "id": "HG02",
    "name": "Hip Thrust",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Gluteus maximus",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "H&G",
      "Glute Bridge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Barbell, bench",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG03",
      "HG11",
      "HG08",
      "HG01",
      "HG09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Peak glute tension at full hip extension, where squats and deadlifts are easiest. Directly addresses the most requested aesthetic goal on the platform.",
    "whatItDoes": "The best loaded glute exercise there is, with almost no strain on the lower back.",
    "steps": [
      "Sit with your upper back on a bench and the bar over your hips",
      "Drive through your heels and lift your hips until your torso is level",
      "Squeeze the glutes at the top, then lower under control"
    ],
    "commonMistake": "Overarching the lower back at the top instead of squeezing the glutes.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Glute Bridge if form breaks down."
  },
  {
    "id": "HG03",
    "name": "Glute Bridge",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Gluteus maximus",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "H&G",
      "Glute Bridge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG02",
      "HG11",
      "HG08",
      "HG09",
      "HG12"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Floor based, no equipment, and the natural regression from the hip thrust. Also a reliable warm up to wake up the glutes before squatting.",
    "whatItDoes": "A floor glute bridge. The simplest way to learn how to actually use your glutes.",
    "steps": [
      "Lie on your back with your knees bent and heels close to your hips",
      "Drive through your heels and lift your hips",
      "Squeeze at the top, then lower slowly"
    ],
    "commonMistake": "Pushing the hips so high that the lower back takes over.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Hip Thrust."
  },
  {
    "id": "HG04",
    "name": "Seated Leg Curl",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Knee Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Leg curl machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_leg_curl"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG05",
      "HG14",
      "HG06",
      "HG01",
      "HG07"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Trains knee flexion, which no hinge covers. Hamstrings have two jobs and a complete program must train both.",
    "whatItDoes": "A machine curl that trains the hamstrings in a stretched, safe position.",
    "steps": [
      "Set the pad above your ankles and the thigh pad snug",
      "Curl your heels down and under the seat",
      "Return slowly without letting the stack crash"
    ],
    "commonMistake": "Letting the hips lift off the seat to get more range.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Lying Leg Curl."
  },
  {
    "id": "HG05",
    "name": "Lying Leg Curl",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Knee Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Leg curl machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_leg_curl"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG04",
      "HG14",
      "HG06",
      "HG01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Equipment dependent alternative to the seated curl so the program never fails just because one machine is occupied or absent.",
    "whatItDoes": "A machine curl that isolates the hamstrings lying face down.",
    "steps": [
      "Lie face down with the pad just above your heels",
      "Curl your heels toward your glutes",
      "Lower slowly until your legs are almost straight"
    ],
    "commonMistake": "Jerking the hips up off the bench to finish the rep.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Seated Leg Curl."
  },
  {
    "id": "HG06",
    "name": "Nordic Hamstring Curl",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Knee Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Partner or anchor",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "partner/anchor_point"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG14",
      "HG05",
      "HG04",
      "HG07",
      "HG01"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "The strongest evidence base of any single exercise for reducing hamstring strain injury. Valuable for the sport playing segment of the user base.",
    "whatItDoes": "The hardest bodyweight hamstring exercise. Builds serious resistance to hamstring strains. Advanced users only.",
    "steps": [
      "Kneel with your ankles anchored and squeeze your glutes",
      "Lower your body forward as slowly as you can, staying in a straight line",
      "Catch yourself with your hands and push back to the start"
    ],
    "commonMistake": "Bending at the hips instead of holding one straight line.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Slider Hamstring Curl instead."
  },
  {
    "id": "HG07",
    "name": "Single Leg Romanian Deadlift",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings, glutes",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Hamstrings & Glutes",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Optional dumbbell",
    "skillLevel": "Intermediate",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [
      "dumbbell"
    ],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG01",
      "HG08",
      "HG09",
      "HG11",
      "HG12"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Combines hinge, balance and hip stability. Delivers a real hamstring stimulus from very light loads, which suits minimal home setups.",
    "whatItDoes": "A single leg hinge that builds hamstrings, glutes and balance with light load.",
    "steps": [
      "Stand on one leg with a soft knee bend",
      "Hinge forward, letting the back leg rise behind you",
      "Stop when your torso is level, then return to standing"
    ],
    "commonMistake": "Letting the hips open out to the side instead of staying square.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Romanian Deadlift if form breaks down."
  },
  {
    "id": "HG08",
    "name": "Cable Pull Through",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Glutes, hamstrings",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Hamstrings & Glutes",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine, rope",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine",
      "rope_attachment"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG01",
      "HG02",
      "HG03",
      "HG09",
      "HG12"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Teaches the hinge with the load pulling the hips backward, so the pattern clicks fast. Low spinal load makes it a good high rep finisher.",
    "whatItDoes": "A cable hinge that teaches the hip pattern with the load pulling you backwards, not down.",
    "steps": [
      "Face away from a low pulley with the rope between your legs",
      "Push your hips back until you feel a hamstring stretch",
      "Snap your hips forward and squeeze the glutes"
    ],
    "commonMistake": "Pulling the rope with the arms instead of driving the hips.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Romanian Deadlift."
  },
  {
    "id": "HG09",
    "name": "Back Extension",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Erectors, glutes, hamstrings",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Hamstrings & Glutes",
      "Hinge"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "45 degree bench or GHD",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "back_extension_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG12",
      "HG01",
      "HG08",
      "HG03"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Builds lower back endurance, which is the actual weak link for students who sit and study all day. Low load, high return.",
    "whatItDoes": "A back extension that strengthens the hamstrings, glutes and spinal erectors together.",
    "steps": [
      "Set the pad just below your hip bones",
      "Hinge down until you feel a hamstring stretch",
      "Squeeze your glutes to raise your torso back to level"
    ],
    "commonMistake": "Cranking past level into a big lower back arch.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Prone Superman."
  },
  {
    "id": "HG10",
    "name": "Hip Abduction",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Gluteus medius, gluteus minimus",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Abduction"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band or machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band/machine_abduction"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG13",
      "HG11",
      "HG03",
      "CO07"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "The only movement here that trains hip abduction. Squats, hinges and lunges barely touch the glute medius, which drives knee tracking and lateral hip stability. Fills the largest coverage gap in the lower body.",
    "whatItDoes": "A hip abduction that strengthens the side glutes and helps stubborn knee and hip pain.",
    "steps": [
      "Sit or stand with a band or the machine pad at your knees",
      "Push your knees apart against the resistance",
      "Return slowly without letting the band snap back"
    ],
    "commonMistake": "Leaning the torso back to force the range further.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Lateral Band Walk."
  },
  {
    "id": "HG11",
    "name": "Single Leg Glute Bridge",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Gluteus maximus, hamstrings",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "H&G",
      "Glute Bridge"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG03",
      "HG02",
      "HG08",
      "HG09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Doubles the load on the glute bridge using bodyweight alone. Gives the bridge a progression so a bodyweight user is not stuck once it becomes easy.",
    "whatItDoes": "A one leg glute bridge that doubles the load on each glute with no equipment.",
    "steps": [
      "Lie on your back and lift one foot off the floor",
      "Drive through the planted heel and lift your hips",
      "Squeeze at the top and lower slowly"
    ],
    "commonMistake": "Letting one hip drop lower than the other.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Glute Bridge."
  },
  {
    "id": "HG12",
    "name": "Prone Superman",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Erectors, glutes",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Hamstrings & Glutes",
      "Hinge"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "HG09",
      "HG03",
      "HG11",
      "HG01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Lower back endurance from the floor, with no bench required. The bodyweight stand in for the back extension and safe for users with sensitive spines.",
    "whatItDoes": "A floor extension for the glutes and lower back. Ideal when you have nothing at all.",
    "steps": [
      "Lie face down with your arms out in front",
      "Lift your chest, arms and legs off the floor at once",
      "Hold briefly, then lower slowly"
    ],
    "commonMistake": "Throwing the head back and straining the neck.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Back Extension."
  },
  {
    "id": "BI01",
    "name": "Barbell Curl",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Biceps",
      "Curl"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Barbell or EZ bar",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "barbell/ez_bar"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "BI04",
      "BI02",
      "BI03",
      "BI06",
      "BI05",
      "BI07"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "The heaviest loadable curl, so it progresses cleanly. Standard reference movement for direct arm work.",
    "whatItDoes": "A loadable curl that lets you progress the biceps in small, trackable jumps.",
    "steps": [
      "Stand tall holding the bar with an underhand grip",
      "Curl the bar up without swinging your elbows forward",
      "Lower it slowly to straight arms"
    ],
    "commonMistake": "Rocking the body back to swing the bar up.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Cable Curl."
  },
  {
    "id": "BI02",
    "name": "Dumbbell Incline Curl",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii, long head",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Biceps",
      "Curl"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells, incline bench",
    "skillLevel": "Intermediate",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell",
      "incline_bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "BI01",
      "BI04",
      "BI03",
      "BI06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The shoulder extended position stretches the long head under load, which no standing curl achieves. Different stimulus, not just a different tool.",
    "whatItDoes": "A curl done lying back on an incline. Puts the biceps under a hard stretch.",
    "steps": [
      "Sit back on an incline bench and let your arms hang straight down",
      "Curl the dumbbells up without moving your elbows forward",
      "Lower all the way until your arms are fully straight"
    ],
    "commonMistake": "Cutting the bottom of the rep short and losing the stretch.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Barbell Curl."
  },
  {
    "id": "BI03",
    "name": "Hammer Curl",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Brachialis, brachioradialis",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Biceps",
      "Curl"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "BI01",
      "BI04",
      "BI02",
      "BI06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Trains the brachialis and forearm, which add arm thickness the supinated curl misses. Also gentler on cranky elbows and wrists.",
    "whatItDoes": "A neutral grip curl that builds the outer arm and forearm as well as the biceps.",
    "steps": [
      "Stand with dumbbells at your sides, palms facing in",
      "Curl up keeping the palms facing each other",
      "Lower slowly to straight arms"
    ],
    "commonMistake": "Letting the elbows drift forward at the top.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Barbell Curl."
  },
  {
    "id": "BI04",
    "name": "Cable Curl",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Biceps",
      "Curl"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "BI01",
      "BI02",
      "BI03",
      "BI06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Constant tension with no dead spot at the top. Good for high rep pump work at the end of a pull day.",
    "whatItDoes": "A cable curl that keeps tension on the biceps even at the top of the rep.",
    "steps": [
      "Stand a step back from a low pulley and grip the bar underhand",
      "Curl up with your elbows pinned to your sides",
      "Lower under control against the cable"
    ],
    "commonMistake": "Stepping too close so the tension disappears at the bottom.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Barbell Curl."
  },
  {
    "id": "BI05",
    "name": "Chin Up (Close Grip)",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii, lats",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Biceps",
      "Compound Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Pull up bar",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "pull_up_bar"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BI07",
      "BK15",
      "BI01",
      "BI04",
      "BI03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The only heavy compound biceps option. Lets a time poor user train back and arms in one movement.",
    "whatItDoes": "A close grip chin up. The heaviest biceps exercise you can do. Advanced users only.",
    "steps": [
      "Hang from the bar with palms facing you, hands close together",
      "Pull your chest to the bar and think about curling yourself up",
      "Lower slowly to straight arms"
    ],
    "commonMistake": "Swinging the legs to generate momentum.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Supinated Inverted Row instead."
  },
  {
    "id": "BI06",
    "name": "Band Curl",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Biceps",
      "Curl"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "BI03",
      "BI01",
      "BI04",
      "BI07"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "A bodyweight beginner previously had no biceps option, since the chin up is advanced. Bands give a scalable curl anywhere.",
    "whatItDoes": "A banded curl for training the arms with no weights at all.",
    "steps": [
      "Stand on the band and hold the ends with palms up",
      "Curl your hands to your shoulders",
      "Lower slowly and fight the band on the way down"
    ],
    "commonMistake": "Letting the band snap the arms back down.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Hammer Curl."
  },
  {
    "id": "BI07",
    "name": "Supinated Inverted Row",
    "muscleGroup": "Biceps",
    "primaryMuscles": "Biceps brachii, lats",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Biceps",
      "Compound Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bar, rings or table edge",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "low_bar/rings/sturdy_table"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK15",
      "BI05",
      "BI06",
      "BI03",
      "BI01"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "A beginner friendly compound biceps option, since the chin up is advanced and the band curl was the only other choice. Difficulty scales purely by foot position.",
    "whatItDoes": "An underhand bodyweight row that loads the biceps and back at the same time.",
    "steps": [
      "Lie under a bar and grip it underhand, shoulder width",
      "Pull your chest to the bar, elbows close to your body",
      "Lower until your arms are straight"
    ],
    "commonMistake": "Letting the hips sag instead of holding a rigid line.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Assisted Chin Up."
  },
  {
    "id": "TR01",
    "name": "Close Grip Bench Press",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, pectoralis, anterior delt",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Triceps",
      "Compound Press"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Barbell, bench",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": true,
    "requiredEquipmentTags": [
      "barbell",
      "bench"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "TR04",
      "TR03",
      "TR02",
      "TR06",
      "TR05",
      "TR07"
    ],
    "substitutionCount": 6,
    "bodyRegion": "upper",
    "whyInDatabase": "Heavy compound triceps loading that carries straight over to bench press lockout. The strength focused arm option.",
    "whatItDoes": "A narrow grip bench press. The heaviest way to load the triceps.",
    "steps": [
      "Grip the bar around shoulder width, not any narrower",
      "Lower it to your lower chest with your elbows tucked in",
      "Press straight back up"
    ],
    "commonMistake": "Gripping so narrow that the wrists and elbows take the strain.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Skull Crusher if form breaks down."
  },
  {
    "id": "TR02",
    "name": "Overhead Cable Extension",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, long head",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Triceps",
      "Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine, rope",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine",
      "rope_attachment"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "TR04",
      "TR03",
      "TR07",
      "TR01",
      "TR06"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The overhead position lengthens the long head, which is the largest triceps head and the one pressing neglects. Highest value triceps isolation.",
    "whatItDoes": "An overhead extension that trains the long head of the triceps under a full stretch.",
    "steps": [
      "Face away from the pulley with the rope behind your head",
      "Straighten your arms overhead, elbows pointing forward",
      "Let your hands drop behind your head under control"
    ],
    "commonMistake": "Letting the elbows flare out wide as you press.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Skull Crusher."
  },
  {
    "id": "TR03",
    "name": "Triceps Pushdown",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, lateral head",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Triceps",
      "Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Cable machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "TR07",
      "TR02",
      "TR04",
      "TR06",
      "TR05"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Simple, low fatigue and easy to load. The default triceps finisher when the user is already tired from pressing.",
    "whatItDoes": "A cable pushdown. The simplest way to add safe triceps volume.",
    "steps": [
      "Stand tall with your elbows pinned to your sides",
      "Push the bar down until your arms are straight",
      "Let it rise back to chest height slowly"
    ],
    "commonMistake": "Leaning over the bar and pressing with the chest.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Band Triceps Pushdown."
  },
  {
    "id": "TR04",
    "name": "Skull Crusher",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, long head",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Triceps",
      "Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "EZ bar or dumbbells",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "ez_bar/dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "TR02",
      "TR03",
      "TR07",
      "TR01",
      "TR06"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Free weight overhead style extension for users with no cable stack. Preserves long head training in a home gym.",
    "whatItDoes": "A lying extension that loads the triceps hard through a long range.",
    "steps": [
      "Lie back holding the bar over your chest with straight arms",
      "Bend only at the elbows and lower the bar toward your forehead",
      "Press back up without letting the elbows drift"
    ],
    "commonMistake": "Letting the elbows flare out and the shoulders take over.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Overhead Cable Extension."
  },
  {
    "id": "TR05",
    "name": "Bench Dip",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Triceps",
      "Compound Press"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Bench or chair",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "bench/chair"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "TR06",
      "TR03",
      "TR07",
      "TR01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "No equipment beyond a chair. Keeps direct triceps work in the program for bodyweight only users.",
    "whatItDoes": "A bodyweight dip off a bench. Triceps work with nothing but a chair.",
    "steps": [
      "Sit on a bench, hands beside your hips, and slide your feet forward",
      "Lower your body by bending your elbows straight back",
      "Press back up until your arms are straight"
    ],
    "commonMistake": "Dropping too low and rolling the shoulders forward.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Diamond Push Up."
  },
  {
    "id": "TR06",
    "name": "Diamond Push Up",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, pectoralis",
    "movementPattern": "Horizontal Push",
    "substitutionGroup": [
      "Triceps",
      "Compound Press"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist",
      "chest"
    ],
    "substitutionIds": [
      "TR05",
      "TR07",
      "TR03",
      "TR01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Second bodyweight triceps movement, so a user who dislikes bench dips or has cranky shoulders still has direct arm work.",
    "whatItDoes": "A narrow push up that shifts the work from the chest to the triceps.",
    "steps": [
      "Set your hands close together under your chest",
      "Lower with your elbows tucked close to your ribs",
      "Press back up in one straight line"
    ],
    "commonMistake": "Flaring the elbows out wide, which loads the shoulders.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Bench Dip."
  },
  {
    "id": "TR07",
    "name": "Band Triceps Pushdown",
    "muscleGroup": "Triceps",
    "primaryMuscles": "Triceps, lateral head",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Triceps",
      "Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band, anchor",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band",
      "anchor_point"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "elbow"
    ],
    "substitutionIds": [
      "TR03",
      "TR02",
      "TR06",
      "TR05"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Replicates the cable pushdown with a band and a door anchor. Keeps a low fatigue triceps finisher available to users with no gym access.",
    "whatItDoes": "A banded pushdown. Full triceps work with a band and a door.",
    "steps": [
      "Anchor the band high and grip it with both hands",
      "Push down until your arms are straight, elbows at your sides",
      "Let the band rise back slowly"
    ],
    "commonMistake": "Letting the elbows travel forward as you push.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Triceps Pushdown."
  },
  {
    "id": "CO01",
    "name": "Plank",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis, transverse abdominis",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "core",
      "lower_back"
    ],
    "substitutionIds": [
      "CO02",
      "CO11",
      "CO12",
      "CO06",
      "CO09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Teaches the bracing that protects the spine under every barbell lift. Universally accessible and easy to time and progress.",
    "whatItDoes": "A hold that teaches the core to resist your spine bending under load.",
    "steps": [
      "Set your elbows under your shoulders and your body in one line",
      "Squeeze your glutes and pull your belly button in",
      "Breathe normally and hold for time"
    ],
    "commonMistake": "Letting the hips sag or pike up as you fatigue.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dead Bug."
  },
  {
    "id": "CO02",
    "name": "Dead Bug",
    "muscleGroup": "Core",
    "primaryMuscles": "Transverse abdominis, obliques",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "core",
      "lower_back"
    ],
    "substitutionIds": [
      "CO01",
      "CO12",
      "CO09",
      "CO11"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Trains core stability while limbs move, with almost zero spinal load. Safe for users with existing lower back pain.",
    "whatItDoes": "A slow, controlled drill that trains the deep core without straining the back.",
    "steps": [
      "Lie on your back with your arms and knees up over you",
      "Lower one arm and the opposite leg toward the floor",
      "Return and repeat on the other side, keeping your back flat"
    ],
    "commonMistake": "Letting the lower back arch off the floor as the leg lowers.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Plank."
  },
  {
    "id": "CO03",
    "name": "Hanging Leg Raise",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis, hip flexors",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Pull up bar",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "pull_up_bar"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "core",
      "hip"
    ],
    "substitutionIds": [
      "CO09",
      "CO11",
      "CO08",
      "CO02",
      "CO01"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "One of the few core movements that loads the abs through a long range against real resistance. The upper end of core progression.",
    "whatItDoes": "A hanging raise that loads the lower abs hard. Advanced users only.",
    "steps": [
      "Hang from a bar with your shoulders pulled down",
      "Raise your legs until your thighs pass parallel",
      "Lower slowly without swinging"
    ],
    "commonMistake": "Swinging back and forth and using momentum, not the abs.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Reverse Crunch instead."
  },
  {
    "id": "CO04",
    "name": "Cable Woodchop",
    "muscleGroup": "Core",
    "primaryMuscles": "Obliques, transverse abdominis",
    "movementPattern": "Rotation",
    "substitutionGroup": [
      "Core",
      "Rotation"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine",
    "skillLevel": "Intermediate",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "core"
    ],
    "substitutionIds": [
      "CO10",
      "CO14",
      "CO05",
      "CO07"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Trains resisted rotation, which is the pattern used in almost every sport. Rotation is otherwise missing from a standard lifting program.",
    "whatItDoes": "A cable chop that trains the core to move and brace through rotation.",
    "steps": [
      "Set the pulley high and stand side on with your feet planted",
      "Pull the handle down and across your body, rotating through the ribs",
      "Return slowly and stay braced"
    ],
    "commonMistake": "Rotating from the lower back rather than the ribs and hips.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Standing Band Rotation."
  },
  {
    "id": "CO05",
    "name": "Pallof Press",
    "muscleGroup": "Core",
    "primaryMuscles": "Obliques, transverse abdominis",
    "movementPattern": "Anti Rotation",
    "substitutionGroup": [
      "Core",
      "Anti Rotation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Cable or resistance band",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine/band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "core"
    ],
    "substitutionIds": [
      "CO10",
      "CO12",
      "CO01",
      "CO02",
      "CO07"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Anti rotation strength with a band substitute available. Directly improves the trunk stiffness that carries over to squat and deadlift.",
    "whatItDoes": "An anti rotation press that builds a genuinely stable, strong midsection.",
    "steps": [
      "Stand side on to a cable or band at chest height",
      "Press your hands straight out in front of your chest",
      "Resist the pull, hold briefly, then bring your hands back in"
    ],
    "commonMistake": "Letting the torso twist toward the anchor as you press.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Standing Band Rotation."
  },
  {
    "id": "CO06",
    "name": "Ab Wheel Rollout",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis, lats",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Ab wheel",
    "skillLevel": "Advanced",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "ab_wheel"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "core",
      "lower_back"
    ],
    "substitutionIds": [
      "CO11",
      "CO01",
      "CO02",
      "CO08",
      "CO09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The hardest anti extension movement most people will ever do, from a cheap piece of kit. Excellent progression target for the plank.",
    "whatItDoes": "The hardest anti extension exercise in the gym. Advanced users only.",
    "steps": [
      "Kneel with the wheel under your shoulders",
      "Roll forward as far as you can hold a flat back",
      "Pull yourself back with your abs, not your hips"
    ],
    "commonMistake": "Rolling out so far the lower back sags into an arch.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Hollow Body Hold instead."
  },
  {
    "id": "CO07",
    "name": "Side Plank",
    "muscleGroup": "Core",
    "primaryMuscles": "Obliques, quadratus lumborum",
    "movementPattern": "Lateral Flexion",
    "substitutionGroup": [
      "Core",
      "Lateral Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "core"
    ],
    "substitutionIds": [
      "CO13",
      "FB07",
      "CO05",
      "CO01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Covers the lateral trunk, which the front plank ignores. Rounds out the core in the frontal plane.",
    "whatItDoes": "A side hold that trains the obliques and the muscles that stop you tipping sideways.",
    "steps": [
      "Lie on your side with your elbow under your shoulder",
      "Lift your hips so your body forms one straight line",
      "Hold for time, then swap sides"
    ],
    "commonMistake": "Letting the hips drift backwards out of line.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Copenhagen Plank."
  },
  {
    "id": "CO08",
    "name": "Cable Crunch",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Cable machine, rope",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "cable_machine",
      "rope_attachment"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "core"
    ],
    "substitutionIds": [
      "CO09",
      "CO03",
      "CO11",
      "CO01",
      "CO02"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Progressive overload for the abs, which bodyweight crunches cannot provide once a user is conditioned. Treats abs like any other muscle.",
    "whatItDoes": "A loadable crunch that lets you actually progress the abs over a semester.",
    "steps": [
      "Kneel facing a high rope and hold it beside your head",
      "Crunch down by rounding your spine, hips staying still",
      "Return slowly under control"
    ],
    "commonMistake": "Hinging at the hips instead of curling the spine.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Reverse Crunch."
  },
  {
    "id": "CO09",
    "name": "Reverse Crunch",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis, hip flexors",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "core"
    ],
    "substitutionIds": [
      "CO11",
      "CO02",
      "CO08",
      "CO01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "Bridges the gap between the dead bug and the hanging leg raise. Trains posterior pelvic tilt against gravity with no equipment, giving the generator a middle rung on the core ladder.",
    "whatItDoes": "A crunch that curls the hips up. Hits the lower abs with zero equipment.",
    "steps": [
      "Lie on your back with your knees bent over your hips",
      "Curl your hips off the floor toward your ribs",
      "Lower slowly without letting your feet touch down"
    ],
    "commonMistake": "Swinging the legs up rather than curling the pelvis.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Hollow Body Hold."
  },
  {
    "id": "CO10",
    "name": "Standing Band Rotation",
    "muscleGroup": "Core",
    "primaryMuscles": "Obliques, transverse abdominis",
    "movementPattern": "Rotation",
    "substitutionGroup": [
      "Core",
      "Rotation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "core"
    ],
    "substitutionIds": [
      "CO04",
      "CO14",
      "CO05"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Rotation was only trainable on a cable machine. This makes the pattern available to every user and gives the woodchop a true alternative.",
    "whatItDoes": "A standing rotation that trains the core to produce twist, not just resist it.",
    "steps": [
      "Anchor a band at chest height and stand side on",
      "Rotate your ribs away from the anchor with straight arms",
      "Return slowly and keep your hips fairly quiet"
    ],
    "commonMistake": "Turning the arms only while the torso stays still.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Cable Woodchop."
  },
  {
    "id": "CO11",
    "name": "Hollow Body Hold",
    "muscleGroup": "Core",
    "primaryMuscles": "Rectus abdominis, transverse abdominis",
    "movementPattern": "Anti Extension",
    "substitutionGroup": [
      "Core",
      "Anti Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "core"
    ],
    "substitutionIds": [
      "CO02",
      "CO01",
      "CO09",
      "CO06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The progression between the plank and the hanging leg raise, and it carries directly into gymnastic and calisthenic goals. Trains the whole anterior chain under tension.",
    "whatItDoes": "A hold that locks the whole front of the core under tension at once.",
    "steps": [
      "Lie on your back and press your lower back into the floor",
      "Lift your arms, head and legs a few inches off the ground",
      "Hold and keep the lower back flat the whole time"
    ],
    "commonMistake": "Letting a gap open under the lower back.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dead Bug."
  },
  {
    "id": "CO12",
    "name": "Bird Dog",
    "muscleGroup": "Core",
    "primaryMuscles": "Transverse abdominis, obliques, erectors",
    "movementPattern": "Anti Rotation",
    "substitutionGroup": [
      "Core",
      "Anti Rotation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "core",
      "lower_back"
    ],
    "substitutionIds": [
      "CO02",
      "CO05",
      "CO01"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Anti rotation with zero equipment, where the Pallof press previously needed a band or cable. Also the most back friendly core movement in the database.",
    "whatItDoes": "A gentle drill that builds core control and is safe for almost any back.",
    "steps": [
      "Start on all fours with a flat back",
      "Reach one arm forward and the opposite leg back",
      "Hold briefly, return, and swap sides without rocking"
    ],
    "commonMistake": "Letting the hips rotate as the leg lifts.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Dead Bug."
  },
  {
    "id": "CO13",
    "name": "Copenhagen Plank",
    "muscleGroup": "Core",
    "primaryMuscles": "Adductors, obliques",
    "movementPattern": "Lateral Flexion",
    "substitutionGroup": [
      "Core",
      "Lateral Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Bench or chair",
    "skillLevel": "Advanced",
    "unilateral": true,
    "loadable": false,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "bench/chair"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "core",
      "hip"
    ],
    "substitutionIds": [
      "CO07",
      "FB07",
      "CO05",
      "CO01"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The only movement here that loads the adductors, which nothing else in the database trains directly. Strong evidence base for reducing groin injury in field sport athletes.",
    "whatItDoes": "A side plank variation that also protects the groin. Advanced users only.",
    "steps": [
      "Set your top leg on a bench and your elbow under your shoulder",
      "Lift your hips until your body is in one straight line",
      "Hold for time, then swap sides"
    ],
    "commonMistake": "Starting with the full version before the knee supported one.",
    "safetyNote": "Advanced only. Never taken to failure. Beginner and intermediate users are served Side Plank instead."
  },
  {
    "id": "CA01",
    "name": "Standing Calf Raise",
    "muscleGroup": "Calves",
    "primaryMuscles": "Gastrocnemius",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Calves",
      "Isolation"
    ],
    "type": "Isolation",
    "equipmentTier": "Basic Gym",
    "equipment": "Machine, dumbbells or step",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_calf/dumbbell/step"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "ankle"
    ],
    "substitutionIds": [
      "CA02",
      "CA03",
      "CA04"
    ],
    "substitutionCount": 3,
    "bodyRegion": "lower",
    "whyInDatabase": "Knee extended, so the gastrocnemius takes the load. The main calf builder and easy to run anywhere with a step.",
    "whatItDoes": "A standing raise that builds the calf through a full stretch and contraction.",
    "steps": [
      "Stand with the balls of your feet on a step or platform",
      "Drop your heels down until you feel a stretch",
      "Push all the way up onto your toes and pause"
    ],
    "commonMistake": "Bouncing through the reps and skipping the stretch.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Seated Calf Raise."
  },
  {
    "id": "CA02",
    "name": "Seated Calf Raise",
    "muscleGroup": "Calves",
    "primaryMuscles": "Soleus",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Calves",
      "Isolation"
    ],
    "type": "Isolation",
    "equipmentTier": "Full Gym",
    "equipment": "Seated calf machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "machine_seated_calf"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "ankle"
    ],
    "substitutionIds": [
      "CA01",
      "CA03",
      "CA04"
    ],
    "substitutionCount": 3,
    "bodyRegion": "lower",
    "whyInDatabase": "Knee bent, which shifts work to the soleus. The two calf muscles need different knee angles, so both variants are required for full development.",
    "whatItDoes": "A seated raise that targets the deeper calf muscle under the main one.",
    "steps": [
      "Sit with the pad on your thighs and the balls of your feet on the platform",
      "Lower your heels until you feel a stretch",
      "Press up onto your toes and squeeze"
    ],
    "commonMistake": "Using half the range because the weight is too heavy.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Standing Calf Raise."
  },
  {
    "id": "CA03",
    "name": "Single Leg Calf Raise",
    "muscleGroup": "Calves",
    "primaryMuscles": "Gastrocnemius, soleus",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Calves",
      "Isolation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Step",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "step/stair"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "ankle"
    ],
    "substitutionIds": [
      "CA01",
      "CA02",
      "CA04"
    ],
    "substitutionCount": 3,
    "bodyRegion": "lower",
    "whyInDatabase": "Doubles the load using only bodyweight. Makes calf training viable with no equipment at all.",
    "whatItDoes": "A one leg raise that doubles the load on each calf with no weights.",
    "steps": [
      "Stand on one foot with the ball of your foot on a step",
      "Lower your heel until you feel a stretch",
      "Push up onto your toes and pause at the top"
    ],
    "commonMistake": "Holding the rail so hard that your arm takes the load.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Standing Calf Raise."
  },
  {
    "id": "FB01",
    "name": "Kettlebell Swing",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Glutes, hamstrings, erectors",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Kettlebell",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Power",
    "primaryGoalFit": "Fat Loss",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "kettlebell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Moderate",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "FB11",
      "HG08",
      "HG01",
      "QD13",
      "FB03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Builds explosive hip extension and drives heart rate hard with a single tool. Bridges strength work and conditioning in one exercise.",
    "whatItDoes": "An explosive hip hinge that builds power and conditioning at the same time.",
    "steps": [
      "Stand with the bell an arm's length in front of you and hinge to grip it",
      "Hike it back between your legs, then snap your hips forward",
      "Let it float to chest height and guide it back down"
    ],
    "commonMistake": "Squatting the bell up and lifting with the arms.",
    "safetyNote": "Never taken to failure. End the set as soon as speed or landing quality drops."
  },
  {
    "id": "FB02",
    "name": "Farmer Carry",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Traps, forearms, core",
    "movementPattern": "Carry",
    "substitutionGroup": [
      "Full Body",
      "Carry"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells or kettlebells",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell/kettlebell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "shoulder",
      "core",
      "grip",
      "lower_back"
    ],
    "substitutionIds": [
      "FB07",
      "CO07",
      "CO01"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Grip, trunk and postural strength under a real load. Almost impossible to do with bad technique, so it is safe to prescribe to anyone.",
    "whatItDoes": "A loaded walk that builds grip, traps and a rock solid core.",
    "steps": [
      "Pick up a heavy weight in each hand with a flat back",
      "Stand tall, shoulders back, and walk with short controlled steps",
      "Walk for the set time, then place the weights down carefully"
    ],
    "commonMistake": "Leaning back or letting the shoulders round forward.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Suitcase Carry."
  },
  {
    "id": "FB07",
    "name": "Suitcase Carry",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Obliques, traps, forearms, core",
    "movementPattern": "Carry",
    "substitutionGroup": [
      "Full Body",
      "Carry"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Single dumbbell or kettlebell",
    "skillLevel": "Beginner",
    "unilateral": true,
    "loadable": true,
    "prescriptionClass": "Time",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell/kettlebell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "duration",
    "loadUnit": "seconds",
    "stressRegions": [
      "shoulder",
      "core",
      "grip",
      "lower_back"
    ],
    "substitutionIds": [
      "FB02",
      "CO07",
      "CO05"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "Alternative to the farmer carry and a loaded anti lateral flexion movement, which the side plank was otherwise carrying alone.",
    "whatItDoes": "A one sided carry that forces the obliques to stop you tipping over.",
    "steps": [
      "Pick up one weight and stand tall",
      "Walk in a straight line without leaning to either side",
      "Swap hands and repeat for the same distance"
    ],
    "commonMistake": "Leaning away from the weight instead of staying upright.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Farmer Carry."
  },
  {
    "id": "CA04",
    "name": "Pogo Hop",
    "muscleGroup": "Calves",
    "primaryMuscles": "Gastrocnemius, soleus",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Calves",
      "Isolation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Power",
    "primaryGoalFit": "General Fitness",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "High",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "ankle"
    ],
    "substitutionIds": [
      "CA03",
      "CA01",
      "CA02"
    ],
    "substitutionCount": 3,
    "bodyRegion": "lower",
    "whyInDatabase": "Trains the calves elastically rather than through slow tension, and gives the single leg calf raise its only bodyweight alternative. Doubles as a low cost warm up.",
    "whatItDoes": "A springy hop that builds calf stiffness and elasticity for running and jumping.",
    "steps": [
      "Stand tall with stiff ankles and straight legs",
      "Hop lightly off the balls of your feet",
      "Spend as little time on the ground as possible"
    ],
    "commonMistake": "Bending the knees and turning it into a squat jump.",
    "safetyNote": "Never taken to failure. End the set as soon as speed or landing quality drops."
  },
  {
    "id": "FB03",
    "name": "Burpee",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Full body",
    "movementPattern": "Full Body",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Full Body"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "High",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "shoulder"
    ],
    "substitutionIds": [
      "FB04",
      "FB08",
      "FB10",
      "FB09",
      "QD13"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Maximum conditioning stimulus per second with zero equipment. The workhorse of any circuit or HIIT block.",
    "whatItDoes": "A full body conditioning move that raises your heart rate faster than almost anything.",
    "steps": [
      "Squat down and place your hands on the floor",
      "Jump or step your feet back and lower your chest to the ground",
      "Push up, step your feet in, and jump up"
    ],
    "commonMistake": "Collapsing at the bottom and losing all core tension.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Mountain Climber."
  },
  {
    "id": "FB04",
    "name": "Mountain Climber",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Core, hip flexors, shoulders",
    "movementPattern": "Full Body",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Full Body"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Moderate",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "shoulder",
      "core"
    ],
    "substitutionIds": [
      "FB09",
      "FB10",
      "FB08",
      "CO01",
      "FB03"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "Raises heart rate while loading the core in a plank position. Low skill, apartment friendly and quiet enough for shared housing.",
    "whatItDoes": "A moving plank that trains the core and lungs at the same time.",
    "steps": [
      "Start in a push up position with your hips level",
      "Drive one knee toward your chest, then swap",
      "Keep the pace steady and the hips low"
    ],
    "commonMistake": "Letting the hips bounce up and down with every rep.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Bear Crawl."
  },
  {
    "id": "FB08",
    "name": "Jumping Jack",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Full body",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "High",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "hip"
    ],
    "substitutionIds": [
      "FB10",
      "FB04",
      "CA04",
      "FB09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The lowest barrier conditioning movement in the database. Gives a deconditioned user something to do in a circuit when burpees and mountain climbers are too hard.",
    "whatItDoes": "A simple low impact way to raise your heart rate and warm the whole body.",
    "steps": [
      "Stand with your feet together and arms at your sides",
      "Jump your feet out as you raise your arms overhead",
      "Jump back in and keep a steady rhythm"
    ],
    "commonMistake": "Landing heavily on straight legs instead of soft knees.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to High Knees."
  },
  {
    "id": "FB09",
    "name": "Bear Crawl",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Core, shoulders, quads",
    "movementPattern": "Full Body",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Full Body"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "shoulder",
      "core",
      "knee"
    ],
    "substitutionIds": [
      "FB04",
      "CO01",
      "FB03",
      "FB10"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Loads the core and shoulders while moving, which no static hold does. Quiet, joint friendly and needs only a few metres of floor.",
    "whatItDoes": "A crawl that builds core control, shoulder stability and conditioning in one move.",
    "steps": [
      "Start on hands and toes with your knees just off the floor",
      "Crawl forward moving the opposite hand and foot together",
      "Keep your hips low and your back flat"
    ],
    "commonMistake": "Lifting the hips high and letting the back sway side to side.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Mountain Climber."
  },
  {
    "id": "FB05",
    "name": "Rowing Machine Interval",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Legs, back, arms",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Rowing erg",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "rowing_erg"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "hip"
    ],
    "substitutionIds": [
      "FB06",
      "FB10",
      "FB08",
      "FB03",
      "FB04"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Low impact, full body cardio with objective output in watts. Ideal for users chasing fat loss without joint stress.",
    "whatItDoes": "Rowing intervals. High output cardio that spares the knees and works the back.",
    "steps": [
      "Set the damper around 4 or 5 and sit tall",
      "Drive with the legs, then lean back, then pull with the arms",
      "Reverse that order on the way in and repeat for the interval"
    ],
    "commonMistake": "Yanking with the arms first and letting the legs do nothing.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Assault Bike or Stationary Bike Interval."
  },
  {
    "id": "FB06",
    "name": "Assault Bike or Stationary Bike Interval",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Legs, lungs",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Bike",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "stationary_bike"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "hip"
    ],
    "substitutionIds": [
      "FB05",
      "FB10",
      "FB08",
      "FB03",
      "FB04"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Self limiting and near impossible to injure yourself on, so intensity can be pushed to true maximum. The safest way to prescribe hard intervals remotely.",
    "whatItDoes": "Bike intervals. The lowest skill and lowest impact way to push hard cardio.",
    "steps": [
      "Set the seat so your knee stays slightly bent at the bottom",
      "Ride easy for the warm up, then push hard for the work interval",
      "Recover at an easy pace, then repeat"
    ],
    "commonMistake": "Going too hard on the first interval and dying on the rest.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Rowing Machine Interval."
  },
  {
    "id": "BK12",
    "name": "Trap Bar Deadlift",
    "muscleGroup": "Back",
    "primaryMuscles": "Erector spinae, lats, glutes, quads, traps",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Back",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Trap bar, plates",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "Strength",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "trap_bar",
      "plates"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "BK01",
      "BK13",
      "BK10",
      "HG01",
      "HG08",
      "QD02"
    ],
    "substitutionCount": 6,
    "bodyRegion": "lower",
    "whyInDatabase": "The safe entry point to heavy deadlifting. Handles at the sides keep the bar path over the mid foot and make a flat back far easier to hold, so users who are intimidated by the conventional deadlift still get the pattern.",
    "whatItDoes": "A deadlift with the handles at your sides. Far easier to keep a flat back than the barbell version.",
    "steps": [
      "Stand inside the bar and grip the handles at your sides",
      "Push the floor away, chest tall, back flat",
      "Stand fully upright, then push the hips back to lower"
    ],
    "commonMistake": "Letting the hips shoot up first so the back takes the load.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Conventional Deadlift if form breaks down."
  },
  {
    "id": "BK13",
    "name": "Dumbbell Deadlift",
    "muscleGroup": "Back",
    "primaryMuscles": "Erector spinae, glutes, hamstrings, traps",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Back",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Dumbbells",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 1,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "BK12",
      "HG01",
      "BK10",
      "HG08",
      "HG09",
      "HG03",
      "HG12"
    ],
    "substitutionCount": 7,
    "bodyRegion": "lower",
    "whyInDatabase": "A beginner friendly hinge with a short range and a light load ceiling. Exists so that no user is ever left without a deadlift option when the barbell version is gated or refused.",
    "whatItDoes": "The friendliest way into deadlifting. Same pattern as the barbell, far less to go wrong.",
    "steps": [
      "Stand with a dumbbell outside each foot and hinge down to grip them",
      "Set your back flat and chest tall, then stand up",
      "Push your hips back to lower the dumbbells to the floor"
    ],
    "commonMistake": "Squatting the weight up instead of hinging at the hips.",
    "safetyNote": "Free weight compound. Always stop at least one rep short of failure. Swap to Trap Bar Deadlift if form breaks down."
  },
  {
    "id": "BK14",
    "name": "Band Bent Over Row",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, rhomboids, mid traps, rear delts",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Back",
      "Horizontal Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "BK07",
      "BK08",
      "BK03",
      "BK06"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The only loadable horizontal pull available to a user with no bar and no bench. Closes the bodyweight tier row gap left by the inverted row.",
    "whatItDoes": "A banded row that covers the horizontal pull when you train at home.",
    "steps": [
      "Anchor the band low or stand on it, then hinge forward with a flat back",
      "Row your hands to your lower ribs and squeeze the shoulder blades",
      "Straighten the arms slowly against the band"
    ],
    "commonMistake": "Standing upright so the band pulls forward instead of down.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Inverted Row."
  },
  {
    "id": "BK15",
    "name": "Band Assisted Chin Up",
    "muscleGroup": "Back",
    "primaryMuscles": "Lats, biceps, mid traps",
    "movementPattern": "Vertical Pull",
    "substitutionGroup": [
      "Back",
      "Vertical Pull"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Pull up bar, resistance band",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "pull_up_bar",
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "assisted",
    "loadUnit": "assist_kg",
    "stressRegions": [
      "shoulder",
      "elbow"
    ],
    "substitutionIds": [
      "BK05",
      "BK04",
      "BK11",
      "BK07",
      "BK09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "The bridge between a lat pulldown and a full chin up. Gives beginners a scalable vertical pull and a clear progression to track.",
    "whatItDoes": "A chin up with a band taking part of your weight. The bridge to a full bodyweight chin up.",
    "steps": [
      "Loop a band over the bar and put one foot or knee in it",
      "Pull your chest toward the bar, driving your elbows down",
      "Lower slowly to straight arms"
    ],
    "commonMistake": "Using such a thick band that the back barely works.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Lat Pulldown."
  },
  {
    "id": "SH11",
    "name": "Band Overhead Press",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Anterior delt, lateral delt, triceps",
    "movementPattern": "Vertical Push",
    "substitutionGroup": [
      "Shoulders",
      "Vertical Push"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Load",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "wrist"
    ],
    "substitutionIds": [
      "SH02",
      "SH07",
      "SH08",
      "SH01",
      "SH09"
    ],
    "substitutionCount": 5,
    "bodyRegion": "upper",
    "whyInDatabase": "A loadable overhead press for the bodyweight tier. Replaces the pike push up for users who cannot support their weight on their hands.",
    "whatItDoes": "A banded overhead press for training shoulders at home with real tension.",
    "steps": [
      "Stand on the band and hold the ends at shoulder height",
      "Press straight overhead without letting your ribs flare",
      "Lower slowly to shoulder height"
    ],
    "commonMistake": "Letting the band pull your hands forward at the bottom.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Seated Dumbbell Shoulder Press."
  },
  {
    "id": "SH12",
    "name": "Band Pull Apart",
    "muscleGroup": "Shoulders",
    "primaryMuscles": "Rear delt, rhomboids, mid traps",
    "movementPattern": "Horizontal Pull",
    "substitutionGroup": [
      "Shoulders",
      "Rear Delt"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "shoulder",
      "elbow",
      "upper_back"
    ],
    "substitutionIds": [
      "SH05",
      "SH06",
      "SH10"
    ],
    "substitutionCount": 3,
    "bodyRegion": "upper",
    "whyInDatabase": "The cheapest, fastest rear delt exercise there is. Fills the bodyweight rear delt gap and doubles as a warm up set.",
    "whatItDoes": "A simple band drill for the rear delts and upper back. Great as a warm up or filler set.",
    "steps": [
      "Hold a band in front of you at shoulder height, arms straight",
      "Pull your hands apart until the band touches your chest",
      "Return slowly under control"
    ],
    "commonMistake": "Bending the elbows and rowing rather than pulling the band apart.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Rear Delt Fly."
  },
  {
    "id": "QD14",
    "name": "Sissy Squat",
    "muscleGroup": "Quads",
    "primaryMuscles": "Quadriceps",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "Quads",
      "Knee Extension"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Wall or rack for balance",
    "skillLevel": "Intermediate",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "Hypertrophy",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "wall/rack"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee"
    ],
    "substitutionIds": [
      "QD10",
      "QD07",
      "QD12",
      "QD09"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "A bodyweight leg extension. Ensures a quad isolation exists for users with no leg extension machine.",
    "whatItDoes": "A bodyweight quad isolation that gives you a leg extension without a machine.",
    "steps": [
      "Kneel or stand on your toes with your body in a straight line",
      "Bend the knees and lean the body back as one piece",
      "Pull yourself back up using the quads only"
    ],
    "commonMistake": "Bending at the hips, which takes the load off the quads.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Reverse Nordic Curl."
  },
  {
    "id": "HG13",
    "name": "Lateral Band Walk",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Gluteus medius, gluteus minimus",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Abduction"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Resistance band",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "band"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG10",
      "HG11",
      "HG03",
      "CO07"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Covers hip abduction without a machine. Directly supports knee health for runners and anyone with a desk heavy day.",
    "whatItDoes": "A band walk that fires up the side glutes and warms the hips before leg day.",
    "steps": [
      "Loop a band above your knees and take a quarter squat stance",
      "Step sideways, keeping tension on the band the whole time",
      "Take even steps in both directions"
    ],
    "commonMistake": "Letting the knees cave in between steps.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Hip Abduction."
  },
  {
    "id": "HG14",
    "name": "Slider Hamstring Curl",
    "muscleGroup": "Hamstrings & Glutes",
    "primaryMuscles": "Hamstrings, glutes",
    "movementPattern": "Isolation",
    "substitutionGroup": [
      "H&G",
      "Knee Flexion"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Sliders, towel or socks",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "sliders/towel/smooth_floor"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "knee",
      "hip"
    ],
    "substitutionIds": [
      "HG05",
      "HG04",
      "HG06",
      "HG11"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "A scalable knee flexion exercise for users with no leg curl machine. Sits between the glute bridge and the Nordic curl in difficulty.",
    "whatItDoes": "A hamstring curl using sliders, towels or socks. Real hamstring work with no machine.",
    "steps": [
      "Lie on your back with your heels on sliders and hips lifted",
      "Slide your heels out until your legs are almost straight",
      "Pull them back in without letting your hips drop"
    ],
    "commonMistake": "Letting the hips sag as the legs extend.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Lying Leg Curl."
  },
  {
    "id": "CO14",
    "name": "Russian Twist",
    "muscleGroup": "Core",
    "primaryMuscles": "Obliques, rectus abdominis",
    "movementPattern": "Rotation",
    "substitutionGroup": [
      "Core",
      "Rotation"
    ],
    "type": "Isolation",
    "equipmentTier": "Bodyweight",
    "equipment": "Optional dumbbell or plate",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Rep",
    "primaryGoalFit": "General Fitness",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [
      "dumbbell/plate"
    ],
    "impactLevel": "Low",
    "supported": true,
    "active": true,
    "measurementType": "weight_reps",
    "loadUnit": "kg",
    "stressRegions": [
      "lower_back",
      "core"
    ],
    "substitutionIds": [
      "CO10",
      "CO04",
      "CO07",
      "CO05"
    ],
    "substitutionCount": 4,
    "bodyRegion": "upper",
    "whyInDatabase": "The only equipment free rotation exercise in the database. Gives the bodyweight tier a like for like swap for the cable woodchop.",
    "whatItDoes": "A seated twist that trains the obliques with no equipment needed.",
    "steps": [
      "Sit with your knees bent and lean your torso back slightly",
      "Rotate your ribs to one side, then the other",
      "Keep your chest tall and move slowly"
    ],
    "commonMistake": "Whipping side to side with the arms while the torso stays fixed.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Standing Band Rotation."
  },
  {
    "id": "FB10",
    "name": "High Knees",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Hip flexors, calves, core",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Bodyweight",
    "equipment": "None",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 0,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "none"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "High",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "hip"
    ],
    "substitutionIds": [
      "FB08",
      "FB04",
      "FB09",
      "FB03"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "Conditioning that needs a square metre of floor and nothing else. Backs up the jumping jack so no conditioning slot is ever left without a swap.",
    "whatItDoes": "A running drill on the spot. Simple conditioning that needs no space or gear.",
    "steps": [
      "Stand tall and run on the spot",
      "Drive each knee up toward hip height",
      "Stay on the balls of your feet and pump your arms"
    ],
    "commonMistake": "Barely lifting the knees and just jogging on the spot.",
    "safetyNote": "Safe to train close to failure. Stop on sharp or joint pain and swap to Jumping Jack."
  },
  {
    "id": "FB11",
    "name": "Dumbbell Swing",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Glutes, hamstrings, erector spinae, delts",
    "movementPattern": "Hinge",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Hinge"
    ],
    "type": "Compound",
    "equipmentTier": "Basic Gym",
    "equipment": "Single dumbbell",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": true,
    "prescriptionClass": "Power",
    "primaryGoalFit": "Fat Loss",
    "minRir": 2,
    "failureAllowed": false,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "dumbbell"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Moderate",
    "supported": false,
    "active": true,
    "measurementType": "reps",
    "loadUnit": "bodyweight",
    "stressRegions": [
      "lower_back",
      "hip",
      "hamstring"
    ],
    "substitutionIds": [
      "FB01",
      "HG08",
      "HG01",
      "QD13",
      "FB08"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "A like for like swap for the kettlebell swing in gyms with no kettlebells, which is most university gyms.",
    "whatItDoes": "A dumbbell swing. All the power and conditioning of a kettlebell swing without the kettlebell.",
    "steps": [
      "Hold one dumbbell by the head with both hands",
      "Hinge and hike it back between your legs",
      "Snap your hips forward and let it swing to chest height"
    ],
    "commonMistake": "Lifting with the shoulders instead of driving the hips.",
    "safetyNote": "Never taken to failure. End the set as soon as speed or landing quality drops."
  },
  {
    "id": "FB12",
    "name": "Treadmill Interval",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Legs, cardiovascular system",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Treadmill",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 4,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "treadmill"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Moderate",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "ankle",
      "hip"
    ],
    "substitutionIds": [
      "FB06",
      "FB13",
      "FB05",
      "FB10",
      "FB08"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "The most familiar piece of cardio equipment in any gym. Low skill, low impact when walked, scalable to running for fitter users.",
    "whatItDoes": "Walk or run intervals on a treadmill to raise your heart rate and build a base of fitness.",
    "steps": [
      "Warm up at an easy walk for 2 to 3 minutes",
      "Push the pace or incline for the work interval, then ease back to recover",
      "Repeat the work and recover pattern for the set time, then cool down"
    ],
    "commonMistake": "Holding the rails, which takes the work out of it and wrecks your posture.",
    "safetyNote": "Low impact when walked. Progress to running only when comfortable. Stop on any chest pain, dizziness or unusual breathlessness (S06)."
  },
  {
    "id": "FB13",
    "name": "Stairmaster Interval",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Legs, glutes, cardiovascular system",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Stair climber machine",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 4,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "stairmaster"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee",
      "hip",
      "ankle"
    ],
    "substitutionIds": [
      "FB12",
      "FB06",
      "FB05",
      "FB10",
      "QD04"
    ],
    "substitutionCount": 5,
    "bodyRegion": "lower",
    "whyInDatabase": "Hard cardio that also loads the glutes and quads, with far less joint impact than running. A gym staple.",
    "whatItDoes": "Climb a moving staircase at a steady or interval pace to build fitness and leg endurance.",
    "steps": [
      "Start at an easy pace and stand tall, weight through your whole foot",
      "Raise the level for the work interval, then drop it back to recover",
      "Keep an upright posture the whole time and repeat for the set duration"
    ],
    "commonMistake": "Leaning your bodyweight onto the handrails so your legs barely work.",
    "safetyNote": "Low impact but demanding. Keep an upright posture and do not hang on the rails. Stop on chest pain, dizziness or breathlessness (S06)."
  },
  {
    "id": "FB14",
    "name": "Stationary Bike Steady",
    "muscleGroup": "Full Body & Conditioning",
    "primaryMuscles": "Legs, cardiovascular system",
    "movementPattern": "Conditioning",
    "substitutionGroup": [
      "Full Body & Conditioning",
      "Conditioning"
    ],
    "type": "Compound",
    "equipmentTier": "Full Gym",
    "equipment": "Stationary bike",
    "skillLevel": "Beginner",
    "unilateral": false,
    "loadable": false,
    "prescriptionClass": "Interval",
    "primaryGoalFit": "Fat Loss",
    "minRir": 4,
    "failureAllowed": true,
    "spotterRecommended": false,
    "requiredEquipmentTags": [
      "stationary_bike"
    ],
    "optionalEquipmentTags": [],
    "impactLevel": "Low",
    "supported": false,
    "active": true,
    "measurementType": "interval",
    "loadUnit": "rounds",
    "stressRegions": [
      "knee"
    ],
    "substitutionIds": [
      "FB06",
      "FB12",
      "FB05",
      "FB13"
    ],
    "substitutionCount": 4,
    "bodyRegion": "lower",
    "whyInDatabase": "The lowest impact and lowest skill cardio there is. Ideal for recovery days, deloads, exam-period minimal movement, and anyone with knee or ankle limits.",
    "whatItDoes": "A steady, low impact ride to build aerobic fitness or keep moving on an easy day.",
    "steps": [
      "Set the seat so your knee stays slightly bent at the bottom of the pedal stroke",
      "Ride at a conversational pace you could hold for the whole session",
      "Keep a smooth, even cadence and relax your upper body"
    ],
    "commonMistake": "Setting the seat too low, which cramps the knees over a long ride.",
    "safetyNote": "The gentlest cardio option, safe for most limitations. Still stop on chest pain, dizziness or breathlessness (S06)."
  }
]
