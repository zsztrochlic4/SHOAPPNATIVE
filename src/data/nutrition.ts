import type { Goal } from '../store/types'

/* ------------------------------------------------------------------ */
/*  Food knowledge base: powers the on-device food-log review.         */
/*  Plain-language, education-first. Not a calorie tracker.            */
/* ------------------------------------------------------------------ */

export type FoodTag =
  | 'protein' | 'veg' | 'fruit' | 'wholegrain' | 'refined'
  | 'fried' | 'sugary' | 'processed' | 'dairy' | 'legume'
  | 'healthyfat' | 'sugary-drink' | 'alcohol' | 'water'

export type FoodTier = 'great' | 'good' | 'moderate' | 'limit'

export interface FoodKB {
  keywords: string[]
  label: string
  tags: FoodTag[]
  tier: FoodTier
}

/** Keyword → food classification. First keyword match wins per entry. */
export const FOOD_KB: FoodKB[] = [
  // Lean proteins
  { keywords: ['chicken breast', 'chicken', 'grilled chicken'], label: 'chicken', tags: ['protein'], tier: 'great' },
  { keywords: ['turkey', 'turkey mince'], label: 'turkey', tags: ['protein'], tier: 'great' },
  { keywords: ['egg', 'eggs', 'omelette', 'scrambled'], label: 'eggs', tags: ['protein'], tier: 'great' },
  { keywords: ['salmon', 'mackerel', 'sardine'], label: 'oily fish', tags: ['protein', 'healthyfat'], tier: 'great' },
  { keywords: ['tuna', 'white fish', 'cod', 'fish'], label: 'fish', tags: ['protein'], tier: 'great' },
  { keywords: ['greek yogurt', 'greek yoghurt'], label: 'Greek yogurt', tags: ['protein', 'dairy'], tier: 'great' },
  { keywords: ['cottage cheese'], label: 'cottage cheese', tags: ['protein', 'dairy'], tier: 'great' },
  { keywords: ['whey', 'protein shake', 'protein powder'], label: 'protein shake', tags: ['protein'], tier: 'good' },
  { keywords: ['tofu', 'tempeh', 'edamame'], label: 'tofu / soy', tags: ['protein', 'legume'], tier: 'great' },
  { keywords: ['prawn', 'shrimp'], label: 'prawns', tags: ['protein'], tier: 'great' },
  { keywords: ['lean beef', 'steak', 'beef mince', 'mince'], label: 'beef', tags: ['protein'], tier: 'good' },
  { keywords: ['pork', 'gammon'], label: 'pork', tags: ['protein'], tier: 'good' },

  // Legumes
  { keywords: ['lentil', 'dahl', 'dhal', 'daal'], label: 'lentils', tags: ['legume', 'protein', 'wholegrain'], tier: 'great' },
  { keywords: ['chickpea', 'hummus', 'falafel'], label: 'chickpeas', tags: ['legume', 'protein'], tier: 'great' },
  { keywords: ['beans', 'kidney bean', 'black bean', 'baked beans'], label: 'beans', tags: ['legume', 'protein'], tier: 'great' },

  // Vegetables
  { keywords: ['broccoli', 'spinach', 'kale', 'salad', 'veg', 'vegetable', 'pepper', 'courgette', 'carrot', 'tomato', 'cucumber', 'mushroom', 'onion', 'cabbage', 'cauliflower', 'greens', 'lettuce', 'sweetcorn', 'peas'], label: 'vegetables', tags: ['veg'], tier: 'great' },
  { keywords: ['avocado'], label: 'avocado', tags: ['veg', 'healthyfat'], tier: 'great' },

  // Fruit
  { keywords: ['banana', 'apple', 'berries', 'blueberry', 'strawberry', 'orange', 'grapes', 'fruit', 'mango', 'pineapple', 'kiwi', 'melon'], label: 'fruit', tags: ['fruit'], tier: 'great' },

  // Whole carbs
  { keywords: ['oats', 'porridge', 'overnight oats'], label: 'oats', tags: ['wholegrain'], tier: 'great' },
  { keywords: ['brown rice', 'wholemeal', 'wholewheat', 'whole grain', 'wholegrain', 'quinoa', 'wholemeal bread', 'whole wheat'], label: 'wholegrains', tags: ['wholegrain'], tier: 'great' },
  { keywords: ['sweet potato'], label: 'sweet potato', tags: ['wholegrain', 'veg'], tier: 'great' },
  { keywords: ['potato', 'jacket potato', 'mashed potato'], label: 'potato', tags: ['wholegrain'], tier: 'good' },

  // Refined carbs
  { keywords: ['white rice', 'rice'], label: 'white rice', tags: ['refined'], tier: 'moderate' },
  { keywords: ['pasta', 'noodles', 'spaghetti'], label: 'pasta', tags: ['refined'], tier: 'moderate' },
  { keywords: ['white bread', 'toast', 'bagel', 'sandwich', 'wrap', 'bread'], label: 'bread', tags: ['refined'], tier: 'moderate' },
  { keywords: ['cereal'], label: 'cereal', tags: ['refined', 'sugary'], tier: 'moderate' },

  // Healthy fats
  { keywords: ['peanut butter', 'almond', 'nuts', 'walnut', 'cashew', 'seeds', 'olive oil', 'nut butter'], label: 'nuts / healthy fats', tags: ['healthyfat'], tier: 'good' },
  { keywords: ['cheese'], label: 'cheese', tags: ['dairy', 'healthyfat'], tier: 'good' },
  { keywords: ['milk', 'yogurt', 'yoghurt'], label: 'dairy', tags: ['dairy', 'protein'], tier: 'good' },

  // Fried / fast food
  { keywords: ['fried', 'fries', 'chips', 'mcdonald', 'kfc', 'takeaway', 'take away', 'kebab', 'fried chicken', 'nuggets', 'pizza', 'burger', 'crisps'], label: 'fried / fast food', tags: ['fried', 'processed'], tier: 'limit' },

  // Sugary
  { keywords: ['chocolate', 'cake', 'biscuit', 'cookie', 'sweets', 'candy', 'donut', 'doughnut', 'ice cream', 'pastry', 'croissant', 'muffin', 'dessert', 'sugar', 'haribo'], label: 'sweets', tags: ['sugary'], tier: 'limit' },

  // Processed
  { keywords: ['sausage', 'bacon', 'ham', 'hot dog', 'salami', 'pepperoni', 'processed', 'ready meal', 'instant noodle'], label: 'processed meat', tags: ['processed'], tier: 'limit' },

  // Drinks
  { keywords: ['coke', 'cola', 'soda', 'energy drink', 'lucozade', 'fizzy', 'fanta', 'sprite', 'monster', 'red bull', 'juice', 'smoothie'], label: 'sugary drinks', tags: ['sugary-drink'], tier: 'limit' },
  { keywords: ['beer', 'wine', 'vodka', 'alcohol', 'cocktail', 'spirits', 'cider', 'pint'], label: 'alcohol', tags: ['alcohol'], tier: 'limit' },
  { keywords: ['water', 'sparkling water'], label: 'water', tags: ['water'], tier: 'great' },
  { keywords: ['coffee', 'tea', 'black coffee'], label: 'coffee / tea', tags: [], tier: 'good' },
]

/* ------------------------------------------------------------------ */
/*  "What to aim for": the plate guide                                 */
/* ------------------------------------------------------------------ */
export interface PlateSection {
  portion: string
  title: string
  examples: string
  color: string
}

export const PLATE_GUIDE: PlateSection[] = [
  { portion: 'Half', title: 'Vegetables & fruit', examples: 'Broccoli, peppers, salad, berries: colour and fibre that fill you up', color: 'rgb(var(--brand-400))' },
  { portion: 'A quarter', title: 'Lean protein', examples: 'Chicken, fish, eggs, tofu, beans, Greek yogurt at every meal', color: 'rgb(var(--accent-blue))' },
  { portion: 'A quarter', title: 'Smart carbs', examples: 'Oats, rice, potato, wholegrain bread: fuel for training & study', color: 'rgb(var(--accent-orange))' },
  { portion: 'A thumb', title: 'Healthy fats', examples: 'Olive oil, nuts, avocado, oily fish. A little goes a long way', color: 'rgb(var(--accent-purple))' },
]

/* ------------------------------------------------------------------ */
/*  Good / moderation / limit: the simple food tiers                   */
/* ------------------------------------------------------------------ */
export interface FoodTierGuide {
  tier: FoodTier
  title: string
  desc: string
  items: string[]
  color: string
}

export const FOOD_TIERS: FoodTierGuide[] = [
  {
    tier: 'great', title: 'Eat freely', color: 'rgb(var(--brand-400))',
    desc: 'Build most meals from these. Filling, nutritious and hard to overeat.',
    items: ['Vegetables & salad', 'Fruit', 'Chicken, fish, eggs', 'Beans, lentils, tofu', 'Greek yogurt', 'Oats, potatoes, wholegrains'],
  },
  {
    tier: 'moderate', title: 'In moderation', color: 'rgb(var(--accent-orange))',
    desc: 'Useful fuel and totally fine. Just keep portions sensible.',
    items: ['White rice, pasta, bread', 'Cheese & full-fat dairy', 'Nuts & nut butters', 'Lean red meat', 'Dried fruit & honey'],
  },
  {
    tier: 'limit', title: 'Keep occasional', color: 'rgb(var(--danger))',
    desc: 'No food is banned. Enjoy these sometimes, not as the base of your day.',
    items: ['Fried & fast food', 'Sweets, cake, chocolate', 'Sugary & energy drinks', 'Processed meats', 'Alcohol'],
  },
]

/* ------------------------------------------------------------------ */
/*  Goal-specific eating guidance                                      */
/* ------------------------------------------------------------------ */
export const GOAL_GUIDES: Record<Goal, { headline: string; points: string[] }> = {
  'build-muscle': {
    headline: 'Eat to grow',
    points: [
      'Protein at every meal. Aim for a palm-sized portion (chicken, eggs, yogurt, tofu).',
      'Eat slightly more than you burn. A little extra rice, oats or fruit fuels new muscle.',
      'Carbs around training give you better sessions and recovery.',
      'Spread protein across the day rather than one huge hit.',
    ],
  },
  'lose-fat': {
    headline: 'Eat to lean out',
    points: [
      'Fill half your plate with veg and salad: high volume, low calories, very filling.',
      'Keep protein high to protect muscle and stay full between meals.',
      'Watch the liquid calories: sugary drinks, juice and alcohol add up fast.',
      'Swap fried & sugary extras for fruit, yogurt or a smaller portion, not zero.',
    ],
  },
  'gain-strength': {
    headline: 'Eat to lift heavier',
    points: [
      'Fuel hard sessions with smart carbs: oats, rice, potatoes.',
      'Protein at each meal supports recovery between heavy days.',
      'Do not under-eat. Strength suffers when you are running on empty.',
      'Sleep and water matter as much as food for strength.',
    ],
  },
  'stay-healthy': {
    headline: 'Eat to feel good',
    points: [
      'Aim for balance: protein, plenty of veg, smart carbs, a little healthy fat.',
      'Variety beats perfection. Mix up your veg and protein sources.',
      'Hydrate well and limit sugary drinks.',
      'Cook more than you order in. You control what goes in.',
    ],
  },
}

/* ------------------------------------------------------------------ */
/*  Short education lessons                                            */
/* ------------------------------------------------------------------ */
export interface NutritionLesson {
  id: string
  icon: string
  title: string
  summary: string
  minutes: number
  body: string[]
}

export const NUTRITION_LESSONS: NutritionLesson[] = [
  {
    id: 'nl-protein', icon: 'utensils', title: 'Protein, simply', summary: 'How much you really need and where to get it', minutes: 3,
    body: [
      'Protein is the building block for muscle and keeps you full, so it helps whether you want to gain muscle or lose fat.',
      'A simple target: a palm-sized portion of a protein food at each main meal. Think chicken, fish, eggs, Greek yogurt, beans or tofu.',
      'You do not need shakes or supplements. They are just a convenient option when real food is hard to grab.',
    ],
  },
  {
    id: 'nl-carbs', icon: 'flame', title: 'Carbs are not the enemy', summary: 'Smart carbs fuel training and focus', minutes: 3,
    body: [
      'Carbs are your body and brain\'s main fuel. Cutting them all out usually just makes you tired and cranky.',
      'Lean on "smart" carbs most of the time: oats, rice, potatoes, wholegrain bread, fruit. They come with fibre and keep energy steady.',
      'Keep sugary and refined carbs as the occasional extra, not the base of every meal.',
    ],
  },
  {
    id: 'nl-moderation', icon: 'leaf', title: 'Nothing is banned', summary: 'Why "good" and "bad" food is a trap', minutes: 2,
    body: [
      'There are no forbidden foods, only how often and how much. Chocolate, pizza and a night out all fit a healthy diet.',
      'Aim for the 80/20 idea: build around 80% nutritious whole foods, and leave 20% for the things you simply enjoy.',
      'Guilt does not burn calories. Enjoy the treat, then get back to your normal meals.',
    ],
  },
  {
    id: 'nl-budget', icon: 'target', title: 'Eating well on a budget', summary: 'Great food does not need to be expensive', minutes: 3,
    body: [
      'Cheap protein heroes: eggs, tinned tuna, beans, lentils, frozen chicken, milk and Greek yogurt.',
      'Frozen veg is as nutritious as fresh, lasts for weeks and cuts waste. Keep a bag in the freezer.',
      'Cook once, eat twice. Batch a big pot of chilli, curry or pasta and you have lunches sorted for days.',
    ],
  },
  {
    id: 'nl-labels', icon: 'brain', title: 'Reading labels fast', summary: 'Spot hidden sugar in seconds', minutes: 2,
    body: [
      'Check the "per 100g" column to compare products fairly, ignoring the marketing on the front.',
      'Sugar hides under many names: syrup, dextrose, fructose, concentrate. If one is near the top of the ingredients, it is a sugary product.',
      'A short ingredients list of things you recognise is usually a good sign.',
    ],
  },
  {
    id: 'nl-hydration', icon: 'droplet', title: 'Water & hunger', summary: 'Why hydration helps your diet', minutes: 2,
    body: [
      'Mild thirst can feel like hunger. A glass of water before deciding on a snack often settles it.',
      'Aim to sip through the day. A reusable bottle on your desk is the easiest reminder.',
      'Drinks with calories (juice, fizzy drinks, fancy coffees, alcohol) count too. Water is the free, zero-calorie default.',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Q&A: answers the "ask anything about food" box                     */
/* ------------------------------------------------------------------ */
export interface QAItem {
  keywords: string[]
  q: string
  a: string
}

export const NUTRITION_QA: QAItem[] = [
  { keywords: ['how much protein', 'protein need', 'enough protein', 'protein a day'], q: 'How much protein do I need?', a: 'A practical guide is a palm-sized portion of a protein food at each main meal, which puts most students in a good range. If you train hard and want muscle, lean toward the higher end and spread it across the day.' },
  { keywords: ['carbs at night', 'carbs bad', 'eat carbs', 'late carbs', 'rice bad'], q: 'Are carbs bad, or bad at night?', a: 'No. Carbs are fuel and the time of day barely matters for body composition. Your total intake over the day does. Lean on oats, rice, potatoes and fruit, and keep sugary stuff occasional.' },
  { keywords: ['lose fat', 'lose weight', 'fat loss', 'cut', 'leaner'], q: 'How do I lose fat?', a: 'Eat a bit less than you burn, keep protein high and fill half your plate with veg so you stay full. Watch liquid calories. You do not need to cut out any food group. Small, steady changes win.' },
  { keywords: ['build muscle', 'gain muscle', 'bulk', 'grow', 'get bigger'], q: 'How do I build muscle?', a: 'Train hard, eat slightly more than you burn, and get protein at every meal. Smart carbs around training help. Muscle is built slowly, so consistency over weeks beats any single perfect day.' },
  { keywords: ['snack', 'healthy snack', 'snacking'], q: 'What are good snacks?', a: 'Reach for protein-and-fibre snacks that keep you full: Greek yogurt and fruit, a handful of nuts, hummus and veg, cottage cheese, or a boiled egg. They beat crisps and sweets between lectures.' },
  { keywords: ['cheap', 'budget', 'student', 'save money'], q: 'How do I eat well cheaply?', a: 'Build meals around eggs, tinned tuna, beans, lentils, frozen chicken and frozen veg. Batch cook and reuse. Check the Budget Eats tab for full recipes with rough costs.' },
  { keywords: ['breakfast', 'morning'], q: 'What should I eat for breakfast?', a: 'Aim for protein plus a smart carb: overnight oats with yogurt and fruit, eggs on wholegrain toast, or Greek yogurt with berries and nuts. It keeps you full through morning lectures.' },
  { keywords: ['sugar', 'sweet', 'chocolate', 'craving'], q: 'Is sugar really that bad?', a: 'A little is fine. It is the amount that matters. Sugary drinks and snacks add up fast without filling you up. Enjoy a treat, just keep it as the 20%, not the base of your day.' },
  { keywords: ['alcohol', 'drinking', 'beer', 'night out'], q: 'How does alcohol affect my goals?', a: 'Alcohol is calorie-dense, often comes with late-night food, and blunts recovery and muscle growth the next day. It can still fit, just keep nights occasional and have water alongside.' },
  { keywords: ['supplement', 'whey', 'creatine', 'protein powder', 'vitamin'], q: 'Do I need supplements?', a: 'Most people do not. Real food covers it. Protein powder is just a convenient protein source, and creatine is the one with strong evidence for training. Food first, supplements only to fill gaps.' },
  { keywords: ['vegetarian', 'vegan', 'plant', 'meat free', 'no meat'], q: 'How do I get protein without meat?', a: 'Plenty of options: eggs, dairy and Greek yogurt, plus beans, lentils, chickpeas, tofu, tempeh, edamame and soy milk. Mixing different plant sources across the day covers everything you need.' },
  { keywords: ['eat out', 'restaurant', 'takeaway', 'fast food'], q: 'How do I eat out without ruining things?', a: 'Pick a meal with a clear protein and some veg, watch the sides and sauces, and go easy on sugary drinks. One meal out never undoes your progress. Your overall week is what counts.' },
  { keywords: ['water', 'hydration', 'drink'], q: 'How much water should I drink?', a: 'Sip through the day and aim for pale-yellow urine as a simple check. Keep a bottle nearby. Remember juice, fizzy drinks and alcohol carry calories. Water is the free default.' },
  { keywords: ['meal prep', 'prep', 'batch'], q: 'How do I start meal prepping?', a: 'Cook one big base, rice or pasta and a protein, then portion it into containers for two or three days. Add frozen veg and a sauce to keep it interesting. Start with just lunches.' },
]
