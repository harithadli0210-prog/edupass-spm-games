/**
 * In-process fixed-window rate limiter.
 *
 * Honest about what it is: this holds counters in the Node process, so it does
 * not coordinate across serverless instances or a multi-region deployment. It
 * stops a script hammering one endpoint from one client, which is the abuse
 * shape that actually shows up in a student competition.
 *
 * Before campaign traffic arrives this should move to Postgres or Upstash so
 * the window is shared. The call signature is designed not to change when it
 * does.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Returns true when the caller is over the limit and should be refused. */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    sweep(now);
    return false;
  }

  existing.count += 1;
  return existing.count > limit;
}

/** Drop expired windows so the map cannot grow without bound. */
function sweep(now: number) {
  if (windows.size < 5000) return;
  for (const [key, window] of windows) {
    if (window.resetAt < now) windows.delete(key);
  }
}
