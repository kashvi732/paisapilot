import { Router } from 'express'
import { createRequireAuthFromConfig } from '../middleware/auth.js'
import { validate } from '../validators/common.js'
import { resolveRangeQuery } from '../utils/timezone.js'
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  transactionCreateSchema,
  transactionQuerySchema,
  transactionUpdateSchema,
} from '../validators/finance.js'


function resourceId(req) {
  return req.params.id
}

export function createFinanceRouter({ categoryService, transactionService, authConfig, authService }) {
  const router = Router()
  const requireAuth = createRequireAuthFromConfig(authConfig, authService)

  router.use(['/categories', '/transactions'], requireAuth)

  router.get('/categories', async (req, res, next) => {
    try {
      res.json({ data: await categoryService.list(req.user.id) })
    } catch (error) {
      next(error)
    }
  })

  router.post('/categories', async (req, res, next) => {
    try {
      res.status(201).json({ category: await categoryService.create(req.user.id, validate(categoryCreateSchema, req.body)) })
    } catch (error) {
      next(error)
    }
  })

  router.put('/categories/:id', async (req, res, next) => {
    try {
      res.json({ category: await categoryService.update(req.user.id, resourceId(req), validate(categoryUpdateSchema, req.body)) })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/categories/:id', async (req, res, next) => {
    try {
      await categoryService.archive(req.user.id, resourceId(req))
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  })

  router.get('/transactions', async (req, res, next) => {
    try {
      const query = resolveRangeQuery(validate(transactionQuerySchema, req.query), req.user.timezone)
      res.json(await transactionService.list(req.user.id, query))
    } catch (error) {
      next(error)
    }
  })

  router.post('/transactions', async (req, res, next) => {
    try {
      res.status(201).json({ transaction: await transactionService.create(req.user.id, validate(transactionCreateSchema, req.body)) })
    } catch (error) {
      next(error)
    }
  })

  router.put('/transactions/:id', async (req, res, next) => {
    try {
      res.json({ transaction: await transactionService.update(req.user.id, resourceId(req), validate(transactionUpdateSchema, req.body)) })
    } catch (error) {
      next(error)
    }
  })

  router.delete('/transactions/:id', async (req, res, next) => {
    try {
      await transactionService.remove(req.user.id, resourceId(req))
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  })

  return router
}
