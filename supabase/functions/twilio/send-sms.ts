import { createClient } from "npm:@supabase/supabase-js@2"
import { AppError } from "../shared/errors.ts"
import { getRequiredEnv } from "../shared/auth.ts"
import { logEvent } from "../shared/logger.ts"
import { ok, fail } from "../shared/response.ts"
import { withRetry } from "../shared/retry.ts"

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  const supabase = createClient(
    getRequiredEnv("SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  )

  try {
    await logEvent(supabase, requestId, {
      category: "sms",
      type: "info",
      message: "Twilio send-sms started",
      meta: { function: "send-sms" },
    })

    if (req.method !== "POST") {
      throw new AppError("BAD_REQUEST", "Method not allowed", 400)
    }

    const { to, body, jobId, candidateId } = await req.json()

    if (!to || !body) {
      throw new AppError("BAD_REQUEST", "to and body are required", 400)
    }

    const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID")
    const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN")
    const fromNumber = getRequiredEnv("TWILIO_FROM_NUMBER")

    const formData = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    })

    const result = await withRetry(async () => {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        },
      )

      const data = await response.json()

      if (response.status === 401) {
        throw new AppError("INVALID_CREDENTIALS", "Twilio auth failed", 401, false)
      }
      if (response.status === 429) {
        throw new AppError("RATE_LIMITED", "Twilio rate limit hit", 503, true)
      }
      if (response.status >= 500) {
        throw new AppError("UPSTREAM_ERROR", "Twilio server error", 502, true)
      }
      if (!response.ok) {
        throw new AppError("BAD_PROVIDER_RESPONSE", data.message || "Twilio API error", 502, false)
      }

      return data
    })

    await supabase.from("integration_events").insert({
      provider: "twilio",
      event_type: "sms_sent",
      external_id: result.sid,
      object_type: candidateId ? "candidate" : null,
      object_id: jobId || null,
      status: "sent",
      payload: { ...result, to, body },
      attempts: 1,
    })

    await logEvent(supabase, requestId, {
      category: "sms",
      type: "success",
      message: `Twilio send-sms completed: ${result.sid}`,
      meta: { function: "send-sms", messageSid: result.sid, to, jobId, candidateId },
    })

    return ok({ requestId, message_sid: result.sid })
  } catch (error) {
    const err = error instanceof AppError
      ? error
      : new AppError("UNHANDLED_ERROR", error instanceof Error ? error.message : "Unknown error", 500)

    await supabase.from("integration_events").insert({
      provider: "twilio",
      event_type: "api_call_failed",
      external_id: null,
      object_type: candidateId ? "candidate" : null,
      object_id: jobId || null,
      status: "failed",
      payload: { error: err.message, to, jobId, candidateId },
      attempts: 1,
      last_error: err.message,
    })

    await logEvent(supabase, requestId, {
      category: "sms",
      type: err.retryable ? "warning" : "error",
      message: `${err.code}: ${err.message}`,
      meta: { function: "send-sms", retryable: err.retryable },
    })

    return fail(err, requestId)
  }
})
