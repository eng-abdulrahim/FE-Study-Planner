import { describe, it, expect } from "vitest";
import { buildInitialState } from "../data/defaults";
import { TOPICS } from "../data/topics";
import type { DailyStudyTask } from "../types/planner";
import { lockDayIn, setDayModeIn } from "./dayOverrides";
import { buildModel } from "./plannerLogic";
import { exportJson, hydrate } from "./storage";
import { serializeEnvelope } from "./syncEnvelope";
import {
  clearTopicDoneTasksIn,
  regeneratePlanIn,
  reopenTopicIn,
  resetDayDoneIn,
  resetPlanTuningIn,
  resetTaskIn,
  setDayDoneIn,
  setPlanTuningIn,
  setTaskDoneIn,
  skipTaskIn,
} from "./planActions";

const TID = TOPICS[0].id;
const DATE = "2026-06-22";

function topicTask(over: Partial<DailyStudyTask> = {}): DailyStudyTask {
  return {
    id: `${DATE}|learn|${TID}`,
    topicId: TID,
    title: TOPICS[0].topicName,
    section: TOPICS[0].section,
    type: "learn",
    plannedMinutes: 30,
    reason: "New topic.",
    status: "planned",
    ...over,
  };
}

function generalTask(): DailyStudyTask {
  return {
    id: `${DATE}|mixed-practice|g4`,
    title: "Mixed FE practice",
    type: "mixed-practice",
    plannedMinutes: 25,
    reason: "Mixed questions.",
    status: "planned",
  };
}

describe("setTaskDoneIn", () => {
  it("marks done, logs the session, and adds the hours for a topic task", () => {
    const state = buildInitialState();
    const next = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    expect(next.taskStatus[topicTask().id]).toBe("done");
    const entry = next.studyLog.find((e) => e.taskId === topicTask().id);
    expect(entry).toBeTruthy();
    expect(entry?.minutes).toBe(30);
    expect(entry?.topicId).toBe(TID);
    expect(next.topics[TID].completedHours).toBeCloseTo(0.5, 5);
  });

  it("is idempotent - a second Done does not double-log or double-count hours", () => {
    const state = buildInitialState();
    let next = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    next = setTaskDoneIn(next, DATE, topicTask(), () => "log2");
    expect(next.studyLog.filter((e) => e.taskId === topicTask().id)).toHaveLength(1);
    expect(next.topics[TID].completedHours).toBeCloseTo(0.5, 5);
  });

  it("marks a general (topic-less) task done without writing a log entry", () => {
    const state = buildInitialState();
    const next = setTaskDoneIn(state, DATE, generalTask(), () => "log1");
    expect(next.taskStatus[generalTask().id]).toBe("done");
    expect(next.studyLog).toHaveLength(0);
  });

  it("flips the topic's canonical status to done so the Topics table reflects it", () => {
    const state = buildInitialState();
    expect(state.topics[TID].status).toBe("not-started");
    const next = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    expect(next.topics[TID].status).toBe("done");
  });

  it("does not touch any topic status for a general (topic-less) task", () => {
    const state = buildInitialState();
    const next = setTaskDoneIn(state, DATE, generalTask(), () => "log1");
    expect(next.topics[TID].status).toBe("not-started");
  });
});

describe("resetTaskIn", () => {
  it("undoes a done task: clears status, removes the log, reverses hours", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    const reset = resetTaskIn(done, topicTask());
    expect(reset.taskStatus[topicTask().id]).toBeUndefined();
    expect(reset.studyLog.find((e) => e.taskId === topicTask().id)).toBeUndefined();
    expect(reset.topics[TID].completedHours).toBeCloseTo(0, 5);
  });

  it("reopens the topic on undo so the Topics table no longer shows it done", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    expect(done.topics[TID].status).toBe("done");
    const reset = resetTaskIn(done, topicTask());
    expect(reset.topics[TID].status).not.toBe("done");
    // No remaining hours -> back to not-started (closest planned state).
    expect(reset.topics[TID].status).toBe("not-started");
  });

  it("undoing twice is safe and never makes hours negative", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    const once = resetTaskIn(done, topicTask());
    const twice = resetTaskIn(once, topicTask());
    expect(twice.taskStatus[topicTask().id]).toBeUndefined();
    expect(twice.topics[TID].completedHours).toBeGreaterThanOrEqual(0);
    expect(twice.topics[TID].status).not.toBe("done");
  });

  it("is a no-op for an untouched task", () => {
    const state = buildInitialState();
    expect(resetTaskIn(state, topicTask())).toBe(state);
  });
});

describe("skipTaskIn", () => {
  it("skips a planned task without logging hours", () => {
    const state = buildInitialState();
    const next = skipTaskIn(state, topicTask());
    expect(next.taskStatus[topicTask().id]).toBe("skipped");
    expect(next.studyLog).toHaveLength(0);
    expect(next.topics[TID].completedHours).toBe(0);
  });

  it("reverses the hours when skipping a previously done task", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    const skipped = skipTaskIn(done, topicTask());
    expect(skipped.taskStatus[topicTask().id]).toBe("skipped");
    expect(skipped.studyLog).toHaveLength(0);
    expect(skipped.topics[TID].completedHours).toBeCloseTo(0, 5);
  });

  it("keeps a skipped task's topic eligible to be rescheduled (not done)", () => {
    const state = buildInitialState();
    const next = skipTaskIn(state, topicTask());
    expect(next.topics[TID].status).not.toBe("done");
    expect(next.topics[TID].status).not.toBe("skipped");
  });

  it("reopens a previously done topic when its block is skipped", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    expect(done.topics[TID].status).toBe("done");
    const skipped = skipTaskIn(done, topicTask());
    expect(skipped.topics[TID].status).not.toBe("done");
  });
});

describe("Done stays consistent across blocks of the same topic", () => {
  const learn = topicTask();
  const review = topicTask({ id: `${DATE}|review|${TID}`, type: "review" });

  it("keeps the topic done while another block is still done, then reopens on the last undo", () => {
    let s = buildInitialState();
    s = setTaskDoneIn(s, DATE, learn, () => "l1");
    s = setTaskDoneIn(s, DATE, review, () => "r1");
    expect(s.topics[TID].status).toBe("done");

    // Undo only the learn block: the review block keeps the topic done.
    s = resetTaskIn(s, learn);
    expect(s.taskStatus[review.id]).toBe("done");
    expect(s.topics[TID].status).toBe("done");

    // Undo the last done block: the topic finally reopens.
    s = resetTaskIn(s, review);
    expect(s.topics[TID].status).not.toBe("done");
  });
});

describe("reopenTopicIn (Topics table Done toggle off)", () => {
  it("reopens the topic and clears weekly done blocks, keeping study log + hours", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    expect(done.topics[TID].status).toBe("done");

    const reopened = reopenTopicIn(done, TID);
    // No weekly block stays "done" for this topic (no contradiction with table).
    expect(reopened.taskStatus[topicTask().id]).toBeUndefined();
    // Status derives from remaining hours; the work itself is preserved.
    expect(reopened.topics[TID].status).toBe("reviewing");
    expect(reopened.studyLog.find((e) => e.taskId === topicTask().id)).toBeTruthy();
    expect(reopened.topics[TID].completedHours).toBeCloseTo(0.5, 5);
  });

  it("is a no-op for an unknown topic id", () => {
    const state = buildInitialState();
    expect(reopenTopicIn(state, "no-such-topic")).toBe(state);
  });
});

describe("clearTopicDoneTasksIn", () => {
  it("drops the topic's weekly done flags but keeps skipped flags + study log", () => {
    let state = buildInitialState();
    state = setTaskDoneIn(state, DATE, topicTask(), () => "log1");
    state = skipTaskIn(state, topicTask({ id: `${DATE}|review|${TID}`, type: "review" }));
    const cleared = clearTopicDoneTasksIn(state, TID);
    expect(cleared.taskStatus[topicTask().id]).toBeUndefined();
    expect(cleared.taskStatus[`${DATE}|review|${TID}`]).toBe("skipped");
    // Study log + hours are preserved (clearing is not undoing the work).
    expect(cleared.studyLog.find((e) => e.taskId === topicTask().id)).toBeTruthy();
  });

  it("is a no-op when the topic has no done flags", () => {
    const state = buildInitialState();
    expect(clearTopicDoneTasksIn(state, TID)).toBe(state);
  });
});

describe("weekly Done <-> Topics table (single source of truth via buildModel)", () => {
  it("a weekly block marked done shows the topic done in the table, and Undo reverses it", () => {
    const today = DATE;
    let state = buildInitialState();
    const model = buildModel(state, today);

    // First topic-bound block anywhere in the visible plan.
    let found: { date: string; task: DailyStudyTask } | undefined;
    for (const day of model.studyPlan) {
      const t = day.tasks.find((x) => x.topicId);
      if (t) {
        found = { date: day.date, task: t };
        break;
      }
    }
    expect(found).toBeTruthy();
    const { date, task } = found!;
    const topicId = task.topicId!;

    // Mark the weekly block done.
    state = setTaskDoneIn(state, date, task, () => "log1");
    const after = buildModel(state, today);
    // Topics table reads ComputedTopic.state.status -> must be "done".
    expect(after.byId.get(topicId)?.state.status).toBe("done");
    // The block stays visible and shows done in the (pinned) plan.
    const sameTask = after.studyPlan
      .find((d) => d.date === date)
      ?.tasks.find((x) => x.id === task.id);
    expect(sameTask?.status).toBe("done");

    // Undo via the weekly action: the table no longer shows it done.
    state = resetTaskIn(state, task);
    const reopened = buildModel(state, today);
    expect(reopened.byId.get(topicId)?.state.status).not.toBe("done");
  });
});

describe("whole-day Done / Undo (Today card primary action)", () => {
  it("marks every block in the day done in one call", () => {
    const state = buildInitialState();
    const tasks = [topicTask(), generalTask()];
    const next = setDayDoneIn(state, DATE, tasks, () => "log1");
    expect(next.taskStatus[topicTask().id]).toBe("done");
    expect(next.taskStatus[generalTask().id]).toBe("done");
    // The topic block logged its session + hours; the general block did not log.
    expect(next.studyLog.filter((e) => e.taskId === topicTask().id)).toHaveLength(1);
    expect(next.topics[TID].completedHours).toBeCloseTo(0.5, 5);
  });

  it("resetDayDoneIn reverses a whole-day Done (status, log and hours)", () => {
    const state = buildInitialState();
    const tasks = [topicTask(), generalTask()];
    const done = setDayDoneIn(state, DATE, tasks, () => "log1");
    const undone = resetDayDoneIn(done, tasks);
    expect(undone.taskStatus[topicTask().id]).toBeUndefined();
    expect(undone.taskStatus[generalTask().id]).toBeUndefined();
    expect(undone.studyLog).toHaveLength(0);
    expect(undone.topics[TID].completedHours).toBeCloseTo(0, 5);
  });

  it("is a no-op when the day has no blocks", () => {
    const state = buildInitialState();
    expect(setDayDoneIn(state, DATE, [], () => "x")).toBe(state);
    expect(resetDayDoneIn(state, [])).toBe(state);
  });
});

describe("plan tuning", () => {
  it("patches a nudge and is a no-op when unchanged", () => {
    const state = buildInitialState();
    const on = setPlanTuningIn(state, { focusWeak: true });
    expect(on.planTuning.focusWeak).toBe(true);
    expect(setPlanTuningIn(on, { focusWeak: true })).toBe(on);
  });

  it("resets every nudge", () => {
    const state = setPlanTuningIn(buildInitialState(), { lightDay: true, morePractice: true });
    const cleared = resetPlanTuningIn(state);
    expect(Object.values(cleared.planTuning).some(Boolean)).toBe(false);
  });
});

describe("regeneratePlanIn (canonical Regenerate)", () => {
  it("bumps planSeed and is ALWAYS a new state (never a silent no-op)", () => {
    const state = buildInitialState();
    expect(state.planSeed).toBe(0);
    const a = regeneratePlanIn(state);
    expect(a).not.toBe(state);
    expect(a.planSeed).toBe(1);
    // Repeatable: each click advances the seed, so the cloud always sees a change.
    expect(regeneratePlanIn(a).planSeed).toBe(2);
  });

  it("normalizes a missing / invalid / negative seed back to a clean bump", () => {
    expect(regeneratePlanIn({ ...buildInitialState(), planSeed: NaN as unknown as number }).planSeed).toBe(1);
    expect(regeneratePlanIn({ ...buildInitialState(), planSeed: -5 }).planSeed).toBe(1);
    expect(regeneratePlanIn({ ...buildInitialState(), planSeed: 3.9 }).planSeed).toBe(4);
  });

  it("preserves done items, day modes, locked days and every manual override", () => {
    let state = buildInitialState();
    state = setTaskDoneIn(state, DATE, topicTask(), () => "log1"); // a done topic block
    state = setDayModeIn(state, "2026-06-25", "family", "t"); // a day mode
    state = lockDayIn(state, "2026-06-26", TOPICS[1].id); // a locked + pinned day
    const snapshot = JSON.stringify({
      topics: state.topics,
      studyLog: state.studyLog,
      taskStatus: state.taskStatus,
      dayOverrides: state.dayOverrides,
      planTuning: state.planTuning,
    });

    const regen = regeneratePlanIn(state);

    // Only the seed moved; every manual decision is byte-for-byte intact.
    expect(regen.planSeed).toBe(1);
    expect(
      JSON.stringify({
        topics: regen.topics,
        studyLog: regen.studyLog,
        taskStatus: regen.taskStatus,
        dayOverrides: regen.dayOverrides,
        planTuning: regen.planTuning,
      }),
    ).toBe(snapshot);
    expect(regen.topics[TID].status).toBe("done");
    expect(regen.dayOverrides["2026-06-25"].mode).toBe("family");
    expect(regen.dayOverrides["2026-06-26"].locked).toBe(true);
  });

  it("round-trips planSeed through hydrate/export and the sync envelope", () => {
    const state = regeneratePlanIn(regeneratePlanIn(buildInitialState())); // seed = 2
    const restored = hydrate(JSON.parse(exportJson(state)));
    expect(restored.planSeed).toBe(2);
    expect(serializeEnvelope(state, "device-1")).toContain("planSeed");
  });
});

describe("persistence & sync of plan state", () => {
  it("round-trips taskStatus, planTuning and log taskId through hydrate/export", () => {
    const state = buildInitialState();
    const done = setTaskDoneIn(
      setPlanTuningIn(state, { moreReview: true }),
      DATE,
      topicTask(),
      () => "log1",
    );
    const restored = hydrate(JSON.parse(exportJson(done)));
    expect(restored.taskStatus[topicTask().id]).toBe("done");
    // The canonical topic status persists too, so Done stays consistent on reload.
    expect(restored.topics[TID].status).toBe("done");
    expect(restored.planTuning.moreReview).toBe(true);
    expect(restored.studyLog.find((e) => e.taskId === topicTask().id)?.taskId).toBe(topicTask().id);
  });

  it("includes the daily-plan state in the GitHub sync envelope", () => {
    const state = setTaskDoneIn(buildInitialState(), DATE, topicTask(), () => "log1");
    const json = serializeEnvelope(state, "device-1");
    expect(json).toContain("taskStatus");
    expect(json).toContain(topicTask().id);
    expect(json).toContain("planTuning");
  });
});
