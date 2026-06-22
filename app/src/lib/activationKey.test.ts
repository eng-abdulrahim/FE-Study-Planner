import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVATION_KEY_STORAGE_KEY,
  clearStoredActivationKey,
  getStoredActivationKey,
  hasStoredActivationKey,
  setStoredActivationKey,
} from "./activationKey";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("activation key store", () => {
  it("uses the documented generic storage key", () => {
    expect(ACTIVATION_KEY_STORAGE_KEY).toBe("fe-study-planner.activationKey.v1");
  });

  it("returns null when nothing is stored", () => {
    expect(getStoredActivationKey()).toBeNull();
    expect(hasStoredActivationKey()).toBe(false);
  });

  it("saves and reads a key", () => {
    setStoredActivationKey("abc123");
    expect(getStoredActivationKey()).toBe("abc123");
    expect(hasStoredActivationKey()).toBe(true);
    expect(localStorage.getItem(ACTIVATION_KEY_STORAGE_KEY)).toBe("abc123");
  });

  it("trims whitespace before saving", () => {
    setStoredActivationKey("   spaced-key   ");
    expect(getStoredActivationKey()).toBe("spaced-key");
  });

  it("treats a blank value as a clear", () => {
    setStoredActivationKey("abc123");
    setStoredActivationKey("    ");
    expect(getStoredActivationKey()).toBeNull();
  });

  it("clears the stored key", () => {
    setStoredActivationKey("abc123");
    clearStoredActivationKey();
    expect(getStoredActivationKey()).toBeNull();
    expect(hasStoredActivationKey()).toBe(false);
  });

  it("never throws when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => setStoredActivationKey("x")).not.toThrow();
    expect(getStoredActivationKey()).toBeNull();
    expect(() => clearStoredActivationKey()).not.toThrow();
  });
});
