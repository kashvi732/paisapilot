export function getCookieHeader(header = '') {
  return header.split(';').reduce((cookies, part) => {
    const separator = part.indexOf('=')
    if (separator === -1) return cookies
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!name) return cookies
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
    return cookies
  }, Object.create(null))
}

export const SESSION_MAX_AGE_MS = 15 * 60 * 1000

export function sessionCookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    domain: config.COOKIE_DOMAIN || undefined,
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  }
}

export function clearSessionCookieOptions(config) {
  const { maxAge, ...options } = sessionCookieOptions(config)
  return options
}
