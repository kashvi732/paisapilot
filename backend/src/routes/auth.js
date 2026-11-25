import { Router } from 'express'
import { createRequireAuthFromConfig } from '../middleware/auth.js'
import { validate } from '../validators/common.js'
import { createRateLimiter } from '../middleware/rateLimit.js'
import { clearSessionCookieOptions, sessionCookieOptions } from '../utils/cookies.js'
import { loginSchema, registerSchema } from '../validators/auth.js'

const FIFTEEN_MINUTES = 15 * 60 * 1000

export function createAuthRouter({ authService, config, rateLimit = {} }) {
  const router = Router()
  const cookieOptions = sessionCookieOptions(config)
  const requireAuth = createRequireAuthFromConfig(config, authService)
  const loginLimiter = createRateLimiter({ windowMs: FIFTEEN_MINUTES, max: rateLimit.loginMax ?? 20 })
  const registerLimiter = createRateLimiter({ windowMs: FIFTEEN_MINUTES * 4, max: rateLimit.registerMax ?? 10 })

  router.post('/register', registerLimiter, async (req, res, next) => {
    try {
      const result = await authService.register(validate(registerSchema, req.body))
      res.cookie(config.COOKIE_NAME, result.token, cookieOptions)
      return res.status(201).json({ user: result.user })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const result = await authService.login(validate(loginSchema, req.body))
      res.cookie(config.COOKIE_NAME, result.token, cookieOptions)
      return res.json({ user: result.user })
    } catch (error) {
      return next(error)
    }
  })

  // Logout always clears the cookie, even when the session already expired.
  router.post('/logout', (req, res) => {
    res.clearCookie(config.COOKIE_NAME, clearSessionCookieOptions(config))
    return res.status(204).send()
  })

  router.get('/me', requireAuth, (req, res) => {
    res.json({ user: req.user })
  })

  return router
}
