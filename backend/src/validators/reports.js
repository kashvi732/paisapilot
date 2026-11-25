import { z } from 'zod'
import { isOrderedRange, isoDate, month, orderedRangeIssue } from './common.js'

const year = z.string().regex(/^\d{4}$/, 'Must use YYYY format.')

// A range is either an explicit from/to pair or a month resolved on the server
// in the user's timezone, so category totals line up with the monthly summary.
function rangeQuery(extra = {}) {
  return z.object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    month: month.optional(),
    ...extra,
  }).strict()
    .refine(value => value.month ? !value.from && !value.to : Boolean(value.from && value.to), {
      message: 'Provide either month or both from and to.',
      path: ['month'],
    })
    .refine(isOrderedRange, orderedRangeIssue)
}

export const summaryQuerySchema = z.object({ month }).strict()
export const trendQuerySchema = z.object({ year }).strict()
export const categoryReportQuerySchema = rangeQuery()
export const exportReportQuerySchema = rangeQuery({ format: z.literal('csv').default('csv') })
