export interface RateLimiterOptions {
  time: number;
  maxPoints: number;
  interval?: boolean;
}

export interface RateLimit {
  timestamp: number;
  points: number;
}

export class RateLimiter {
  constructor(options: RateLimiterOptions) {
    this.ratelimits = new Map();
    this.time = options.time;
    this.maxPoints = options.maxPoints;
    if (options.interval !== false) {
      const interval = this.time < 60 * 1000 ? 60 * 1000 : this.time + 5000;
      setInterval(() => {
        for (const [key, value] of this.ratelimits) {
          if (Date.now() - value.timestamp >= 60 * 1000) {
            this.ratelimits.delete(key);
          }
        }
      }, interval);
    }
  }

  private readonly ratelimits: Map<string, RateLimit>;
  private readonly time: number;
  private readonly maxPoints: number;

  check(key: string): boolean {
    const userCooldown = this.ratelimits.get(key);
    const now = Date.now();
    if (!userCooldown) {
      this.ratelimits.set(key, {
        timestamp: Date.now(),
        points: 1,
      });
    } else {
      const timepassed = now - userCooldown.timestamp;
      if (userCooldown.points >= this.maxPoints && timepassed < this.time) {
        return false;
      } else if (timepassed > this.time) {
        this.ratelimits.set(key, {
          timestamp: Date.now(),
          points: 1,
        });
      } else {
        this.ratelimits.set(key, {
          timestamp: userCooldown.timestamp,
          points: userCooldown.points + 1,
        });
      }
    }
    return true;
  }
}
