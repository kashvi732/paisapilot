import { Router } from 'express'
import { createRequireAuthFromConfig } from '../middleware/auth.js'
import { validate } from '../validators/common.js'
import { budgetCategorySchema, budgetQuerySchema, budgetUpdateSchema } from '../validators/budgets.js'


export function createBudgetsRouter({ budgetService, authConfig, authService }) {
  const router = Router()
  const requireAuth = createRequireAuthFromConfig(authConfig, authService)

  router.use(['/budgets', '/budgets/:categoryId'], requireAuth)

  router.get('/budgets', async (req, res, next) => {
    try {
      const { month } = validate(budgetQuerySchema, req.query)
      res.json({ budgets: await budgetService.list(req.user.id, month, req.user.timezone) })
    } catch (error) {
      next(error)
    }
  })

  router.put('/budgets/:categoryId', async (req, res, next) => {
    try {
      const categoryId = validate(budgetCategorySchema, req.params.categoryId)
      const payload = validate(budgetUpdateSchema, req.body)
      res.json({ budget: await budgetService.upsert(req.user.id, categoryId, payload, req.user.timezone) })
    } catch (error) {
      next(error)
    }
  })

  return router
}
