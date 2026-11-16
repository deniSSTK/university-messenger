enum RateLimitPeriod {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
}

const PERIOD_MS: Record<RateLimitPeriod, number> = {
  [RateLimitPeriod.SECOND]: 1_000,
  [RateLimitPeriod.MINUTE]: 60_000,
  [RateLimitPeriod.HOUR]: 3_600_000,
  [RateLimitPeriod.DAY]: 86_400_000,
};

type RateLimitPolicy = {
  endpoint: string;
  requestCount: number;
  windowMs: number;
};
type RateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterMs: number };

interface RateLimitStore {
  consume(
    policy: RateLimitPolicy,
    identity: string,
  ): RateLimitDecision | Promise<RateLimitDecision>;
}

const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

export { RATE_LIMIT_STORE, PERIOD_MS, RateLimitPeriod };
export type { RateLimitPolicy, RateLimitDecision, RateLimitStore };
