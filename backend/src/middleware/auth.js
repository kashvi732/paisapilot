import jwt from 'jsonwebtoken'
import { getCookieHeader, SESSION_MAX_AGE_MS, sessionCookieOptions } from '../utils/cookies.js'
import { AppError } from './errors.js'

export const TOKEN_ISSUER = 'paisapilot-api'
export const TOKEN_AUDIENCE = 'paisapilot-web'

// Re-issue the session once less than half of its lifetime remains, so active
// users are not signed out mid-session while idle sessions still expire.
const REFRESH_WHEN_REMAINING_MS = SESSION_MAX_AGE_MS / 2

export function createRequireAuth({ cookieName, jwtSecret, authService, cookieOptions = null }) {
  return async function requireAuth(req, res, next) {
    try {
      const token = getCookieHeader(req.get('cookie'))[cookieName]
      if (!token) {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'))
      }

      const claims = jwt.verify(token, jwtSecret, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
        algorithms: ['HS256'],
      })
      const user = await authService.getUserById(claims.sub)
      if (!user) {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'))
      }

      if (cookieOptions && typeof claims.exp === 'number' && claims.exp * 1000 - Date.now() < REFRESH_WHEN_REMAINING_MS) {
        const refreshed = jwt.sign({ sub: claims.sub }, jwtSecret, {
          expiresIn: Math.floor(SESSION_MAX_AGE_MS / 1000),
          issuer: TOKEN_ISSUER,
          audience: TOKEN_AUDIENCE,
        })
        res.cookie(cookieName, refreshed, cookieOptions)
      }

      req.user = user
      return next()
    } catch (error) {
      if (error instanceof AppError) return next(error)
      if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError' || error?.name === 'NotBeforeError' || error?.name === 'CastError') {
        return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'))
      }
      // Database or other infrastructure failures are not authentication failures.
      return next(error)
    }
  }
}

export function createRequireAuthFromConfig(authConfig, authService) {
  return createRequireAuth({
    cookieName: authConfig.COOKIE_NAME,
    jwtSecret: authConfig.JWT_SECRET,
    authService,
    cookieOptions: sessionCookieOptions(authConfig),
  })
}
