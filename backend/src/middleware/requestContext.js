import { randomUUID } from 'node:crypto'

// Accept a caller-supplied request ID only when it is short and log-safe.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

export function requestContext(req, res, next) {
  const supplied = req.get('x-request-id')
  const requestId = supplied && SAFE_REQUEST_ID.test(supplied) ? supplied : randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}
