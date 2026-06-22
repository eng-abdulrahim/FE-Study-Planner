import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncer, isDirty } from "./autoPush";

afterEach(() => {
  vi.useRealTimers();
});

describe("isDirty", () => {
  it("is true when local data changed since the last sync", () => {
    expect(isDirty("2026-06-22T10:00:00.000Z", "2026-06-22T09:00:00.000Z")).toBe(true);
  });

  it("is false right after a successful sync (loop guard)", () => {
    // After push/pull we set lastSyncedLocalUpdatedAt to the synced value, so
    // the auto-push effect must NOT see the state as dirty again.
    const synced = "2026-06-22T10:00:00.000Z";
    expect(isDirty(synced, synced)).toBe(false);
  });

  it("is false for a fresh, never-edited state", () => {
    expect(isDirty(null, null)).toBe(false);
  });
});

describe("createDebouncer", () => {
  it("runs only once for several rapid schedules", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createDebouncer(4000);

    d.schedule(fn);
    d.schedule(fn);
    d.schedule(fn);

    vi.advanceTimersByTime(3999);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("waits for the full quiet period after the last change", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createDebouncer(4000);

    d.schedule(fn);
    vi.advanceTimersByTime(3000);
    d.schedule(fn); // new change resets the timer
    vi.advanceTimersByTime(3999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel() prevents a pending call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = createDebouncer(4000);

    d.schedule(fn);
    d.cancel();
    vi.advanceTimersByTime(10000);
    expect(fn).not.toHaveBeenCalled();
  });
});
