import { Router } from 'express'
import { createRequireAuthFromConfig } from '../middleware/auth.js'
import { validate } from '../validators/common.js'
import { resolveRangeQuery } from '../utils/timezone.js'
import { categoryReportQuerySchema, exportReportQuerySchema, summaryQuerySchema, trendQuerySchema } from '../validators/reports.js'


export function createReportsRouter({ reportService, authConfig, authService }) {
  const router = Router()
  const requireAuth = createRequireAuthFromConfig(authConfig, authService)

  router.use(['/reports/summary', '/reports/by-category', '/reports/monthly-trend', '/reports/export'], requireAuth)

  router.get('/reports/export', async (req, res, next) => {
    try {
      const { from, to } = resolveRangeQuery(validate(exportReportQuerySchema, req.query), req.user.timezone)
      const csv = await reportService.exportCsv(req.user.id, from, to)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="paisapilot-report.csv"')
      res.send(csv)
    } catch (error) {
      next(error)
    }
  })

  router.get('/reports/summary', async (req, res, next) => {
    try {
      const { month } = validate(summaryQuerySchema, req.query)
      res.json({ summary: await reportService.summary(req.user.id, month, req.user.timezone) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/reports/by-category', async (req, res, next) => {
    try {
      const { from, to } = resolveRangeQuery(validate(categoryReportQuerySchema, req.query), req.user.timezone)
      res.json({ categories: await reportService.byCategory(req.user.id, from, to) })
    } catch (error) {
      next(error)
    }
  })

  router.get('/reports/monthly-trend', async (req, res, next) => {
    try {
      const { year } = validate(trendQuerySchema, req.query)
      res.json({ months: await reportService.monthlyTrend(req.user.id, year, req.user.timezone) })
    } catch (error) {
      next(error)
    }
  })

  return router
}
