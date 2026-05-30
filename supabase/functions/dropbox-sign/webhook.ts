import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { verifyHmacSignature } from "../shared/webhook.ts";
import { AppError } from "../shared/errors.ts";
import { ok, fail } from "../shared/response.ts";
import { logEvent } from "../shared/logger.ts";
import { checkIdempotency, markProcessed } from "../shared/idempotency.ts";

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    await logEvent(supabase, requestId, {
      category: "system",
      type: "info",
      message: "Dropbox Sign webhook received",
    });

    if (req.method !== "POST") {
      throw new AppError("BAD_REQUEST", "Method not allowed", 405, false);
    }

    const body = await req.text();
    const signature = req.headers.get("X-Dropbox-Sign-Signature") || "";
    const timestamp = req.headers.get("X-Dropbox-Sign-Request-Timestamp") || "";

    const apiKey = getRequiredEnv("DROPBOX_SIGN_API_KEY");
    const isValid = await verifyHmacSignature(body, signature, apiKey);

    if (!isValid) {
      throw new AppError("INVALID_SIGNATURE", "Webhook signature verification failed", 401, false);
    }

    const payload = JSON.parse(body);
    const eventType = payload.event?.event_type || "unknown";
    const signatureRequestId = payload.signature_request?.signature_request_id;

    if (signatureRequestId) {
      const idempotency = await checkIdempotency(supabase, "dropbox_sign", signatureRequestId);
      if (idempotency.exists) {
        return ok({ ignored: true });
      }
    }

    const eventMapping: Record<string, string> = {
      "signature_request_signed": "signed",
      "signature_request_declined": "declined",
      "signature_request_viewed": "viewed",
      "signature_request_expired": "expired",
    };

    const candidateStatus = eventMapping[eventType];

    if (candidateStatus && signatureRequestId) {
      const { data: events } = await supabase
        .from("integration_events")
        .select("object_id")
        .eq("external_id", signatureRequestId)
        .eq("provider", "dropbox_sign")
        .limit(1);

      const candidateId = events?.[0]?.object_id;

      if (candidateId) {
        await supabase
          .from("candidates")
          .update({ e_sign_status: candidateStatus })
          .eq("id", candidateId);
      }
    }

    await markProcessed(
      supabase,
      "dropbox_sign",
      eventType,
      signatureRequestId || crypto.randomUUID(),
      "candidate",
      null,
      payload,
      "processed",
    );

    await logEvent(supabase, requestId, {
      category: "system",
      type: "success",
      message: `Dropbox Sign webhook processed: ${eventType}`,
    });

    return ok({ processed: true });
  } catch (err) {
    const appError =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error", 500, false);

    await logEvent(supabase, requestId, {
      category: "system",
      type: "error",
      message: `Dropbox Sign webhook error: ${appError.message}`,
      meta: { code: appError.code },
    });

    return fail(appError, requestId);
  }
});
