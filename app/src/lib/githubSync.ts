// Thin GitHub Contents API client for plain-JSON cloud sync.
//
// Design rules (security):
// - The token is ALWAYS passed in as an argument. This module never reads,
//   writes, stores, or logs the token.
// - The token is sent only in the `Authorization: Bearer <token>` header,
//   never in a URL, query string, commit message, or file body.
// - No console logging anywhere in this file.
//
// API: https://docs.github.com/rest/repos/contents

export interface RepoTarget {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

export interface RemoteFile {
  contentJson: string;
  sha: string;
}

export type SyncErrorKind = "auth" | "not-found" | "conflict" | "retryable" | "unknown";

/** Typed error so the UI can show a friendly, kind-specific message. */
export class GitHubSyncError extends Error {
  readonly kind: SyncErrorKind;
  readonly status?: number;
  constructor(kind: SyncErrorKind, message: string, status?: number) {
    super(message);
    this.name = "GitHubSyncError";
    this.kind = kind;
    this.status = status;
  }
}

const API_ROOT = "https://api.github.com";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Encode each path segment but keep the slashes. */
function encodePath(path: string): string {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map(encodeURIComponent)
    .join("/");
}

function contentsUrl(target: RepoTarget): string {
  return `${API_ROOT}/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(
    target.repo,
  )}/contents/${encodePath(target.path)}`;
}

/** Map an HTTP status to a typed sync error. */
function errorForStatus(status: number): GitHubSyncError {
  if (status === 401 || status === 403) {
    return new GitHubSyncError("auth", "Authentication failed or insufficient permissions.", status);
  }
  if (status === 404) {
    return new GitHubSyncError("not-found", "Repository, branch, or file was not found.", status);
  }
  if (status === 409 || status === 422) {
    return new GitHubSyncError("conflict", "The file changed on GitHub since it was last read.", status);
  }
  if (status >= 500) {
    return new GitHubSyncError("retryable", "GitHub is unavailable right now. Try again.", status);
  }
  return new GitHubSyncError("unknown", `Unexpected response from GitHub (status ${status}).`, status);
}

// ---- UTF-8 safe base64 helpers --------------------------------------------

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function decodeBase64(b64: string): string {
  const clean = b64.replace(/\s/g, ""); // GitHub wraps base64 with newlines
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    // Network failure / offline / DNS - retryable, and we never surface details
    // that could leak the request (which carries the token header).
    throw new GitHubSyncError("retryable", "Could not reach GitHub. Check your connection.");
  }
}

/**
 * Read the JSON file. Returns its decoded contents and current `sha`, or
 * `null` when the file does not exist yet (HTTP 404).
 */
export async function getFile(target: RepoTarget, token: string): Promise<RemoteFile | null> {
  const ref = target.branch ? `?ref=${encodeURIComponent(target.branch)}` : "";
  // `cache: "no-store"` is REQUIRED for correctness: the Contents API sends
  // cacheable responses, and a stale cached `sha` would make the next PUT fail
  // with HTTP 409 ("does not match <sha>"). We must always read the live sha.
  const res = await safeFetch(`${contentsUrl(target)}${ref}`, {
    method: "GET",
    headers: authHeaders(token),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) throw errorForStatus(res.status);

  const data = (await res.json()) as { content?: string; sha?: string };
  if (typeof data.content !== "string" || typeof data.sha !== "string") {
    throw new GitHubSyncError("unknown", "GitHub returned an unexpected file payload.");
  }
  return { contentJson: decodeBase64(data.content), sha: data.sha };
}

/**
 * Create or update the JSON file.
 * - Pass `sha` when updating an existing file (required by GitHub).
 * - Omit `sha` when creating a new file.
 * Returns the new file `sha`.
 */
export async function putFile(
  target: RepoTarget,
  token: string,
  contentJson: string,
  sha?: string,
  message?: string,
): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message: message ?? "Update planner data",
    content: encodeBase64(contentJson),
  };
  if (target.branch) body.branch = target.branch;
  if (sha) body.sha = sha;

  const res = await safeFetch(contentsUrl(target), {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) throw errorForStatus(res.status);

  const data = (await res.json()) as { content?: { sha?: string } };
  const newSha = data.content?.sha;
  if (typeof newSha !== "string") {
    throw new GitHubSyncError("unknown", "GitHub did not return a file id after saving.");
  }
  return { sha: newSha };
}
