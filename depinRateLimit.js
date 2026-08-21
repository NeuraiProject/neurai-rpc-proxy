/*
Per-IP rate limiting and temporary bans for the depin* methods.

The node cannot do this itself: behind the proxy every caller shares the
proxy's IP, so the node only limits per authenticated address. The proxy is
the one place where the real origin exists, so this is where a flood of
depinchallenge / depinreceivemsg / depinsubmitmsg from one source is cut off.

Semantics (sliding window):
  - at most `perMinute` depin* requests per IP in any 60 s window;
  - exceeding it bans the IP for `banMinutes` (every depin* request answers
    429 with Retry-After until the ban lapses);
  - perMinute <= 0 disables the limiter entirely.

State is in memory and bounded: `maxKeys` tracked IPs, pruned when exceeded.
*/
function createDepinLimiter({ perMinute = 60, banMinutes = 60, windowMs = 60 * 1000, maxKeys = 10000 } = {}) {
  const hits = new Map(); // ip -> ascending timestamps (ms) inside the window
  const bans = new Map(); // ip -> ban end (ms)

  function prune(now) {
    for (const [ip, until] of bans) {
      if (now >= until) bans.delete(ip);
    }
    for (const [ip, arr] of hits) {
      while (arr.length && arr[0] <= now - windowMs) arr.shift();
      if (arr.length === 0) hits.delete(ip);
    }
  }

  function check(ip, now = Date.now()) {
    if (!(perMinute > 0)) return { allowed: true };
    const key = ip || "unknown";

    const until = bans.get(key);
    if (until !== undefined) {
      if (now < until) {
        return { allowed: false, banned: true, retryAfterSeconds: Math.ceil((until - now) / 1000) };
      }
      bans.delete(key);
    }

    let arr = hits.get(key);
    if (!arr) {
      if (hits.size >= maxKeys) prune(now);
      arr = [];
      hits.set(key, arr);
    }
    while (arr.length && arr[0] <= now - windowMs) arr.shift();

    if (arr.length >= perMinute) {
      const banUntil = now + banMinutes * 60 * 1000;
      bans.set(key, banUntil);
      hits.delete(key);
      return { allowed: false, banned: true, retryAfterSeconds: banMinutes * 60, justBanned: true };
    }
    arr.push(now);
    return { allowed: true };
  }

  function stats() {
    return { perMinute, banMinutes, tracked: hits.size, banned: bans.size };
  }

  return { check, prune, stats };
}

module.exports = { createDepinLimiter };
