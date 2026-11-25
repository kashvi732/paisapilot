import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { resolveTimeZone } from '../utils/timezone.js'

function emailTakenError() {
  const error = new Error('An account with that email already exists.')
  error.status = 409
  error.code = 'EMAIL_ALREADY_REGISTERED'
  return error
}

function invalidCredentialsError() {
  const error = new Error('Invalid email or password.')
  error.status = 401
  error.code = 'INVALID_CREDENTIALS'
  return error
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    currency: user.currency,
    monthlyIncomePaise: user.monthlyIncomePaise,
    timezone: resolveTimeZone(user.timezone),
    onboardingCompleted: user.onboardingCompleted ?? false,
  }
}

export function createAuthService({ userModel = User, jwtSecret, tokenTtl = '15m' }) {
  if (!jwtSecret) throw new Error('JWT secret is required for authentication')

  // Verifying against a throwaway hash when the email is unknown keeps login
  // response times similar, so timing does not reveal which emails exist.
  let dummyHashPromise = null
  function dummyHash() {
    dummyHashPromise ||= argon2.hash('paisapilot-timing-equaliser', { type: argon2.argon2id })
    return dummyHashPromise
  }

  function createToken(user) {
    return jwt.sign({ sub: user._id.toString() }, jwtSecret, {
      expiresIn: tokenTtl,
      issuer: 'paisapilot-api',
      audience: 'paisapilot-web',
    })
  }

  return {
    async register(payload) {
      const email = payload.email.trim().toLowerCase()
      const existing = await userModel.findOne({ email }).lean()
      if (existing) throw emailTakenError()

      const passwordHash = await argon2.hash(payload.password, { type: argon2.argon2id })
      let user
      try {
        user = await userModel.create({
          name: payload.name.trim(),
          email,
          passwordHash,
          currency: payload.currency.toUpperCase(),
          timezone: payload.timezone,
          monthlyIncomePaise: payload.monthlyIncomePaise,
          onboardingCompleted: false,
        })
      } catch (error) {
        // Two concurrent registrations can both pass the lookup above; the
        // unique email index rejects the second one.
        if (error?.code === 11000) throw emailTakenError()
        throw error
      }
      return { user: publicUser(user), token: createToken(user) }
    },

    async login(payload) {
      const email = payload.email.trim().toLowerCase()
      const user = await userModel.findOne({ email }).select('+passwordHash')
      if (!user) {
        await argon2.verify(await dummyHash(), payload.password).catch(() => false)
        throw invalidCredentialsError()
      }
      if (!(await argon2.verify(user.passwordHash, payload.password))) {
        throw invalidCredentialsError()
      }
      return { user: publicUser(user), token: createToken(user) }
    },

    async getUserById(id) {
      const user = await userModel.findById(id).lean()
      return user ? publicUser(user) : null
    },

    async updatePreferences(id, payload) {
      const updates = { ...payload }
      if (updates.currency) updates.currency = updates.currency.toUpperCase()
      const user = await userModel.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true },
      ).lean()
      if (!user) {
        const error = new Error('User was not found.')
        error.status = 404
        error.code = 'USER_NOT_FOUND'
        throw error
      }
      return publicUser(user)
    },
  }
}
