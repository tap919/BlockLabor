import { AppError } from './errors.ts'

export const ok = (data: unknown) =>
  new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

export const fail = (err: AppError, requestId: string) =>
  new Response(
    JSON.stringify({
      ok: false,
      error: { code: err.code, message: err.message, retryable: err.retryable },
      requestId,
    }),
    { status: err.status, headers: { 'Content-Type': 'application/json' } },
  )
