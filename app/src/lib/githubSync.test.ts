import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubSyncError, getFile, putFile } from "./githubSync";
import type { RepoTarget } from "./githubSync";

const target: RepoTarget = { owner: "o", repo: "r", path: "data/planner-state.json", branch: "main" };
const TOKEN = "test-token-123";

function jsonResponse(status: number, body: unknown, ok = status < 400) {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** Run a promise we expect to reject and return the GitHubSyncError kind. */
async function rejectedKind(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return e instanceof GitHubSyncError ? e.kind : "not-a-sync-error";
  }
  return "did-not-throw";
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("githubSync.getFile", () => {
  it("decodes base64 content (with newlines) and returns the sha", async () => {
    const payload = JSON.stringify({ hello: "world", n: 42 });
    const b64 = btoa(payload).replace(/(.{6})/g, "$1\n"); // newlines mimic GitHub's wrapping
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: b64, sha: "abc123" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getFile(target, TOKEN);
    expect(result).toEqual({ contentJson: payload, sha: "abc123" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/repos/o/r/contents/data/planner-state.json");
    expect(url).toContain("ref=main");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    // Must bypass the HTTP cache so we never read a stale sha (would cause 409 on PUT).
    expect(init.cache).toBe("no-store");
  });

  it("returns null when the file does not exist (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));
    expect(await getFile(target, TOKEN)).toBeNull();
  });

  it("maps 401 to an auth error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, {})));
    expect(await rejectedKind(getFile(target, TOKEN))).toBe("auth");
  });

  it("maps a network failure to a retryable error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await rejectedKind(getFile(target, TOKEN))).toBe("retryable");
  });
});

describe("githubSync.putFile", () => {
  it("creates a new file WITHOUT a sha and base64-encodes the content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { content: { sha: "newsha" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await putFile(target, TOKEN, '{"x":1}');
    expect(result).toEqual({ sha: "newsha" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/repos/o/r/contents/data/planner-state.json");
    expect(init.method).toBe("PUT");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);

    const body = JSON.parse(init.body as string);
    expect(body.sha).toBeUndefined();
    expect(atob(body.content)).toBe('{"x":1}');
  });

  it("includes the sha and message when updating an existing file", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: { sha: "sha2" } }));
    vi.stubGlobal("fetch", fetchMock);

    await putFile(target, TOKEN, "{}", "oldsha", "my message");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.sha).toBe("oldsha");
    expect(body.message).toBe("my message");
  });

  it("never puts the token in the URL or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { content: { sha: "s" } }));
    vi.stubGlobal("fetch", fetchMock);
    await putFile(target, TOKEN, "{}", "oldsha");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(TOKEN);
    expect(init.body as string).not.toContain(TOKEN);
  });

  it("maps status codes to typed errors", async () => {
    const cases: Array<[number, string]> = [
      [401, "auth"],
      [403, "auth"],
      [404, "not-found"],
      [409, "conflict"],
      [422, "conflict"],
      [500, "retryable"],
      [503, "retryable"],
    ];
    for (const [status, kind] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(status, {})));
      expect(await rejectedKind(putFile(target, TOKEN, "{}", "sha"))).toBe(kind);
    }
  });
});
