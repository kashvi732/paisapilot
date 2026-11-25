import { describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import { createAuthService } from '../src/services/authService.js'
import { createCategoryService } from '../src/services/categoryService.js'
import { createBudgetService } from '../src/services/budgetService.js'
import { createReportService } from '../src/services/reportService.js'

const SECRET = 'test-secret-that-is-at-least-32-characters'
const lean = value => ({ lean: async () => value })
const userId = new mongoose.Types.ObjectId().toString()

describe('auth service', () => {
  it('maps a duplicate-key race during registration to 409', async () => {
    const userModel = {
      findOne: () => lean(null),
      create: async () => {
        const error = new Error('E11000 duplicate key error')
        error.code = 11000
        throw error
      },
    }
    const service = createAuthService({ userModel, jwtSecret: SECRET })
    await expect(service.register({
      name: 'Test',
      email: 'Test@Example.com',
      password: 'long-enough-password',
      currency: 'inr',
      timezone: 'Asia/Kolkata',
      monthlyIncomePaise: 0,
    })).rejects.toMatchObject({ status: 409, code: 'EMAIL_ALREADY_REGISTERED' })
  })

  it('returns the same error for an unknown email and a wrong password', async () => {
    const service = createAuthService({
      userModel: { findOne: () => ({ select: async () => null }) },
      jwtSecret: SECRET,
    })
    await expect(service.login({ email: 'nobody@example.com', password: 'whatever' }))
      .rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' })
  })

  it('falls back to a valid timezone for legacy accounts', async () => {
    const id = new mongoose.Types.ObjectId()
    const service = createAuthService({
      userModel: { findById: () => lean({ _id: id, name: 'Legacy', email: 'l@example.com', currency: 'INR', timezone: 'Asia/Mumbai' }) },
      jwtSecret: SECRET,
    })
    const user = await service.getUserById(id.toString())
    expect(user.timezone).toBe('Asia/Kolkata')
    expect(user.onboardingCompleted).toBe(false)
  })

  it('only updates preferences that were provided', async () => {
    const findByIdAndUpdate = vi.fn(() => lean({ _id: new mongoose.Types.ObjectId(), currency: 'INR', timezone: 'Asia/Kolkata' }))
    const service = createAuthService({ userModel: { findByIdAndUpdate }, jwtSecret: SECRET })
    await service.updatePreferences(userId, { onboardingCompleted: true })
    expect(findByIdAndUpdate.mock.calls[0][1]).toEqual({ $set: { onboardingCompleted: true } })
    await service.updatePreferences(userId, { currency: 'usd' })
    expect(findByIdAndUpdate.mock.calls[1][1]).toEqual({ $set: { currency: 'USD' } })
  })
})

describe('category service', () => {
  it('returns 404 rather than a cast error for malformed IDs', async () => {
    const categoryModel = { findOneAndUpdate: vi.fn(), updateOne: vi.fn() }
    const service = createCategoryService({ categoryModel })
    await expect(service.update(userId, 'not-an-id', { name: 'x' })).rejects.toMatchObject({ status: 404 })
    await expect(service.archive(userId, 'not-an-id')).rejects.toMatchObject({ status: 404 })
    expect(categoryModel.findOneAndUpdate).not.toHaveBeenCalled()
    expect(categoryModel.updateOne).not.toHaveBeenCalled()
  })

  it('restores an archived category instead of rejecting its name forever', async () => {
    const archived = { _id: new mongoose.Types.ObjectId(), name: 'Food', icon: '', color: '#fff', isSystem: false, isArchived: false }
    const categoryModel = {
      findOneAndUpdate: vi.fn(() => lean(archived)),
      create: vi.fn(),
    }
    const service = createCategoryService({ categoryModel })
    const category = await service.create(userId, { name: 'Food', icon: '', color: '#fff' })
    expect(category).toMatchObject({ id: archived._id.toString(), name: 'Food', isArchived: false })
    expect(categoryModel.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ userId, isArchived: true, name: 'Food' })
    expect(categoryModel.create).not.toHaveBeenCalled()
  })

  it('maps duplicate active names to 409', async () => {
    const categoryModel = {
      findOneAndUpdate: () => lean(null),
      create: async () => {
        const error = new Error('dup')
        error.code = 11000
        throw error
      },
    }
    const service = createCategoryService({ categoryModel })
    await expect(service.create(userId, { name: 'Food' })).rejects.toMatchObject({ status: 409, code: 'CATEGORY_ALREADY_EXISTS' })
  })
})

describe('budget service', () => {
  it('reports usage for upserted budgets regardless of category ID casing', async () => {
    const categoryId = new mongoose.Types.ObjectId()
    const service = createBudgetService({
      categoryModel: { findOne: () => lean({ _id: categoryId, name: 'Food', color: '#f00' }) },
      budgetModel: {
        findOneAndUpdate: () => lean({ _id: new mongoose.Types.ObjectId(), categoryId, month: '2026-11', limitPaise: 10000 }),
      },
      transactionModel: { aggregate: async () => [{ _id: categoryId, usedPaise: 2500 }] },
    })
    const budget = await service.upsert(userId, categoryId.toString().toUpperCase(), { month: '2026-11', limitPaise: 10000 }, 'Asia/Kolkata')
    expect(budget).toMatchObject({ usedPaise: 2500, remainingPaise: 7500, utilizationPercent: 25, categoryColor: '#f00' })
  })

  it('computes utilization from integer paise and handles zero limits', async () => {
    const food = new mongoose.Types.ObjectId()
    const travel = new mongoose.Types.ObjectId()
    const aggregate = vi.fn(async () => [{ _id: food, usedPaise: 33333 }])
    const service = createBudgetService({
      budgetModel: {
        find: () => ({ sort: () => lean([
          { _id: new mongoose.Types.ObjectId(), categoryId: food, month: '2026-11', limitPaise: 100000 },
          { _id: new mongoose.Types.ObjectId(), categoryId: travel, month: '2026-11', limitPaise: 0 },
        ]) }),
      },
      categoryModel: { find: () => lean([{ _id: food, name: 'Food' }]) },
      transactionModel: { aggregate },
    })
    const budgets = await service.list(userId, '2026-11', 'Asia/Kolkata')
    expect(budgets[0]).toMatchObject({ categoryName: 'Food', usedPaise: 33333, remainingPaise: 66667, utilizationPercent: 33.33 })
    expect(budgets[1]).toMatchObject({ categoryName: 'Archived category', usedPaise: 0, utilizationPercent: 0 })
    const match = aggregate.mock.calls[0][0][0].$match
    expect(match.userId).toBeInstanceOf(mongoose.Types.ObjectId)
    expect(match.date.$gte.toISOString()).toBe('2026-10-31T18:30:00.000Z')
    expect(match.date.$lt.toISOString()).toBe('2026-11-30T18:30:00.000Z')
  })
})

describe('report service', () => {
  it('summarizes income and expense totals in paise', async () => {
    const service = createReportService({
      transactionModel: {
        aggregate: async () => [{
          totals: [{ _id: 'income', totalPaise: 8500000 }, { _id: 'expense', totalPaise: 2125050 }],
          count: [{ value: 12 }],
        }],
      },
    })
    expect(await service.summary(userId, '2026-11', 'Asia/Kolkata')).toEqual({
      incomePaise: 8500000,
      expensePaise: 2125050,
      balancePaise: 6374950,
      savingsRate: 75,
      transactionCount: 12,
    })
  })

  it('returns zeroes for a month without transactions', async () => {
    const service = createReportService({ transactionModel: { aggregate: async () => [{ totals: [], count: [] }] } })
    expect(await service.summary(userId, '2026-11', 'Asia/Kolkata')).toEqual({
      incomePaise: 0,
      expensePaise: 0,
      balancePaise: 0,
      savingsRate: 0,
      transactionCount: 0,
    })
  })

  it('neutralizes spreadsheet formulas in CSV exports', async () => {
    const service = createReportService({
      transactionModel: {
        find: () => ({ populate: () => ({ sort: () => lean([{
          date: new Date('2026-11-05T10:00:00Z'),
          type: 'expense',
          categoryId: { name: 'Food' },
          amountPaise: 12345,
          paymentMode: 'upi',
          note: '=HYPERLINK("http://evil")',
        }]) }) }),
      },
    })
    const csv = await service.exportCsv(userId, '2026-11-01T00:00:00Z', '2026-11-30T23:59:59Z')
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(csv.endsWith('\r\n')).toBe(true)
  })
})
