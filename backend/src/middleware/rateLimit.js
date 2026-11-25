import { AppError } from './errors.js'

// Small fixed-window limiter for credential endpoints. State is per process, so
// a multi-instance deployment should move this to a shared store.
export function createRateLimiter({ windowMs, max, keyGenerator = req => req.ip || 'unknown', now = Date.now }) {
  const hits = new Map()

  const sweep = setInterval(() => {
    const current = now()
    for (const [key, entry] of hits) {
      if (entry.resetAt <= current) hits.delete(key)
    }
  }, windowMs)
  sweep.unref?.()

  function rateLimit(req, res, next) {
    const current = now()
    const key = keyGenerator(req)
    let entry = hits.get(key)
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs }
      hits.set(key, entry)
    }
    entry.count += 1

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - current) / 1000))))
      return next(new AppError(429, 'TOO_MANY_REQUESTS', 'Too many attempts. Please try again later.'))
    }
    return next()
  }

  rateLimit.reset = () => hits.clear()
  return rateLimit
}
