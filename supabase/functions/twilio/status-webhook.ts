import { createClient } from "npm:@supabase/supabase-js@2"
import { AppError } from "../shared/errors.ts"
import { getRequiredEnv } from "../shared/auth.ts"
import { logEvent } from "../shared/logger.ts"
import { verifyTwilioSignature } from "../shared/webhook.ts"

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
      message: "Twilio status-webhook started",
      meta: { function: "status-webhook" },
    })

    if (req.method !== "POST") {
      throw new AppError("BAD_REQUEST", "Method not allowed", 400)
    }

    const formData = await req.formData()
    const params: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString()
    }

    const url = req.url
    const signature = req.headers.get("X-Twilio-Signature") || ""
    const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN")

    const isValid = await verifyTwilioSignature(url, params, signature, authToken)

    if (!isValid) {
      throw new AppError("INVALID_SIGNATURE", "Twilio webhook signature verification failed", 401, false)
    }

    const messageSid = params.MessageSid
    const messageStatus = params.MessageStatus

    if (!messageSid || !messageStatus) {
      throw new AppError("BAD_REQUEST", "MessageSid and MessageStatus are required", 400)
    }

    const statusMapping: Record<string, string> = {
      "queued": "queued",
      "sent": "sent",
      "delivered": "delivered",
      "failed": "failed",
      "undelivered": "failed",
    }

    const mappedStatus = statusMapping[messageStatus] || messageStatus

    await supabase
      .from("integration_events")
      .update({
        status: mappedStatus,
        last_webhook_at: new Date().toISOString(),
        last_error: messageStatus === "failed" ? (params.ErrorMessage || "Delivery failed") : null,
        payload: params,
      })
      .eq("external_id", messageSid)
      .eq("provider", "twilio")

    await logEvent(supabase, requestId, {
      category: "sms",
      type: "success",
      message: `Twilio status-webhook completed: ${messageSid} → ${mappedStatus}`,
      meta: { function: "status-webhook", messageSid, status: mappedStatus },
    })

    return new Response("<Response><Message>OK</Message></Response>", {
      headers: { "Content-Type": "application/xml" },
    })
  } catch (error) {
    const err = error instanceof AppError
      ? error
      : new AppError("UNHANDLED_ERROR", error instanceof Error ? error.message : "Unknown error", 500)

    await logEvent(supabase, requestId, {
      category: "sms",
      type: err.retryable ? "warning" : "error",
      message: `${err.code}: ${err.message}`,
      meta: { function: "status-webhook", retryable: err.retryable },
    })

    return new Response("<Response><Message>Error</Message></Response>", {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    })
  }
})
