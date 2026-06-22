import { afterEach, describe, expect, it, vi } from "vitest";

// The notify module reads its config from import.meta.env at import time, so each
// test stubs env/globals and then dynamically (re)imports a fresh copy.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

function stubBrowser(referrer = "") {
  vi.stubGlobal("window", { location: { href: "https://example.test/app" } });
  vi.stubGlobal("document", { referrer });
  vi.stubGlobal("navigator", { userAgent: "vitest-UA" });
}

describe("notifyVisit (frontend-only, best-effort)", () => {
  it("does nothing and never fetches when no token/chat id is configured", async () => {
    // Explicitly blank the env so this is independent of any ambient .env.local.
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");
    await expect(notifyVisit()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws even when browser globals are missing", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");
    // window/document are undefined in the node test env -> caught internally.
    await expect(notifyVisit()).resolves.toBeUndefined();
  });

  it("still posts to Telegram when ipinfo fails (uses Unknown values)", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    stubBrowser();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false }) // ipinfo request fails
      .mockResolvedValueOnce({ ok: true }); // telegram send
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");

    await notifyVisit();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain("api.telegram.org/botT/sendMessage");
    const text = (fetchSpy.mock.calls[1][1].body as URLSearchParams).get("text") ?? "";
    expect(text).toContain("IP: Unknown");
    expect(text).toContain("Country: Unknown");
  });

  it("builds the exact message title and structure from ipinfo data", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    stubBrowser("https://ref.test");
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ip: "1.2.3.4", city: "Cairo", region: "Cairo", country: "EG", org: "ISP" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");

    await notifyVisit();

    const text = (fetchSpy.mock.calls[1][1].body as URLSearchParams).get("text") ?? "";
    // Title + every field from the required message format.
    expect(text.startsWith("New visitor opened Latifah FE Study Planner")).toBe(true);
    expect(text).toContain("Time: ");
    expect(text).toContain("Page: https://example.test/app");
    expect(text).toContain("Referrer: https://ref.test");
    expect(text).toContain("IP: 1.2.3.4");
    expect(text).toContain("City: Cairo");
    expect(text).toContain("Region: Cairo");
    expect(text).toContain("Country: EG");
    expect(text).toContain("Org: ISP");
    expect(text).toContain("User-Agent:\nvitest-UA");
  });

  it("sends nothing when VITE_ENABLE_VISIT_NOTIFY is false", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    vi.stubEnv("VITE_ENABLE_VISIT_NOTIFY", "false");
    stubBrowser();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");

    await expect(notifyVisit()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never throws if fetch itself rejects", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    stubBrowser();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");
    await expect(notifyVisit()).resolves.toBeUndefined();
  });

  it("sends again on every call - no session/local-storage guard blocks repeats", async () => {
    vi.stubEnv("VITE_TELEGRAM_BOT_TOKEN", "T");
    vi.stubEnv("VITE_TELEGRAM_CHAT_ID", "C");
    stubBrowser();
    // A fully working sessionStorage: if the old once-per-session guard still
    // existed, the second call would be blocked. We assert it is NOT.
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
    const { notifyVisit } = await import("./visitNotify");

    await notifyVisit(); // refresh 1: ipinfo + telegram
    await notifyVisit(); // refresh 2: must fire AGAIN

    // 2 fetches per call (ipinfo + telegram) => 4 total proves both visits sent.
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    // And no "visit-notified" flag was ever persisted to block a repeat.
    expect([...store.keys()].some((k) => k.toLowerCase().includes("visit"))).toBe(false);
  });
});
