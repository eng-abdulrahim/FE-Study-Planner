import { describe, expect, it, vi } from "vitest";
import { activationErrorMessage, validateActivationKey } from "./activation";
import type { ActivationDeps, ActivationFailureReason } from "./activation";
import { GitHubSyncError } from "./githubSync";
import type { RemoteFile, RepoTarget } from "./githubSync";

const target: RepoTarget = { owner: "o", repo: "r", path: "p", branch: "main" };

function deps(getFile: ActivationDeps["getFile"]): ActivationDeps {
  return { target, getFile };
}

describe("validateActivationKey", () => {
  it("rejects an empty key without any network call", async () => {
    const getFile = vi.fn(async () => null as RemoteFile | null);
    const res = await validateActivationKey("   ", deps(getFile));
    expect(res).toEqual({ ok: false, reason: "empty" });
    expect(getFile).not.toHaveBeenCalled();
  });

  it("accepts a key that can read an existing cloud file", async () => {
    const getFile = vi.fn(async () => ({ sha: "S", contentJson: "{}" }));
    const res = await validateActivationKey("good-key", deps(getFile));
    expect(res).toEqual({ ok: true });
    expect(getFile).toHaveBeenCalledTimes(1);
  });

  it("accepts a key when the cloud file does not exist yet (null)", async () => {
    const getFile = vi.fn(async () => null);
    const res = await validateActivationKey("good-key", deps(getFile));
    expect(res).toEqual({ ok: true });
  });

  it("maps 401 to an 'invalid' key", async () => {
    const getFile = vi.fn(async () => {
      throw new GitHubSyncError("auth", "unauthorized", 401);
    });
    const res = await validateActivationKey("bad-key", deps(getFile));
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  it("maps 403 to 'no-access'", async () => {
    const getFile = vi.fn(async () => {
      throw new GitHubSyncError("auth", "forbidden", 403);
    });
    const res = await validateActivationKey("scoped-wrong", deps(getFile));
    expect(res).toEqual({ ok: false, reason: "no-access" });
  });

  it("maps a retryable/transport failure to 'network'", async () => {
    const getFile = vi.fn(async () => {
      throw new GitHubSyncError("retryable", "offline");
    });
    const res = await validateActivationKey("any-key", deps(getFile));
    expect(res).toEqual({ ok: false, reason: "network" });
  });

  it("treats an unknown thrown value as 'network' (never destructive)", async () => {
    const getFile = vi.fn(async () => {
      throw new Error("weird");
    });
    const res = await validateActivationKey("any-key", deps(getFile));
    expect(res).toEqual({ ok: false, reason: "network" });
  });
});

describe("activationErrorMessage", () => {
  const reasons: ActivationFailureReason[] = [
    "empty",
    "invalid",
    "no-access",
    "network",
    "unknown",
  ];

  it("returns a non-empty, provider-free message for every reason", () => {
    for (const reason of reasons) {
      const msg = activationErrorMessage(reason).toLowerCase();
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toContain("github");
      expect(msg).not.toContain("token");
      expect(msg).not.toContain("repository");
      expect(msg).not.toContain("repo");
      expect(msg).not.toContain("pat");
    }
  });
});
