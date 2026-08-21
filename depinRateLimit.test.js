const { createDepinLimiter } = require("./depinRateLimit");

describe("depin rate limiter: per IP, sliding minute, temporary ban", () => {
  test("allows up to the limit, then bans for banMinutes", () => {
    const limiter = createDepinLimiter({ perMinute: 3, banMinutes: 60 });
    const t0 = 1_700_000_000_000;
    expect(limiter.check("1.2.3.4", t0).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", t0 + 1000).allowed).toBe(true);
    expect(limiter.check("1.2.3.4", t0 + 2000).allowed).toBe(true);

    const fourth = limiter.check("1.2.3.4", t0 + 3000);
    expect(fourth.allowed).toBe(false);
    expect(fourth.banned).toBe(true);
    expect(fourth.justBanned).toBe(true);
    expect(fourth.retryAfterSeconds).toBe(3600);

    // Banned for the whole hour (from the banning request at t0+3s), with a
    // shrinking Retry-After.
    const later = limiter.check("1.2.3.4", t0 + 30 * 60 * 1000);
    expect(later.allowed).toBe(false);
    expect(later.retryAfterSeconds).toBe(1803);
    expect(limiter.stats().banned).toBe(1);

    // After the ban lapses the counter starts from zero.
    expect(limiter.check("1.2.3.4", t0 + 3000 + 60 * 60 * 1000).allowed).toBe(true);
    expect(limiter.stats().banned).toBe(0);
  });

  test("other IPs are independent", () => {
    const limiter = createDepinLimiter({ perMinute: 1, banMinutes: 1 });
    const t0 = 1_700_000_000_000;
    expect(limiter.check("a", t0).allowed).toBe(true);
    expect(limiter.check("a", t0).allowed).toBe(false);
    expect(limiter.check("b", t0).allowed).toBe(true);
  });

  test("the window slides: old hits stop counting after a minute", () => {
    const limiter = createDepinLimiter({ perMinute: 2, banMinutes: 1 });
    const t0 = 1_700_000_000_000;
    expect(limiter.check("a", t0).allowed).toBe(true);
    expect(limiter.check("a", t0 + 30_000).allowed).toBe(true);
    // The first hit left the window: still within the limit.
    expect(limiter.check("a", t0 + 60_000).allowed).toBe(true);
    expect(limiter.stats().banned).toBe(0);
  });

  test("perMinute 0 disables the limiter", () => {
    const limiter = createDepinLimiter({ perMinute: 0, banMinutes: 60 });
    for (let i = 0; i < 1000; i++) expect(limiter.check("a", i).allowed).toBe(true);
    expect(limiter.stats().tracked).toBe(0);
  });

  test("prune drops stale hits and expired bans, and the map stays bounded", () => {
    const limiter = createDepinLimiter({ perMinute: 5, banMinutes: 1, maxKeys: 10 });
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < 10; i++) limiter.check("ip" + i, t0);
    expect(limiter.stats().tracked).toBe(10);
    // An 11th key forces a prune; nothing is stale yet, so it is added anyway.
    limiter.check("ip10", t0 + 1);
    expect(limiter.stats().tracked).toBe(11);
    // A minute later everything is stale and the next check prunes it all.
    limiter.check("ip11", t0 + 61_000);
    expect(limiter.stats().tracked).toBe(1);

    limiter.prune(t0 + 5 * 60_000);
    expect(limiter.stats().tracked).toBe(0);
  });
});
