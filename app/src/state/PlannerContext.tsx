import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  DailyStudyTask,
  DayMode,
  DayPlan,
  IncludeValue,
  PlannerState,
  PlanTuning,
  StudyLogEntry,
  StudyMode,
  TopicState,
  TopicStatus,
} from "../types/planner";
import { buildModel } from "../lib/plannerLogic";
import type { PlannerModel } from "../lib/plannerLogic";
import { loadState, resetState, saveState } from "../lib/storage";
import {
  changeDayTopicIn,
  clearDayIn,
  clearWeekIn,
  lockDayIn,
  moveTopicToTodayIn,
  setDayModeIn,
  skipDayIn,
  unlockDayIn,
  unskipDayIn,
} from "../lib/dayOverrides";
import { adjustTopicHoursIn, markDayDoneIn, undoDayDoneIn } from "../lib/studyActions";
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
} from "../lib/planActions";
import { clampNumber } from "../lib/validation";
import { todayISO, uid } from "../lib/util";

export interface PlannerActions {
  setExamName(name: string): void;
  setExamDate(date: string): void;
  setWeekStartDay(day: number): void;
  setReviewWindow(days: number): void;
  updateDay(weekdayIndex: number, patch: Partial<{ minutes: number; energy: number; mode: StudyMode }>): void;
  updateTopic(id: string, patch: Partial<TopicState>): void;
  setInclude(id: string, value: IncludeValue): void;
  setStatus(id: string, status: TopicStatus): void;
  setNoteUrl(id: string, url: string): void;
  clearNote(id: string): void;
  addHours(id: string, hours: number): void;
  markDone(id: string): void;
  /** Reopen a topic (Done -> planning eligible). Clears any weekly "done" blocks
   *  for the topic so completion stays consistent across the whole app. */
  reopenTopic(id: string): void;
  addLogEntry(entry: Omit<StudyLogEntry, "id">): void;
  updateLogEntry(id: string, patch: Partial<StudyLogEntry>): void;
  deleteLogEntry(id: string): void;
  markDayDone(day: DayPlan): void;
  undoDayDone(day: DayPlan): void;
  setDayMode(date: string, mode: DayMode): void;
  skipDay(date: string): void;
  unskipDay(date: string): void;
  clearDay(date: string): void;
  changeDayTopic(date: string, topicId: string): void;
  clearDayTopic(date: string): void;
  lockDay(day: DayPlan): void;
  unlockDay(date: string): void;
  moveTopicToToday(day: DayPlan): void;
  /** Canonical Regenerate: reshuffle the auto-picked plan (review / practice
   *  rotation) while preserving done items, locked days, day modes, skipped days
   *  and every manual override. Always changes state, so it reliably saves +
   *  triggers the cloud auto-push. Every Regenerate control calls this. */
  regeneratePlan(): void;
  /** Clear manual day overrides for the given dates (the destructive reset). */
  clearWeekOverrides(dates: string[]): void;
  // Multi-task daily plan actions.
  setTaskDone(date: string, task: DailyStudyTask): void;
  skipTask(task: DailyStudyTask): void;
  resetTask(task: DailyStudyTask): void;
  // Whole-day Done / Undo (the Today card's single primary action).
  setDayDone(date: string, tasks: DailyStudyTask[]): void;
  resetDayDone(tasks: DailyStudyTask[]): void;
  setPlanTuning(patch: Partial<PlanTuning>): void;
  resetPlanTuning(): void;
  importState(next: PlannerState): void;
  resetData(): void;
}

interface PlannerContextValue {
  state: PlannerState;
  model: PlannerModel;
  today: string;
  actions: PlannerActions;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlannerState>(() => loadState());
  const [today] = useState<string>(() => todayISO());

  // Every USER data mutation runs through here. It auto-saves and stamps
  // `lastUpdatedAt` ONLY when the producer actually changed the state (it
  // returns the same reference for no-ops). Loading a backup/cloud copy and
  // plain re-persistence deliberately do NOT go through here, so they never
  // bump `lastUpdatedAt` and never create false sync conflicts.
  const update = useCallback((producer: (prev: PlannerState) => PlannerState) => {
    setState((prev) => {
      const next = producer(prev);
      if (next === prev) return prev;
      return saveState({ ...next, lastUpdatedAt: new Date().toISOString() });
    });
  }, []);

  const patchTopic = useCallback(
    (id: string, patch: Partial<TopicState>) =>
      update((prev) => {
        const cur = prev.topics[id];
        if (!cur) return prev;
        const next: PlannerState = { ...prev, topics: { ...prev.topics, [id]: { ...cur, ...patch } } };
        // Whenever a topic leaves "done" (table toggle, edit drawer, status
        // dropdown), drop any weekly "done" blocks for it so the weekly plan and
        // the Topics table can never disagree. Study log + hours are kept.
        if (patch.status !== undefined && cur.status === "done" && patch.status !== "done") {
          return clearTopicDoneTasksIn(next, id);
        }
        return next;
      }),
    [update],
  );

  const actions = useMemo<PlannerActions>(() => {
    const adjustTopicHours = adjustTopicHoursIn;

    return {
      setExamName: (name) => update((p) => ({ ...p, examName: name })),
      setExamDate: (date) => update((p) => ({ ...p, examDate: date })),
      setWeekStartDay: (day) =>
        update((p) => ({ ...p, ui: { ...p.ui, weekStartDay: clampNumber(day, 0, 6, 0) } })),
      setReviewWindow: (days) =>
        update((p) => ({ ...p, ui: { ...p.ui, reviewWindowDays: clampNumber(days, 1, 60, 14) } })),
      updateDay: (weekdayIndex, patch) =>
        update((p) => ({
          ...p,
          dailyAvailability: p.dailyAvailability.map((d) =>
            d.weekdayIndex === weekdayIndex
              ? {
                  ...d,
                  minutes: patch.minutes !== undefined ? clampNumber(patch.minutes, 0, 1440, d.minutes) : d.minutes,
                  energy: patch.energy !== undefined ? clampNumber(patch.energy, 1, 5, d.energy) : d.energy,
                  mode: patch.mode ?? d.mode,
                }
              : d,
          ),
        })),
      updateTopic: (id, patch) => patchTopic(id, patch),
      setInclude: (id, value) => patchTopic(id, { include: value }),
      setStatus: (id, status) => patchTopic(id, { status }),
      setNoteUrl: (id, url) => patchTopic(id, { noteUrl: url }),
      clearNote: (id) => patchTopic(id, { noteUrl: "" }),
      addHours: (id, hours) => update((p) => adjustTopicHours(p, id, hours)),
      markDone: (id) => patchTopic(id, { status: "done" }),
      reopenTopic: (id) => update((p) => reopenTopicIn(p, id)),
      addLogEntry: (entry) =>
        update((p) => {
          const withLog: PlannerState = {
            ...p,
            studyLog: [...p.studyLog, { ...entry, id: uid() }],
          };
          return adjustTopicHours(withLog, entry.topicId, entry.minutes / 60);
        }),
      updateLogEntry: (id, patch) =>
        update((p) => {
          const existing = p.studyLog.find((e) => e.id === id);
          if (!existing) return p;
          const next: PlannerState = {
            ...p,
            studyLog: p.studyLog.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          };
          if (patch.minutes !== undefined && patch.minutes !== existing.minutes) {
            return adjustTopicHours(next, existing.topicId, (patch.minutes - existing.minutes) / 60);
          }
          return next;
        }),
      deleteLogEntry: (id) =>
        update((p) => {
          const existing = p.studyLog.find((e) => e.id === id);
          const next: PlannerState = { ...p, studyLog: p.studyLog.filter((e) => e.id !== id) };
          if (existing) return adjustTopicHours(next, existing.topicId, -existing.minutes / 60);
          return next;
        }),
      markDayDone: (day) => update((p) => markDayDoneIn(p, day, uid)),
      // Undo a day's "done": remove the matching log entries and give the hours
      // back, so a mistaken Mark Done is fully reversible.
      undoDayDone: (day) => update((p) => undoDayDoneIn(p, day)),
      // Day modes / constraints (separate from topic status). All go through
      // `update()`, so they auto-save locally and schedule the GitHub auto-push.
      setDayMode: (date, mode) => update((p) => setDayModeIn(p, date, mode)),
      skipDay: (date) => update((p) => skipDayIn(p, date)),
      unskipDay: (date) => update((p) => unskipDayIn(p, date)),
      clearDay: (date) => update((p) => clearDayIn(p, date)),
      changeDayTopic: (date, topicId) => update((p) => changeDayTopicIn(p, date, topicId)),
      clearDayTopic: (date) => update((p) => changeDayTopicIn(p, date, "")),
      lockDay: (day) => update((p) => lockDayIn(p, day.date, day.topicId)),
      unlockDay: (date) => update((p) => unlockDayIn(p, date)),
      moveTopicToToday: (day) =>
        update((p) => (day.topicId ? moveTopicToTodayIn(p, today, day.date, day.topicId) : p)),
      regeneratePlan: () => update((p) => regeneratePlanIn(p)),
      clearWeekOverrides: (dates) => update((p) => clearWeekIn(p, dates)),
      // Multi-task plan: each action auto-saves locally and schedules the cloud
      // push, so no manual Sync is ever required.
      setTaskDone: (date, task) => update((p) => setTaskDoneIn(p, date, task, uid)),
      skipTask: (task) => update((p) => skipTaskIn(p, task)),
      resetTask: (task) => update((p) => resetTaskIn(p, task)),
      setDayDone: (date, tasks) => update((p) => setDayDoneIn(p, date, tasks, uid)),
      resetDayDone: (tasks) => update((p) => resetDayDoneIn(p, tasks)),
      setPlanTuning: (patch) => update((p) => setPlanTuningIn(p, patch)),
      resetPlanTuning: () => update((p) => resetPlanTuningIn(p)),
      // Replacing state from a backup/cloud copy keeps the incoming
      // `lastUpdatedAt` (set by hydrate) so the loaded copy is treated as
      // "in sync", not as a brand-new local change.
      importState: (next) => setState(saveState(next)),
      // A reset is a deliberate user change, so it gets a fresh timestamp.
      resetData: () =>
        setState(saveState({ ...resetState(), lastUpdatedAt: new Date().toISOString() })),
    };
  }, [update, patchTopic, today]);

  const model = useMemo(() => buildModel(state, today), [state, today]);

  const value = useMemo<PlannerContextValue>(
    () => ({ state, model, today, actions }),
    [state, model, today, actions],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within a PlannerProvider");
  return ctx;
}
