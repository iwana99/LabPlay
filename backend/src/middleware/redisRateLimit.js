import { getRedis } from "../config/redis.js";

const FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export function redisRateLimit({ namespace, limit, windowSeconds, key = (req) => req.ip, failOpen = false }) {
  return async function rateLimit(req, res, next) {
    try {
      const redis = getRedis();
      const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
      const redisKey = `rl:${namespace}:${key(req)}:${bucket}`;
      const [countRaw, ttlRaw] = await redis.eval(FIXED_WINDOW_SCRIPT, 1, redisKey, String(windowSeconds + 2));
      const count = Number(countRaw);
      const ttl = Math.max(0, Number(ttlRaw));

      res.setHeader("RateLimit-Limit", String(limit));
      res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - count)));
      res.setHeader("RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + ttl));

      if (count > limit) {
        res.setHeader("Retry-After", String(ttl || windowSeconds));
        return res.status(429).json({ code: "RATE_LIMITED", message: "Too many requests", requestId: req.id });
      }
      next();
    } catch (err) {
      if (failOpen) return next();
      next(err);
    }
  };
}
