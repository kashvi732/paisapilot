import { Router } from 'express'
import { createRequireAuthFromConfig } from '../middleware/auth.js'
import { validate } from '../validators/common.js'
import { preferencesSchema } from '../validators/preferences.js'


export function createPreferencesRouter({ authConfig, authService }) {
  const router = Router()
  const requireAuth = createRequireAuthFromConfig(authConfig, authService)
  router.use(['/user/preferences'], requireAuth)
  router.get('/user/preferences', (req, res) => res.json({ preferences: req.user }))
  router.patch('/user/preferences', async (req, res, next) => {
    try {
      const preferences = await authService.updatePreferences(req.user.id, validate(preferencesSchema, req.body))
      res.json({ preferences })
    } catch (error) {
      next(error)
    }
  })
  return router
}
