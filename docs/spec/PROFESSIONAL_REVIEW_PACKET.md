# StrengthHub — Professional Review Packet

**For review by an Accredited Exercise Physiologist**
Prepared 17 July 2026 · Covers the pre-exercise screening, age eligibility, injury handling, and the training safety limits that constrain every program the app produces.

---

## How to read this document

StrengthHub is a mobile app that builds a personalised resistance-training program from a short onboarding questionnaire. Everything in this packet describes **rules the software already enforces** — not proposals. Every number below is pulled directly from the values the built app uses, so what you review is what a user experiences.

We are asking you to confirm one thing above all: **that the seven screening questions and the way they route people are clinically appropriate for an unsupervised adult population.** Until an accredited professional signs this off, the app will not generate a program for any real user — the generation gate ships **closed**.

Two framing points that run through the whole app:

- Programs are always presented to users as **recommended** sets, reps and weights — "guidance to adjust to how you feel on the day, not a medical prescription."
- The safety rules described in Section 4 are **hard limits**. A user can change their goal, their split and their exercises freely, but they can never train outside the safety envelope. No preference, goal or request relaxes it.

### Meet the worked example: "Jordan"

To make the logic concrete, one realistic user runs through all four sections:

> **Jordan** — 20 years old · moderate training experience (roughly a year of consistent lifting) · goal is to **build muscle** · wants to train **4 days a week** · has declared **one knee niggle** · plays **social basketball once a week**.

You will see exactly what the app decides for Jordan at each stage.

---

## Section 1 — Pre-exercise screening

### The seven questions

Before anything is generated, every user answers a seven-question pre-exercise screen, modelled on the **Adult Pre-Exercise Screening System** used in Australia. Completing the screen does not by itself declare a user safe — that is deliberate. When something is flagged, the app routes the person to a professional rather than quietly giving them a gentler workout.

The questions, in the exact words the user sees:

1. Has a doctor ever said you have a heart condition, or that you should only exercise under medical supervision?
2. Do you feel chest pain during physical activity?
3. In the past month, have you had chest pain when you were not physically active?
4. Do you lose balance because of dizziness, or have you ever lost consciousness?
5. Do you have a bone, joint or soft-tissue problem that physical activity could worsen?
6. Are you currently pregnant, or have you given birth within the past six months?
7. Is there any other reason you should not do physical activity?

There is also an optional free-text box ("anything else we should know?"). Its contents are scanned before being treated as harmless — if it mentions a cardiac, neurological, respiratory or metabolic condition, pregnancy, recent surgery, or medical-advice language ("my doctor said", "I was told not to"), the user is routed to professional clearance and nothing generates until cleared.

### The four possible outcomes

Every user lands on **exactly one** of these:

| Outcome | What triggers it | What the app does |
|---|---|---|
| **Do not generate** | An acute red flag: current chest pain, symptoms at rest (**Q3 = Yes**), or a professional has advised against exercise. | Blocks generation entirely. Advises the user to seek medical care. Hard stop. |
| **Require professional clearance** | Any cardiovascular / metabolic / renal condition, chest pain or breathlessness with activity, dizziness or fainting, pregnancy or recent birth, recent surgery (**Q1, Q2, Q4, Q6, Q7 = Yes**) — **or** a joint problem the follow-ups show is currently painful, under treatment or exercise-restricted. | Does not generate. Directs the user to a GP, physiotherapist or accredited exercise professional. Unlocks only after the user confirms clearance, then applies any conditions the professional set. Pregnancy follows its own clearance path and is never treated as a generic injury. |
| **Modify and continue** | A joint or soft-tissue flag (**Q5 = Yes**) that the follow-ups confirm is **minor** — not currently painful, not under active treatment, not exercise-restricted, and resolved or stable. | Generates, but with the flagged region's modifications applied to every session (see Section 3). |
| **Clear** | No flags. | Generates normally. |

**Precedence** — if more than one thing is flagged, the most conservative outcome wins: a Q3 "yes" is a hard stop even if everything else is clear; any clearance-level flag outranks a modify-level one.

### The joint follow-up flow (asked only when Q5 = Yes)

A bare yes/no to "do you have a joint problem?" cannot decide the route — a settled old niggle and an actively flaring injury both answer "yes." So when Q5 is Yes, the app asks four follow-ups plus a free-text question, and routes on the answers:

| Follow-up question | Answer that keeps them on **Modify** | Answer that sends them to **Clearance** |
|---|---|---|
| Is the problem painful right now? | No / mild and settling | Yes, currently painful |
| Is it being treated by a health professional? | No / discharged | Yes, under active treatment |
| Have you been told to limit or avoid exercise? | No | Yes, exercise restricted |
| Is the issue resolved, or still active? | Resolved or stable | Still active / flaring / **unsure** |
| Which movements make it worse? (free text) | Stored and used to filter exercises | — |

If **every** answer is in the left column, the user is routed to **Modify and continue** and the affected region is stored. If **any** answer is in the right column, they go to **professional clearance**. "Unsure" about whether an injury is active is deliberately treated as a clearance trigger, not a modify one.

### Jordan through Section 1

Jordan answers **No** to questions 1, 2, 3, 4, 6 and 7, and **Yes** to question 5 (the knee). That single Yes opens the follow-ups:

- Painful right now? **No — mild and settling.**
- Under professional treatment? **No.**
- Told to limit or avoid exercise? **No.**
- Resolved or still active? **Resolved / stable.**
- Which movements make it worse? **"Deep squatting."**

All four answers sit in the Modify column, so the app routes Jordan to **Modify and continue** and stores **knee** as the affected region. The "deep squatting" note is kept to filter exercises. The modifications stay on until Jordan reports **four symptom-free weeks**.

> For contrast: if Jordan had answered "yes, painful right now" to the first follow-up, the outcome flips to **Require professional clearance** and no program is generated until a professional clears them. This is the single most important routing behaviour for you to confirm.

---

## Section 2 — Age eligibility

### StrengthHub is strictly 18+

Age is checked **before** the screening questions, and it decides whether a person is eligible at all.

- Age is taken from the user's **date of birth** and is **never** filled in with a default number. (An earlier design that assumed "20" when age was missing has been removed.)
- **18 and over** → the standard adult screen (Section 1) runs. This is the only pathway that generates a program.
- **Under 18** → **blocked entirely.** There is no separate youth screen and no guardian-consent pathway. The app is designed and screened for adults only.
- **Date of birth missing or unreadable** → treated as **unverified** and blocked, with a prompt to add a valid date of birth. Age is never assumed.

The final terms checkbox in onboarding now also requires the user to confirm, in plain words, that they are **18 or older** before they can continue.

The messages a blocked user sees are neutral and non-diagnostic:

- Under 18: *"StrengthHub creates personalised training programs for people aged 18 and over, so we can't build one for you yet."*
- No date of birth: *"Please add your date of birth so we can build your program safely."*

### Jordan through Section 2

Jordan is **20**, so the age check passes cleanly and routes them into the adult screen. A **17-year-old** with identical answers would never reach the screening questions at all — they are stopped at the age gate with the message above, with no program generated and no youth or guardian workaround.

---

## Section 3 — Injury handling

### Two ways an injury is handled

Section 1 already sorts injuries into two paths:

- **Clearance path** — anything currently painful, under treatment, exercise-restricted, or uncertain. The app generates **nothing** until a professional clears the person, then honours any conditions they set.
- **Modify path** — a genuinely minor, settled joint issue. The app generates a program but applies a fixed set of modifications to the flagged body region, on **every** session, until four symptom-free weeks are reported.

The modify path is rule-driven, not improvised. Each of the six supported regions (lower back, knee, shoulder, wrist, hip, ankle) has an authored modification row. For the flagged region the app:

1. **Excludes** a specific list of exercises outright — they never appear in the program.
2. **Downgrades** a second list — these stay available but are prescribed with an extra rep in reserve as a safety cushion.
3. **Prefers** supported, machine-based, partial-range and low-impact options for that region.
4. **Raises the minimum reps-in-reserve** for the affected region's work by one.
5. **Excludes** whatever specific movements the user named as aggravating.
6. **Schedules a review** of the modifications after a set period.

### The knee rule (Jordan's region), exactly as applied

For a knee flag, the app enforces the following — these are the literal values the software uses:

- **Excluded outright (never programmed):** Jump Squat, Burpee, Jumping Jack, High Knees, Nordic Hamstring Curl.
- **Downgraded (kept, but with +1 rep in reserve):** Barbell Back Squat, Front Squat, Bulgarian Split Squat, Walking Lunge, Step Up, Split Squat, Reverse Nordic Curl, Sissy Squat, Rowing Machine Interval, Assault/Stationary Bike Interval, Bear Crawl.
- **Preferred:** supported and machine leg work, partial-range and hip-dominant options, low-impact movements only.
- **Reps-in-reserve bump:** +1 for knee-loaded work.
- **Review after:** 4 weeks.
- **Coaching rationale carried in the app:** cut jumping and deep loaded squats; keep quads and hamstrings trained through leg press in a comfortable range, leg-curl and leg-extension machines, and hinge patterns that spare the knee.

> **A point we want your explicit view on:** the knee rule *downgrades* rather than *excludes* the big squat patterns (e.g. Barbell Back Squat stays in, but with the extra rep-in-reserve cushion). For a minor, settled, non-painful niggle this is the intended behaviour — but we would like you to confirm that keeping loaded squat variations (with the cushion) is appropriate for the modify path, versus excluding them outright.

### Jordan through Section 3

Because Jordan's knee routed to **Modify**, none of the five excluded exercises can appear anywhere in their program — and indeed none do. The knee-pattern lifts that remain are prescribed with the safety cushion. In Jordan's actual generated week, the affected lifts carry **1 rep in reserve more** than the same lift would for an uninjured user:

| Lift in Jordan's program | Normal reps-in-reserve | Jordan's reps-in-reserve (knee) |
|---|---|---|
| Leg Press | 1 | **2** |
| Bulgarian Split Squat | 1 | **2** |
| Barbell Back Squat | 1 | **2** |
| Step Up | 1 | **2** |
| Seated Leg Curl / Lying Leg Curl | 1 | **2** |

Hip-dominant and non-knee work (Hip Thrust, Romanian Deadlift, calf and core work, all upper-body lifts) is prescribed normally. "Deep squatting" — the movement Jordan named — is on record and used to steer swaps away from that pattern if Jordan later asks to change an exercise. The whole modification set lifts automatically once Jordan logs four symptom-free weeks.

---

## Section 4 — Training safety limits

These are the hard caps that constrain **every** prescription, for every user, regardless of goal or preference. They cannot be overridden.

### The fixed limits

| Limit | Value | Purpose |
|---|---|---|
| Minimum reps on a loaded lift | **4 reps** | Never program a loaded lift heavier than a 4-rep range. |
| Maximum load intensity | **88% of 1-rep-max** | Caps how heavy any loaded set can be. |
| Reps-in-reserve floor | Every exercise carries a minimum; explosive/"power" work never nearer than **2 reps** from failure; beginners never nearer than **2**. | Keeps users away from true failure where the risk is highest. |
| Weekly load increase cap | The **smaller** of **5% of the current load** or **2.5 kg (upper body) / 5 kg (lower body)** | Prevents jumps that outrun tissue adaptation. |
| Missed-rep back-off | Load drops **10%** and rebuilds | Recovers safely from a bad session rather than grinding. |
| Deload trigger | After **3 consecutive stalls** on a lift, or **offered** every **6 weeks** | Forces recovery before overreaching. |
| Deload prescription | Sets **−40%**, load **held**, **+1** rep-in-reserve | An easy week that keeps the movement without adding fatigue. |
| Beginner ramp | First **4 weeks** — no explosive/advanced work, reps-in-reserve kept at ≥2 | Eases true beginners in. |
| First-session loading | Week one starts light (around 4–5 reps in reserve); the working weight is found over the **first two sessions** | No user is asked to load heavy on day one. |

A separate hard rule (not one of the four sections, noted for completeness) ends any exercise immediately on a stop-symptom such as chest pain or sharp joint pain and routes it to the injury/clearance logic.

### Jordan's actual recommended program

The app places Jordan on an **Upper / Lower split across the four chosen days** (Mon Lower, Tue Upper, Thu Lower, Fri Upper; Wednesday, Saturday and Sunday rest — note Saturday is deliberately kept clear of leg training because of basketball, see below). For the "build muscle" goal, loaded lifts are prescribed at **3–4 sets of 6–12 reps, 1–2 reps in reserve, 90–180 s rest, at or below 80% of 1-rep-max** — comfortably inside the 4-rep / 88% ceilings.

Here is Jordan's real **Monday (Lower)** session, with the knee cushion and every limit visible:

| Exercise | Muscle | Sets × reps | Reps in reserve | Intensity cap | Rest |
|---|---|---|---|---|---|
| Leg Press | Quads | 3 × 6–12 | 2 *(knee cushion)* | ≤80% 1RM | ≥90 s |
| Hip Thrust | Hamstrings & Glutes | 3 × 6–12 | 1 | ≤80% 1RM | ≥90 s |
| Bulgarian Split Squat | Quads | 3 × 6–12 | 2 *(knee cushion)* | ≤80% 1RM | ≥90 s |
| Seated Leg Curl | Hamstrings & Glutes | 3 × 6–12 | 2 *(knee cushion)* | ≤80% 1RM | ≥90 s |
| Seated Calf Raise | Calves | 3 × 6–12 | 1 | ≤80% 1RM | ≥90 s |
| Cable Crunch | Core | 3 × 6–12 | 1 | ≤80% 1RM | ≥90 s |

Every loaded lift respects the 4-rep minimum (lowest programmed is 6), the 88% cap (prescribed ≤80%), and the reps-in-reserve floor (raised to 2 on the knee lifts).

**Weekly training volume** for Jordan, with each muscle's target range in brackets: Chest 11 (10–16), Back 12 (10–16), Quads 12 (7–13), Hamstrings & Glutes 12 (7–13), Shoulders 11 (10–16), Biceps 6 (5–8), Triceps 6 (5–8), Calves 6 (5–8), Core 6 (5–8). Every muscle sits inside its floor and cap.

**The basketball adjustment** — because Jordan plays weekly, the app treats it as real training load: it **cuts the weekly set target for Quads and Hamstrings & Glutes from 10–16 down to 7–13** (a 3-set reduction on each leg muscle, within the intended 2–4 set cut), keeps any Lower day at least **24 hours** clear of the basketball session, and removes one conditioning interval slot. This is why Saturday is left free of leg work.

### Progression, the load cap, and the deload trigger — a real trajectory

To show the limits firing over time, here is the app's actual session-by-session decision for one of Jordan's loaded lifts (Dumbbell Bench Press), starting at 24 kg:

| Session | What Jordan logged | App decision | Load |
|---|---|---|---|
| 1 | All sets to the top of the range at target effort | Hold — one more strong session and the weight goes up | 24 kg |
| 2 | Same again | **Progress** — but the increase is **capped to +1 kg** by the 5%-per-week rule (a 2 kg dumbbell jump would exceed it) | 24 → **25 kg** |
| 3 | Strong again | Hold | 25 kg |
| 4 | Strong again | **Progress** — capped to **+1.5 kg** | 25 → **26.5 kg** |
| 5 | Missed the reps / hit failure | **Back off 10%** and rebuild | 26.5 → 24 kg |
| 6 | Missed again (second stall) | Back off 10% again | 24 → 21.5 kg |
| 7 | Missed again (third stall) | **Deload triggered** — sets −40%, load −10%, +1 rep in reserve, then resume | 21.5 → **19.5 kg** |

This shows all three limits doing their job on a single lift: the **weekly load cap** holding the increases to 1–1.5 kg instead of the raw 2 kg dumbbell jump, the **10% back-off** on a missed session, and the **deload firing on the third consecutive stall**.

### One deliberate exception, flagged for your sign-off

During a **deload week**, the app **intentionally lets weekly set volume drop below the normal minimum floor** for the muscles involved. This is by design — a deload's whole purpose is to reduce volume — and every **per-exercise** safety limit (rep minimums, intensity cap, reps-in-reserve floors) still holds throughout. We are flagging it explicitly because it is the one place the app knowingly steps outside a normal floor, and we want your confirmation that a planned, temporary volume drop during a deload is appropriate.

---

## What we are asking you to confirm

1. The **seven screening questions** and the **four-outcome routing** (Section 1) are clinically appropriate for an unsupervised adult population — this is the open launch blocker.
2. The **joint follow-up flow** correctly separates "modify" from "needs clearance," including treating "unsure" as a clearance trigger.
3. The **injury modify path**, specifically **downgrading vs. excluding loaded squat patterns** for a minor knee flag (Section 3).
4. The **training safety limits** in Section 4, including the **deliberate volume-floor drop during a deload**.

Until this sign-off is on file, StrengthHub generates no program for any real user. Nothing in this document has been softened for review — the numbers, exercise lists and the worked example are exactly what the built app produces.
