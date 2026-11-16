import type {
  RateLimitDecision,
  RateLimitPolicy,
  RateLimitStore,
} from './rate-limit.store.js';

type Counter = { requests: number; expiresAt: number };
type Bucket = { clients: Map<string, Counter>; sweepAt: number };

class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new WeakMap<RateLimitPolicy, Bucket>();

  constructor(
    private readonly capacity: number,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  consume(policy: RateLimitPolicy, identity: string): RateLimitDecision {
    const now = this.clock();
    let bucket = this.buckets.get(policy);

    if (!bucket) {
      bucket = { clients: new Map(), sweepAt: now };
      this.buckets.set(policy, bucket);
    }

    if (now >= bucket.sweepAt) {
      for (const [key, counter] of bucket.clients) {
        if (counter.expiresAt <= now) {
          bucket.clients.delete(key);
        }
      }

      bucket.sweepAt = now + 1_000;
    }

    const counter = bucket.clients.get(identity);

    if (counter && counter.expiresAt > now) {
      if (counter.requests >= policy.requestCount) {
        return { allowed: false, retryAfterMs: counter.expiresAt - now };
      }

      counter.requests++;

      return { allowed: true };
    }

    if (!counter && bucket.clients.size >= this.capacity) {
      return { allowed: false, retryAfterMs: bucket.sweepAt - now };
    }

    bucket.clients.set(identity, {
      requests: 1,
      expiresAt: now + policy.windowMs,
    });

    return { allowed: true };
  }
}

export { MemoryRateLimitStore };
