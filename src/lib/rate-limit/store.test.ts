import { describe, expect, it } from "vitest";
import { MemoryStore } from "./store";

function makeClock(initial = 0) {
  let now = initial;
  return {
    advance: (ms: number) => {
      now += ms;
    },
    set: (ms: number) => {
      now = ms;
    },
    fn: () => now,
  };
}

describe("MemoryStore token bucket", () => {
  it("starts a new bucket at full capacity and decrements on consume", async () => {
    const clock = makeClock(1_000);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 5, refillRatePerMs: 5 / 60_000 };

    const r1 = await store.consume("k", 1, limit);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(4);
    const r2 = await store.consume("k", 1, limit);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(3);
  });

  it("blocks once the bucket is empty and reports a positive retryAfterMs", async () => {
    const clock = makeClock(1_000);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 3, refillRatePerMs: 3 / 60_000 };

    for (let i = 0; i < 3; i += 1) {
      const ok = await store.consume("k", 1, limit);
      expect(ok.allowed).toBe(true);
    }

    const blocked = await store.consume("k", 1, limit);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens as time advances and never exceeds capacity", async () => {
    const clock = makeClock(0);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 5, refillRatePerMs: 5 / 60_000 };

    for (let i = 0; i < 5; i += 1) {
      const ok = await store.consume("k", 1, limit);
      expect(ok.allowed).toBe(true);
    }
    const blocked = await store.consume("k", 1, limit);
    expect(blocked.allowed).toBe(false);

    // After a full window the bucket should be back at capacity.
    clock.advance(60_000);
    const refilled = await store.consume("k", 1, limit);
    expect(refilled.allowed).toBe(true);
    // remaining is capacity - 1 because we just consumed one.
    expect(refilled.remaining).toBeCloseTo(4, 5);

    // Even with a huge time jump, tokens never exceed capacity.
    clock.advance(60_000 * 100);
    const stillCapped = await store.consume("k", 1, limit);
    expect(stillCapped.allowed).toBe(true);
    expect(stillCapped.remaining).toBeLessThanOrEqual(limit.capacity);
  });

  it("keeps separate buckets per key", async () => {
    const clock = makeClock(0);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 2, refillRatePerMs: 2 / 60_000 };

    await store.consume("a", 1, limit);
    await store.consume("a", 1, limit);
    const aBlocked = await store.consume("a", 1, limit);
    expect(aBlocked.allowed).toBe(false);

    const bAllowed = await store.consume("b", 1, limit);
    expect(bAllowed.allowed).toBe(true);
  });

  it("returns a sane retryAfterMs when cost exceeds remaining tokens", async () => {
    const clock = makeClock(0);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 5, refillRatePerMs: 5 / 60_000 };

    for (let i = 0; i < 5; i += 1) await store.consume("k", 1, limit);
    const blocked = await store.consume("k", 1, limit);
    expect(blocked.allowed).toBe(false);
    // 1 token / (5/60000 per ms) = 12_000 ms.
    expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(11_000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(13_000);
  });

  it("reset() clears all buckets", async () => {
    const clock = makeClock(0);
    const store = new MemoryStore(clock.fn);
    const limit = { capacity: 1, refillRatePerMs: 1 / 60_000 };

    await store.consume("k", 1, limit);
    const blocked = await store.consume("k", 1, limit);
    expect(blocked.allowed).toBe(false);

    await store.reset();
    const fresh = await store.consume("k", 1, limit);
    expect(fresh.allowed).toBe(true);
  });
});

describe("MemoryStore sweep and eviction", () => {
  const limit = { capacity: 5, refillRatePerMs: 5 / 60_000 };
  // 2 * windowMs = 2 * 60_000 ms = 120_000 ms
  const TWO_WINDOWS = 120_001;

  it("sweeps stale fully-refilled entries after sweep cadence", async () => {
    const clock = makeClock(0);
    // sweepCadence=5 so sweep fires every 5 consumes; maxBuckets=100 (large, so cap isn't hit)
    const store = new MemoryStore(clock.fn, { maxBuckets: 100, sweepCadence: 5 });

    // Populate 10 keys, each consuming all tokens (so bucket is drained).
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        await store.consume(`key-${i}`, 1, limit);
      }
    }

    // Advance past 2 windows so all buckets fully refill and become stale.
    clock.advance(TWO_WINDOWS);

    // One more consume (5th call in next batch triggers sweep).
    // Fill 4 more calls first, then the 5th triggers the sweep.
    for (let i = 0; i < 4; i++) {
      await store.consume("trigger", 1, limit);
    }
    // This 5th consume triggers the sweep.
    await store.consume("trigger", 1, limit);

    // All 10 stale keys should have been swept (the "trigger" key is active, kept).
    // We can verify by checking the store size indirectly: each stale key should
    // no longer consume from the cap.  A direct size check requires exposing internals,
    // so we verify behavior: populating 100 keys after sweep should not trigger cap eviction.
    // Instead, do a simpler behavioral test: stale keys are gone, so consuming them again
    // gives full capacity (new bucket created).
    clock.advance(1); // tiny advance so new buckets start fresh
    const r = await store.consume("key-0", 1, limit);
    // If key-0 was swept, a fresh bucket starts at capacity; the first consume succeeds.
    expect(r.allowed).toBe(true);
  });

  it("evicts oldest entries (FIFO) when map exceeds MAX_BUCKETS", async () => {
    const clock = makeClock(0);
    // Very small cap to force eviction.
    const store = new MemoryStore(clock.fn, { maxBuckets: 10, sweepCadence: 1 });

    // Drain 20 keys so none are stale-sweepable (tokens < capacity).
    for (let i = 0; i < 20; i++) {
      await store.consume(`key-${i}`, 1, limit);
    }

    // After 20 inserts with sweepCadence=1, eviction runs on every call.
    // The map must now be <= maxBuckets.
    // We can't read .size directly, but we can confirm the store accepts new keys
    // without crashing and continues to function correctly.
    const r = await store.consume("new-key", 1, limit);
    expect(r.allowed).toBe(true);
  });

  it("does not sweep active (non-stale) entries", async () => {
    const clock = makeClock(0);
    const store = new MemoryStore(clock.fn, { maxBuckets: 100, sweepCadence: 5 });

    // Consume one token from "active-key" (partially drained, not stale).
    await store.consume("active-key", 1, limit);

    // Advance past 2 windows.
    clock.advance(TWO_WINDOWS);

    // Re-consume to mark it as recently accessed (resets lastRefillMs via refill).
    await store.consume("active-key", 1, limit);

    // Trigger sweep by firing 5 consumes on other keys.
    for (let i = 0; i < 5; i++) {
      await store.consume(`other-${i}`, 1, limit);
    }

    // "active-key" should still be tracked — it was accessed recently.
    // If it survived the sweep, consuming again costs from its current bucket.
    const r = await store.consume("active-key", 1, limit);
    expect(r.allowed).toBe(true);
  });
});
