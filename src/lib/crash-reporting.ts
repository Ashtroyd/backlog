/** Deliberately exclude error messages, account IDs, URLs and form contents. */
export function crashDetails(error: unknown) {
  const value = error instanceof Error ? error : new Error("UnknownError");
  return {
    name: /^[\w ]{1,60}$/.test(value.name) ? value.name : "Error",
    digest: "digest" in value && typeof value.digest === "string" && /^\w{1,80}$/.test(value.digest) ? value.digest : undefined,
    frames: (value.stack ?? "").split("\n").slice(1, 9)
      .map((line) => line.match(/(?:\/_next\/static\/)[\w/.-]+:\d+:\d+/)?.[0])
      .filter((frame): frame is string => !!frame),
  };
}

const sent = new Set<string>();
export function reportClientCrash(error: unknown) {
  if (typeof window === "undefined" || !navigator.onLine || sent.size >= 5) return;
  const details = crashDetails(error);
  const key = JSON.stringify(details);
  if (sent.has(key)) return;
  sent.add(key);
  // No credentials or user data in the report. A failure must never recurse.
  void fetch("/api/errors", { method: "POST", headers: { "Content-Type": "application/json" },
    body: key, keepalive: true }).catch(() => {});
}
