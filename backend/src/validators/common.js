import { z } from 'zod'
import { AppError } from '../middleware/errors.js'
import { isValidTimeZone } from '../utils/timezone.js'

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid resource ID.')
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Must use YYYY-MM format.')
export const isoDate = z.string().datetime({ offset: true })
export const timezone = z.string().trim().min(1).max(64).refine(isValidTimeZone, 'Must be a valid IANA timezone.')

// ISO strings with different offsets do not sort lexically, so compare instants.
export function isOrderedRange({ from, to }) {
  return !from || !to || Date.parse(from) <= Date.parse(to)
}

export const orderedRangeIssue = {
  message: 'from must be earlier than or equal to to.',
  path: ['from'],
}

export function validate(schema, input) {
  const result = schema.safeParse(input)
  if (!result.success) {
    const fields = {}
    result.error.issues.forEach(issue => {
      fields[issue.path.join('.') || 'request'] = issue.message
    })
    throw new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', fields)
  }
  return result.data
}
