import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { verifyHmacSignature } from "../shared/webhook.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";
import { checkIdempotency, markProcessed } from "../shared/idempotency.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("X-Dropbox-Sign-Signature") || "";
    const timestamp = req.headers.get("X-Dropbox-Sign-Request-Timestamp") || "";

    const apiKey = getRequiredEnv("DROPBOX_SIGN_API_KEY");
    const isValid = await verifyHmacSignature(body, signature, apiKey);

    if (!isValid) {
      return errorResponse(401, "INVALID_SIGNATURE", "Webhook signature verification failed");
    }

    const payload = JSON.parse(body);
    const eventType = payload.event?.event_type || "unknown";
    const signatureRequestId = payload.signature_request?.signature_request_id;

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (signatureRequestId) {
      const idempotency = await checkIdempotency(supabase, "dropbox_sign", signatureRequestId);
      if (idempotency.exists) {
        return new Response(JSON.stringify({ success: true, ignored: true }), {
          headers: { "Content-Type": "application/json" },
        });
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Dropbox Sign webhook error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
