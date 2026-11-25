import { z } from 'zod'
import { month } from './common.js'

const categoryId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid category ID.')

export const budgetQuerySchema = z.object({ month }).strict()

export const budgetUpdateSchema = z.object({
  month,
  limitPaise: z.number().int().nonnegative().safe(),
}).strict()

export const budgetCategorySchema = categoryId
