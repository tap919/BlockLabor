import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { AppError } from "../shared/errors.ts";
import { ok, fail } from "../shared/response.ts";
import { logEvent } from "../shared/logger.ts";
import { verifyHmacSignature } from "../shared/webhook.ts";
import { checkIdempotency, markProcessed } from "../shared/idempotency.ts";

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  await logEvent(supabase, requestId, {
    category: "system",
    type: "info",
    message: "Checkr webhook received",
  });

  if (req.method !== "POST") {
    return fail(
      new AppError("BAD_REQUEST", "Method not allowed", 400),
      requestId,
    );
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("X-Checkr-Signature") || "";

    const checkrWebhookSecret = getRequiredEnv("CHECKR_WEBHOOK_SECRET");
    const isValid = await verifyHmacSignature(body, signature, checkrWebhookSecret);

    if (!isValid) {
      return fail(
        new AppError("INVALID_SIGNATURE", "Checkr webhook signature verification failed", 401, false),
        requestId,
      );
    }

    const payload = JSON.parse(body);
    const webhookId = payload.id || crypto.randomUUID();
    const eventType = payload.type || "unknown";

    const idempotency = await checkIdempotency(supabase, "checkr", webhookId);
    if (idempotency.exists) {
      return ok({ ignored: true });
    }

    if (eventType === "report.completed" || eventType === "report.adverse_action") {
      const checkrCandidateId = payload.data?.candidate_id;
      const reportStatus = payload.data?.status;

      const statusMapping: Record<string, string> = {
        "clear": "clear",
        "consider": "consider",
        "suspended": "suspended",
        "adverse_action": "adverse_action",
      };

      const mappedStatus = statusMapping[reportStatus] || reportStatus;

      if (checkrCandidateId) {
        const { data: events } = await supabase
          .from("integration_events")
          .select("object_id")
          .eq("external_id", checkrCandidateId)
          .eq("provider", "checkr")
          .limit(1);

        const candidateId = events?.[0]?.object_id;

        if (candidateId) {
          await supabase
            .from("candidates")
            .update({ background_check_status: mappedStatus })
            .eq("id", candidateId);
        }
      }
    }

    await markProcessed(
      supabase,
      "checkr",
      eventType,
      webhookId,
      "candidate",
      null,
      payload,
      "processed",
    );

    await logEvent(supabase, requestId, {
      category: "system",
      type: "success",
      message: `Checkr webhook processed: ${eventType}`,
    });

    return ok({ processed: true });
  } catch (err) {
    const error = err instanceof Error
      ? new AppError("INTERNAL_ERROR", err.message, 500, false)
      : new AppError("INTERNAL_ERROR", "Unknown error", 500, false);

    await logEvent(supabase, requestId, {
      category: "system",
      type: "error",
      message: `Checkr webhook error: ${error.message}`,
    });

    return fail(error, requestId);
  }
});
