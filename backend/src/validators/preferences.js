import { z } from 'zod'
import { timezone } from './common.js'

export const preferencesSchema = z.object({
  currency: z.string().trim().length(3).regex(/^[A-Za-z]{3}$/).optional(),
  timezone: timezone.optional(),
  monthlyIncomePaise: z.number().int().nonnegative().safe().optional(),
  onboardingCompleted: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one preference is required.')
