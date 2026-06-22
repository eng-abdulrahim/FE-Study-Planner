import { describe, expect, it } from "vitest";

// Vite raw-imports every source module at build time so we can assert no real
// access-key pattern is embedded anywhere in the source tree (which would also
// end up in the bundle). Using import.meta.glob keeps this dependency-free (no
// node types needed) and works under vitest.
const sources = import.meta.glob("../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Built from fragments so this test file itself never contains the literals it
// is searching for (which would be a false positive).
const NEEDLES = [
  ["github", "pat", ""].join("_"), // github_pat_
  ["ghp", ""].join("_"), // ghp_
  ["VITE", "GITHUB", "SYNC", "TOKEN"].join("_"), // VITE_GITHUB_SYNC_TOKEN
];

describe("build safety: no embedded access key in source", () => {
  // Exclude test files: they legitimately reference the patterns as assertions.
  const entries = Object.entries(sources).filter(
    ([path]) => !/\.test\.(ts|tsx)$/.test(path),
  );

  it("scans a non-trivial number of source files", () => {
    expect(entries.length).toBeGreaterThan(5);
  });

  it("contains no access-key patterns or build-time key env usage", () => {
    for (const [path, text] of entries) {
      for (const needle of NEEDLES) {
        expect(text.includes(needle), `${path} must not contain "${needle}"`).toBe(false);
      }
    }
  });
});
