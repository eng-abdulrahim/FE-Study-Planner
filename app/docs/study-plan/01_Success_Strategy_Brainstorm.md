# Success Strategy Brainstorm - FE Electrical & Computer

A deep analysis of how to turn the planner into a real success engine that takes
all topics and the remaining days and produces the best possible daily plan.
This is the thinking document; the algorithm is specified in
`02_28_Day_Planner_Design.md`.

No discouraging language anywhere in the product. Internally we still measure
pressure honestly so the plan can react; the user only ever sees supportive,
actionable wording.

---

## 1. The numbers we are working with

- Topics: ~85 (the workbook seed, `src/data/topics.ts`).
- Total planned load: ~150.5 hours across included topics.
- Time to exam: ~28 days (default exam date drives this; it changes live).
- Default availability: ~30-45 min/day, with some Family / Low-Energy / Rest days
  (`DEFAULT_AVAILABILITY`). That is roughly 3.5-4 study hours per week.

The honest gap: 150.5 hours of "ideal" study versus ~3.5-4 hours/week of declared
availability is far more than 28 days can hold at full depth. A naive scheduler
that says "one topic per day" would cover ~28 topics and silently abandon ~57.
That is exactly the failure the user is reporting.

Conclusion: the planner must stop treating a day as a single topic. A day is a
**budget of minutes** that we fill with **several short, purpose-built blocks**.
Breadth (touch everything) and depth (reinforce what matters) are achieved by
mixing block types, not by lengthening days.

---

## 2. Current scheduler limitations

From `src/lib/scheduler.ts` / `plannerLogic.ts`:

1. **One topic per day.** `DayPlan` carries a single `topicId`. The richest a day
   gets is one topic + one task string. No second topic, no review, no practice
   block, no formula recap.
2. **Throughput ceiling.** With one topic/day, max coverage = number of study
   days. With ~85 topics and ~28 days (minus Rest/Family) most topics are never
   scheduled at all.
3. **No explicit coverage goal.** The scheduler picks the next-highest-priority
   topic and rotates a "used" set within a single 7-day window. There is no
   horizon-wide guarantee that every topic is seen at least once.
4. **Review is a task string, not a plan.** "Review phase" only swaps the task
   sentence; it does not schedule mixed practice, formula recall, or weak-topic
   sweeps as their own blocks.
5. **High-yield topics are not over-weighted over time.** A Tier-1, low-confidence
   topic gets the same single slot as a Tier-3 topic once it is "used" for the
   week.
6. **Day modes only shrink one block.** Family/Travel/Work shorten the single
   session and change its sentence; they do not reshape the day into a
   mode-appropriate set of blocks (e.g. Travel = formulas + reading only).
7. **No task-level progress.** You can mark a whole day done, but not "I did the
   review but skipped the practice." Granular progress is what keeps a multi-block
   plan honest.

What is already good and must be preserved:

- The scoring is solid: `computePriority` (exam weight, confidence gap, quick win,
  tier bonus, include/done multipliers) and a **monotonic** `readiness` model.
- Per-date overrides (`dayOverrides`) already model mode, skip, pinned topic,
  locked, planned minutes - the manual-control substrate we must respect.
- Persistence/sync/auto-save are clean and whole-state, so new state fields ride
  along for free if we extend the schema carefully.

The new engine should **reuse the scoring** and **layer a multi-block planner**
on top, rather than replacing the proven primitives.

---

## 3. All available topic data (what we can plan from)

Per topic seed + user state we have: `examWeight`, `tier` (1-3), `plannedHours`,
`section`, `qRange`, `recommendedDepth`, and editable `confidence` (1-5),
`difficulty`, `boredom`, `quickWin`, `status`, `completedHours`, `include`,
`noteUrl`.

Derived per topic (already computed): `priority`, `remainingHours`, `progress`
(0..1), `readinessContribution`, `nextAction`.

This is more than enough to drive intelligent selection: importance (examWeight,
tier), need (confidence gap, low completed hours, status), ease (quickWin,
difficulty - for low-energy/family days), and freshness (last time it appeared /
was logged).

---

## 4. Realistic daily workload

We compute, honestly and internally:

- `remainingHours` = planned - completed (included topics).
- `daysRemaining` to exam.
- `availableMinutes` for each day (from weekday availability, then mode caps).
- `requiredDailyAverage` ~ remainingHours / daysRemaining.
- A `pressure` ratio = required vs available.

We never render "behind". Instead the daily budget is filled with **more, shorter
blocks** when pressure is high, and the message becomes:
"The plan uses several short blocks today to keep progress moving." High pressure
changes the *shape* of the day, not the tone.

Guardrails against burnout:
- Cap blocks per day (e.g. <= 6) and cap single-block length (learn <= ~50 min).
- Respect Rest days fully (no tasks).
- Family/Not-in-mood/Travel/Work cap total minutes hard.
- A "Light day" control the user can press any time.

---

## 5. How to prioritize topics

Keep `computePriority` as the importance signal. For *daily selection* combine:

1. **Importance**: examWeight + tierBonus.
2. **Need**: confidence gap (6 - confidence), low completed-hours ratio,
   status (not-started/studying rank above reviewing/done).
3. **Coverage debt**: has this topic been scheduled yet in this horizon? Untouched
   topics get a strong boost so breadth happens first.
4. **Freshness / spacing**: a topic reviewed/logged very recently is damped for a
   few days unless it is high priority (spaced repetition, not cramming).

The "next new topic to learn" queue is priority-sorted but **coverage-first**:
we always prefer a not-yet-scheduled, not-done topic so every topic gets its
first appearance before we start repeating.

---

## 6. How to include ALL topics

Breadth strategy across the horizon:

- Maintain a horizon-wide `scheduled` set. Each study day spends its first
  learn block(s) on **uncovered** topics (highest priority first).
- With multiple learn blocks on normal days, breadth accumulates quickly:
  e.g. 2-3 learn blocks/day across ~20 normal days covers the bulk; lighter days
  add 1.
- Expose `coverage` (covered / remaining / weak-remaining / high-priority-
  remaining) so the UI can show "X of Y topics covered" and the plan can keep
  pulling remaining topics forward.
- Done/skipped topics are excluded from *new learning* but may still appear in
  review and mixed practice (kept warm), so "done" never means "covered then
  forgotten".

---

## 7. How to review weak / high-weight topics

Every normal day also carries **review** and **practice** blocks that draw from
pools sorted by a review score (examWeight x confidence-gap x tier). These pools
rotate through their **top slice** so the highest-yield and weakest topics
**recur far more often** than a one-and-done low-tier topic. Net effect:

- A Tier-3, strong-confidence topic: appears ~once (a single learn block).
- A Tier-1, weak-confidence topic: appears as a learn block AND repeatedly in
  review/practice/weak blocks -> reinforced many times.

This is the spaced-repetition + high-yield bias that actually moves an exam score.

---

## 8. How to handle multiple topics per day

A day = an ordered list of blocks. Block types:
`learn`, `review`, `practice`, `formula-review`, `mixed-practice`, `light-review`.

The number and mix of blocks come from the day's **budget** and **mode/phase**.
Minutes are distributed across blocks proportionally so the totals always add up
to the budget exactly. Each block is either bound to a topic (learn/review/
practice) or general (formula recap / mixed FE questions / light review).

Example full normal day (~150 min):
learn Kirchhoff 35 - review Complex Numbers 25 - practice Diodes 30 -
formula recap 15 - mixed FE questions 45.

---

## 9. Low-energy / family / travel / work days

These reshape the day, not just shorten one task:

- **Not in mood**: lighter and review-leaning; fewer, shorter blocks; little heavy
  problem-solving. Hard minute cap.
- **Family**: optional/light; 0-15 minutes; one calm review block (or nothing).
  Heavy work is pushed to other days; the day is never punished as "missed".
- **Travel**: mobile-friendly; formula review + reading/conceptual blocks only;
  no heavy calculation/practice.
- **Work**: short and focused; 1-2 compact blocks on the most important topic;
  spillover deferred.

All of these already have soft-miss handling and minute caps in
`src/data/dayModes.ts`; the new engine reuses those caps and adds mode-specific
block shapes.

---

## 10. Final review phase (last 7 days)

Switch the day shape to exam-readiness:

- Daily **mixed FE-style practice**.
- Daily **formula review**.
- Daily **weak-topic** block + **high-weight** block.
- Minimal brand-new heavy learning, EXCEPT topics never touched - those still get
  one focused first pass so nothing is fully skipped.
- Lighter day immediately before the exam (confidence + rest).

---

## 11. Avoiding burnout while maximizing readiness

- Short blocks beat marathon sessions for retention and for actually starting.
- Mixing learn/review/practice keeps a day from feeling like a wall of new
  material.
- Respect the user's declared availability and modes; never silently inflate time.
- Always-positive framing: "today's target", "suggested load", "small steps
  count", "keep going". The plan motivates; it never scolds.
- Granular task done/skip lets a hard day still end with a win ("I did 2 of 4").

---

## 12. Summary of the strategy

1. Treat each day as a minute budget filled with several purpose-built blocks.
2. Cover every topic at least once (coverage-first new-topic selection).
3. Reinforce high-yield and weak topics far more often via rotating review /
   practice / weak / high pools.
4. Reshape days by mode (light/family/travel/work) and by phase (final review).
5. Track progress at the task level and persist it like everything else.
6. Keep all existing data, scoring, persistence, sync, and manual overrides.
7. Speak only in supportive, success-oriented language.
