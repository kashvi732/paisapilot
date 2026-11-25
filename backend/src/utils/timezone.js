function partsToUtc(parts) {
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]))
  return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second)
}

function timezoneOffsetMs(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return partsToUtc(formatter.formatToParts(date).filter(part => part.type !== 'literal')) - date.getTime()
}

function localBoundaryUtc(year, monthIndex, timezone) {
  const localGuess = Date.UTC(year, monthIndex, 1)
  const firstOffset = timezoneOffsetMs(new Date(localGuess), timezone)
  const firstUtc = localGuess - firstOffset
  const correctedOffset = timezoneOffsetMs(new Date(firstUtc), timezone)
  return new Date(localGuess - correctedOffset)
}

export function monthDateRange(month, timezone) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  return {
    from: localBoundaryUtc(year, monthIndex, timezone),
    to: localBoundaryUtc(year, monthIndex + 1, timezone),
  }
}

export function yearDateRange(year, timezone) {
  if (!/^\d{4}$/.test(year)) return null
  const numericYear = Number(year)
  return {
    from: localBoundaryUtc(numericYear, 0, timezone),
    to: localBoundaryUtc(numericYear + 1, 0, timezone),
  }
}

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function isValidTimeZone(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim()) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

// Accounts created before timezone validation existed may hold names such as
// "Asia/Mumbai" that are not IANA zones. Fall back instead of failing every
// report and budget request for those users.
export function resolveTimeZone(timezone, fallback = DEFAULT_TIMEZONE) {
  return isValidTimeZone(timezone) ? timezone : fallback
}

// Inclusive ISO range for a user-local month, for APIs that take from/to.
export function inclusiveMonthRange(month, timezone) {
  const range = monthDateRange(month, timezone)
  if (!range) return null
  return {
    from: range.from.toISOString(),
    to: new Date(range.to.getTime() - 1).toISOString(),
  }
}

// Replace an optional `month` query value with from/to bounds in the user's timezone.
export function resolveRangeQuery(query, timezone) {
  const { month, ...rest } = query
  if (!month) return rest
  return { ...rest, ...inclusiveMonthRange(month, resolveTimeZone(timezone)) }
}
