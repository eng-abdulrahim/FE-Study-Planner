import { describe, expect, it } from "vitest";
import { ACTIVATION_COPY } from "./activationCopy";

// Every user-facing cloud-sync string flows through ACTIVATION_COPY, so this
// guards the whole UI against leaking provider-specific wording.
const FORBIDDEN = [
  "github",
  "repository",
  "repo",
  "personal access token",
  "pat",
  "token",
  "private data repo",
  "private-data-store",
  "planner-state.json",
  "contents permission",
  "read/write permission",
  "branch",
  "file path",
  "api",
];

describe("ACTIVATION_COPY wording", () => {
  const values = Object.entries(ACTIVATION_COPY);

  it("has no empty strings", () => {
    for (const [k, v] of values) {
      expect(v.length, k).toBeGreaterThan(0);
    }
  });

  it("never exposes provider-specific wording", () => {
    for (const [key, value] of values) {
      const lower = value.toLowerCase();
      for (const word of FORBIDDEN) {
        expect(lower.includes(word), `${key} = "${value}" must not contain "${word}"`).toBe(
          false,
        );
      }
    }
  });

  it("uses the activation-key concept for the modal", () => {
    expect(ACTIVATION_COPY.modalTitle).toBe("Activate Cloud Sync");
    expect(ACTIVATION_COPY.inputLabel).toBe("Activation key");
    expect(ACTIVATION_COPY.modalDescription).toContain("activation key");
  });
});
