import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../src/app.js'
import { loadConfig } from '../src/config/env.js'
import { createRateLimiter } from '../src/middleware/rateLimit.js'
import { getCookieHeader } from '../src/utils/cookies.js'
import {
  inclusiveMonthRange,
  isValidTimeZone,
  monthDateRange,
  resolveRangeQuery,
  resolveTimeZone,
} from '../src/utils/timezone.js'
import { categoryReportQuerySchema } from '../src/validators/reports.js'
import { transactionQuerySchema } from '../src/validators/finance.js'
import { registerSchema } from '../src/validators/auth.js'

const SECRET = 'test-secret-that-is-at-least-32-characters'
const authConfig = {
  COOKIE_NAME: 'paisapilot_session',
  COOKIE_SECURE: false,
  COOKIE_SAME_SITE: 'lax',
  COOKIE_DOMAIN: '',
  JWT_SECRET: SECRET,
}

function token(options = {}) {
  return jwt.sign({ sub: 'user-1' }, SECRET, {
    issuer: 'paisapilot-api',
    audience: 'paisapilot-web',
    expiresIn: '15m',
    ...options,
  })
}

const sessionCookie = value => `paisapilot_session=${value}`

function buildApp(overrides = {}) {
  const calls = []
  const app = createApp({
    authConfig,
    authService: {
      async register() {
        return { user: { id: 'user-1' }, token: token() }
      },
      async login() {
        return { user: { id: 'user-1' }, token: token() }
      },
      async getUserById(id) {
        return id === 'user-1' ? { id, name: 'Test', email: 't@example.com', timezone: 'Asia/Kolkata' } : null
      },
      async updatePreferences(id, payload) {
        calls.push(['preferences', payload])
        return { id, ...payload }
      },
      ...overrides.authService,
    },
    reportService: {
      async byCategory(userId, from, to) {
        calls.push(['by-category', from, to])
        return []
      },
      async exportCsv(userId, from, to) {
        calls.push(['export', from, to])
        return 'Date\r\n'
      },
    },
    transactionService: {
      async list(userId, query) {
        calls.push(['transactions', query])
        return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      },
    },
    categoryService: {},
    budgetService: {},
    rateLimit: overrides.rateLimit,
  })
  return { app, calls }
}

describe('timezone utilities', () => {
  it('computes user-local month boundaries in UTC', () => {
    const range = monthDateRange('2026-11', 'Asia/Kolkata')
    expect(range.from.toISOString()).toBe('2026-10-31T18:30:00.000Z')
    expect(range.to.toISOString()).toBe('2026-11-30T18:30:00.000Z')
  })

  it('handles daylight-saving transitions', () => {
    const range = monthDateRange('2026-03', 'America/New_York')
    expect(range.from.toISOString()).toBe('2026-03-01T05:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-04-01T04:00:00.000Z')
  })

  it('builds an inclusive month range ending one millisecond before the next month', () => {
    expect(inclusiveMonthRange('2026-12', 'Asia/Kolkata')).toEqual({
      from: '2026-11-30T18:30:00.000Z',
      to: '2026-12-31T18:29:59.999Z',
    })
  })

  it('validates IANA timezones and falls back for legacy invalid values', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true)
    expect(isValidTimeZone('Asia/Mumbai')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(resolveTimeZone('Asia/Delhi')).toBe('Asia/Kolkata')
    expect(resolveTimeZone('Europe/London')).toBe('Europe/London')
  })

  it('replaces a month query with resolved bounds', () => {
    expect(resolveRangeQuery({ month: '2026-11', page: 1 }, 'not/a-zone')).toEqual({
      page: 1,
      from: '2026-10-31T18:30:00.000Z',
      to: '2026-11-30T18:29:59.999Z',
    })
    expect(resolveRangeQuery({ from: 'a', to: 'b' }, 'Asia/Kolkata')).toEqual({ from: 'a', to: 'b' })
  })
})

describe('validators', () => {
  it('rejects timezones that are not IANA zones at registration', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 't@example.com',
      password: 'long-enough-password',
      timezone: 'Asia/Mumbai',
    })
    expect(result.success).toBe(false)
  })

  it('compares date ranges as instants, not strings', () => {
    // 10:00+05:30 is 04:30Z, which is earlier than 05:00Z even though the string sorts later.
    const ordered = categoryReportQuerySchema.safeParse({ from: '2026-11-01T10:00:00+05:30', to: '2026-11-01T05:00:00Z' })
    expect(ordered.success).toBe(true)
    const reversed = categoryReportQuerySchema.safeParse({ from: '2026-11-01T06:00:00Z', to: '2026-11-01T10:00:00+05:30' })
    expect(reversed.success).toBe(false)
  })

  it('accepts either month or from/to for report ranges', () => {
    expect(categoryReportQuerySchema.safeParse({ month: '2026-11' }).success).toBe(true)
    expect(categoryReportQuerySchema.safeParse({ month: '2026-11', from: '2026-11-01T00:00:00Z' }).success).toBe(false)
    expect(categoryReportQuerySchema.safeParse({ from: '2026-11-01T00:00:00Z' }).success).toBe(false)
    expect(transactionQuerySchema.safeParse({ month: '2026-11', to: '2026-11-30T00:00:00Z' }).success).toBe(false)
  })
})

describe('configuration', () => {
  const base = {
    MONGODB_URI: 'mongodb://localhost:27017/paisapilot',
    JWT_SECRET: 'a'.repeat(32),
    CRON_SECRET: 'b'.repeat(16),
  }

  it('requires secure cookies when SameSite is none', () => {
    expect(() => loadConfig({ ...base, COOKIE_SAME_SITE: 'none' })).toThrow(/COOKIE_SAME_SITE=none/)
    expect(loadConfig({ ...base, COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'true' }).COOKIE_SAME_SITE).toBe('none')
  })

  it('parses the trusted proxy hop count', () => {
    expect(loadConfig(base).TRUST_PROXY).toBe(0)
    expect(loadConfig({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1)
  })
})

describe('cookie parsing', () => {
  it('tolerates malformed encodings and prototype keys', () => {
    const cookies = getCookieHeader('a=%E0%A4%A; __proto__=x; b=ok')
    expect(cookies.a).toBe('%E0%A4%A')
    expect(cookies.b).toBe('ok')
    expect(Object.getPrototypeOf(cookies)).toBe(null)
  })
})

describe('session handling', () => {
  it('clears the session cookie on logout even without a valid session', async () => {
    const { app } = buildApp()
    const response = await request(app).post('/api/auth/logout')
    expect(response.status).toBe(204)
    expect(response.headers['set-cookie'][0]).toMatch(/paisapilot_session=;/)
    expect(response.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970')
  })

  it('refreshes a session that is past half of its lifetime', async () => {
    const { app } = buildApp()
    const response = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(token({ expiresIn: '5m' })))
    expect(response.status).toBe(200)
    const cookie = response.headers['set-cookie']?.[0]
    expect(cookie).toMatch(/^paisapilot_session=/)
    expect(cookie).toContain('HttpOnly')
    const refreshed = decodeURIComponent(cookie.split(';')[0].split('=')[1])
    const claims = jwt.verify(refreshed, SECRET, { issuer: 'paisapilot-api', audience: 'paisapilot-web' })
    expect(claims.sub).toBe('user-1')
    expect(claims.exp * 1000 - Date.now()).toBeGreaterThan(14 * 60 * 1000)
  })

  it('does not reissue a fresh session on every request', async () => {
    const { app } = buildApp()
    const response = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(token()))
    expect(response.status).toBe(200)
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('rejects expired and tampered tokens', async () => {
    const { app } = buildApp()
    const expired = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(token({ expiresIn: -10 })))
    expect(expired.status).toBe(401)
    const forged = jwt.sign({ sub: 'user-1' }, 'another-secret-that-is-at-least-32-chars', { issuer: 'paisapilot-api', audience: 'paisapilot-web' })
    const tampered = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(forged))
    expect(tampered.status).toBe(401)
  })

  it('reports infrastructure failures as server errors instead of signing the user out', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { app } = buildApp({
      authService: { async getUserById() { throw new Error('database unavailable') } },
    })
    const response = await request(app).get('/api/auth/me').set('Cookie', sessionCookie(token()))
    expect(response.status).toBe(500)
    expect(response.body.error.message).toBe('An unexpected server error occurred.')
    error.mockRestore()
  })

  it('rate limits repeated login attempts', async () => {
    const { app } = buildApp({ rateLimit: { loginMax: 2 } })
    const body = { email: 'x@example.com', password: 'secret' }
    expect((await request(app).post('/api/auth/login').send(body)).status).toBe(200)
    expect((await request(app).post('/api/auth/login').send(body)).status).toBe(200)
    const limited = await request(app).post('/api/auth/login').send(body)
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('TOO_MANY_REQUESTS')
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
  })
})

describe('rate limiter', () => {
  it('resets after the window elapses', () => {
    let now = 0
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => now })
    const res = { setHeader: vi.fn() }
    const next = vi.fn()
    limiter({ ip: '1.1.1.1' }, res, next)
    limiter({ ip: '1.1.1.1' }, res, next)
    expect(next.mock.calls[1][0]?.status).toBe(429)
    now = 1001
    limiter({ ip: '1.1.1.1' }, res, next)
    expect(next.mock.calls[2][0]).toBeUndefined()
  })
})

describe('HTTP hardening', () => {
  it('sets baseline security headers and disables caching of API responses', async () => {
    const { app } = buildApp()
    const response = await request(app).get('/api/health')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-frame-options']).toBe('DENY')
    expect(response.headers['cache-control']).toBe('no-store')
  })

  it('ignores unsafe caller-supplied request IDs', async () => {
    const { app } = buildApp()
    const safe = await request(app).get('/api/health').set('X-Request-Id', 'abc-123')
    expect(safe.headers['x-request-id']).toBe('abc-123')
    const unsafe = await request(app).get('/api/health').set('X-Request-Id', 'bad id\twith spaces')
    expect(unsafe.headers['x-request-id']).not.toBe('bad id\twith spaces')
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns 413 for oversized JSON bodies', async () => {
    const { app } = buildApp()
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'x@example.com', password: 'a'.repeat(200 * 1024) }))
    expect(response.status).toBe(413)
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('rejects an invalid timezone preference', async () => {
    const { app, calls } = buildApp()
    const response = await request(app)
      .patch('/api/user/preferences')
      .set('Cookie', sessionCookie(token()))
      .send({ timezone: 'Asia/Bangalore' })
    expect(response.status).toBe(400)
    expect(response.body.error.fields.timezone).toBeDefined()
    expect(calls).toEqual([])
  })
})

describe('month-based ranges', () => {
  it('resolves category reports for a month in the user timezone', async () => {
    const { app, calls } = buildApp()
    const response = await request(app)
      .get('/api/reports/by-category?month=2026-11')
      .set('Cookie', sessionCookie(token()))
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['by-category', '2026-10-31T18:30:00.000Z', '2026-11-30T18:29:59.999Z'])
  })

  it('resolves CSV exports for a month in the user timezone', async () => {
    const { app, calls } = buildApp()
    const response = await request(app)
      .get('/api/reports/export?month=2026-11')
      .set('Cookie', sessionCookie(token()))
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['export', '2026-10-31T18:30:00.000Z', '2026-11-30T18:29:59.999Z'])
  })

  it('resolves transaction lists for a month in the user timezone', async () => {
    const { app, calls } = buildApp()
    const response = await request(app)
      .get('/api/transactions?month=2026-11&limit=6')
      .set('Cookie', sessionCookie(token()))
    expect(response.status).toBe(200)
    expect(calls).toContainEqual(['transactions', {
      page: 1,
      limit: 6,
      from: '2026-10-31T18:30:00.000Z',
      to: '2026-11-30T18:29:59.999Z',
    }])
  })
})
