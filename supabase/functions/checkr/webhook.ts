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
    const signature = req.headers.get("X-Checkr-Signature") || "";

    const checkrWebhookSecret = getRequiredEnv("CHECKR_WEBHOOK_SECRET");
    const isValid = await verifyHmacSignature(body, signature, checkrWebhookSecret);

    if (!isValid) {
      return errorResponse(401, "INVALID_SIGNATURE", "Checkr webhook signature verification failed");
    }

    const payload = JSON.parse(body);
    const webhookId = payload.id || crypto.randomUUID();
    const eventType = payload.type || "unknown";

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const idempotency = await checkIdempotency(supabase, "checkr", webhookId);
    if (idempotency.exists) {
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        headers: { "Content-Type": "application/json" },
      });
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

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Checkr webhook error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
