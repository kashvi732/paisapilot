export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} was not found.`,
      requestId: req.requestId,
    },
  })
}

function classifyError(error) {
  if (error instanceof AppError) {
    return { status: error.status, code: error.code, message: error.message }
  }
  // body-parser errors such as entity.too.large carry an HTTP status and type.
  if (error?.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' }
  }
  // Safety nets for Mongoose errors that escape service-level handling.
  if (error?.name === 'CastError') {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Request contains an invalid identifier or value.' }
  }
  if (error?.name === 'ValidationError') {
    return { status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed.' }
  }
  if (error?.code === 11000) {
    return { status: 409, code: 'CONFLICT', message: 'A record with these details already exists.' }
  }
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status < 600 ? error.status : 500
  return {
    status,
    code: error?.code && typeof error.code === 'string' ? error.code : 'INTERNAL_SERVER_ERROR',
    message: error?.message,
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  const isJsonSyntaxError = error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed'
  const known = isJsonSyntaxError
    ? { status: 400, code: 'INVALID_JSON', message: 'Request body contains malformed JSON.' }
    : classifyError(error)
  const status = known.status
  const code = known.code
  const message = status >= 500 ? 'An unexpected server error occurred.' : known.message

  if (status >= 500) {
    console.error(`[http] ${req.requestId || 'unknown'} ${error.stack || error.message}`)
  }

  const response = {
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  }
  if (error?.fields && status < 500) response.error.fields = error.fields
  return res.status(status).json(response)
}
