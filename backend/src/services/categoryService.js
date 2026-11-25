import mongoose from 'mongoose'
import { Category } from '../models/Category.js'
import { AppError } from '../middleware/errors.js'

function notFound() {
  return new AppError(404, 'CATEGORY_NOT_FOUND', 'Category was not found.')
}

function assertId(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound()
}

function publicCategory(category) {
  return {
    id: category._id.toString(),
    name: category.name,
    icon: category.icon,
    color: category.color,
    isSystem: category.isSystem,
    isArchived: category.isArchived,
  }
}

export function createCategoryService({ categoryModel = Category } = {}) {
  return {
    async list(userId) {
      const categories = await categoryModel.find({
        isArchived: false,
        $or: [{ userId }, { isSystem: true }],
      }).sort({ name: 1 }).lean()
      return categories.map(publicCategory)
    },

    async create(userId, payload) {
      try {
        // The unique (userId, name) index also covers archived categories, so a
        // previously archived category is restored rather than blocking the name.
        const archived = await categoryModel.findOneAndUpdate(
          { userId, isSystem: false, isArchived: true, name: payload.name },
          { $set: { ...payload, isArchived: false } },
          { new: true, runValidators: true },
        ).lean()
        if (archived) return publicCategory(archived)

        const category = await categoryModel.create({ ...payload, userId })
        return publicCategory(category)
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError(409, 'CATEGORY_ALREADY_EXISTS', 'A category with this name already exists.')
        }
        throw error
      }
    },

    async update(userId, id, payload) {
      assertId(id)
      try {
        const category = await categoryModel.findOneAndUpdate(
          { _id: id, userId, isSystem: false, isArchived: false },
          { $set: payload },
          { new: true, runValidators: true },
        ).lean()
        if (!category) throw notFound()
        return publicCategory(category)
      } catch (error) {
        if (error?.code === 11000) {
          throw new AppError(409, 'CATEGORY_ALREADY_EXISTS', 'A category with this name already exists.')
        }
        throw error
      }
    },

    async archive(userId, id) {
      assertId(id)
      const result = await categoryModel.updateOne(
        { _id: id, userId, isSystem: false, isArchived: false },
        { $set: { isArchived: true } },
      )
      if (!result.matchedCount) throw notFound()
    },
  }
}
