/**
 * Rate-limit storage backends.
 *
 * The token-bucket algorithm is implemented in the store so that swapping the
 * backing storage (memory for dev, Redis/KV for prod) does not require
 * re-implementing the math.
 *
 * Bucket math:
 *   state: { tokens: number; lastRefillMs: number }
 *   on consume(key, cost, { capacity, refillRatePerMs }):
 *     now = clock()
 *     if no state for key: state = { tokens: capacity, lastRefillMs: now }
 *     elapsed = now - lastRefillMs
 *     tokens = min(capacity, tokens + elapsed * refillRatePerMs)
 *     if tokens >= cost: tokens -= cost; persist; return { allowed, remaining }
 *     else: retryAfterMs = ceil((cost - tokens) / refillRatePerMs)
 *           return { allowed: false, retryAfterMs }
 */

export type Limit = {
  /** Max tokens in the bucket — also the burst limit. */
  capacity: number;
  /** Refill rate, expressed as tokens per millisecond. */
  refillRatePerMs: number;
};

export type ConsumeResult =
  | { allowed: true; remaining: number; retryAfterMs: 0 }
  | { allowed: false; remaining: number; retryAfterMs: number };

export type Clock = () => number;

export interface RateLimitStore {
  consume(key: string, cost: number, limit: Limit): Promise<ConsumeResult>;
  reset(): Promise<void>;
}

type BucketState = { tokens: number; lastRefillMs: number };

/** Default maximum number of live bucket entries before eviction runs. */
const DEFAULT_MAX_BUCKETS = 100_000;

/** Default number of `consume()` calls between automatic sweep checks. */
const DEFAULT_SWEEP_CADENCE = 1_000;

export class MemoryStore implements RateLimitStore {
  private readonly buckets = new Map<string, BucketState>();
  private readonly clock: Clock;
  private readonly maxBuckets: number;
  private readonly sweepCadence: number;
  private consumeCount = 0;

  constructor(
    clock: Clock = Date.now,
    opts: { maxBuckets?: number; sweepCadence?: number } = {},
  ) {
    this.clock = clock;
    this.maxBuckets = opts.maxBuckets ?? DEFAULT_MAX_BUCKETS;
    this.sweepCadence = opts.sweepCadence ?? DEFAULT_SWEEP_CADENCE;
  }

  async consume(key: string, cost: number, limit: Limit): Promise<ConsumeResult> {
    const now = this.clock();
    const existing = this.buckets.get(key);
    const state: BucketState = existing
      ? refill(existing, now, limit)
      : { tokens: limit.capacity, lastRefillMs: now };

    const allowed = state.tokens >= cost;
    if (allowed) {
      state.tokens -= cost;
    }
    // Always persist so subsequent calls observe the current token level.
    this.buckets.set(key, state);

    this.consumeCount += 1;
    if (
      this.consumeCount % this.sweepCadence === 0 ||
      this.buckets.size > this.maxBuckets
    ) {
      this.sweep(now, limit);
    }

    if (allowed) {
      return { allowed: true, remaining: state.tokens, retryAfterMs: 0 };
    }

    const deficit = cost - state.tokens;
    const retryAfterMs = Math.max(1, Math.ceil(deficit / limit.refillRatePerMs));
    return { allowed: false, remaining: state.tokens, retryAfterMs };
  }

  /**
   * Remove stale fully-refilled entries. If the map is still over `maxBuckets`
   * after the sweep, evict the oldest (insertion-order) entries until we are
   * back under the cap. `Map` preserves insertion order so `map.keys()` iterates
   * oldest-first.
   */
  private sweep(now: number, limit: Limit): void {
    // Stale threshold: fully refilled AND not accessed in the last 2 windows.
    const staleThreshold = now - 2 * (limit.capacity / limit.refillRatePerMs);

    for (const [k, v] of this.buckets) {
      if (v.tokens >= limit.capacity && v.lastRefillMs < staleThreshold) {
        this.buckets.delete(k);
      }
    }

    // FIFO eviction if still over cap after sweep.
    if (this.buckets.size > this.maxBuckets) {
      const excess = this.buckets.size - this.maxBuckets;
      let evicted = 0;
      for (const k of this.buckets.keys()) {
        if (evicted >= excess) break;
        this.buckets.delete(k);
        evicted += 1;
      }
    }
  }

  async reset(): Promise<void> {
    this.buckets.clear();
    this.consumeCount = 0;
  }
}

function refill(state: BucketState, now: number, limit: Limit): BucketState {
  const elapsed = Math.max(0, now - state.lastRefillMs);
  const refilled = Math.min(limit.capacity, state.tokens + elapsed * limit.refillRatePerMs);
  return { tokens: refilled, lastRefillMs: now };
}
