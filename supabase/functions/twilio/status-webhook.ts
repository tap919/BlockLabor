import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { verifyTwilioSignature } from "../shared/webhook.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    const url = req.url;
    const signature = req.headers.get("X-Twilio-Signature") || "";
    const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");

    const isValid = await verifyTwilioSignature(url, params, signature, authToken);

    if (!isValid) {
      return errorResponse(401, "INVALID_SIGNATURE", "Twilio webhook signature verification failed");
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;

    if (!messageSid || !messageStatus) {
      return badRequest("MessageSid and MessageStatus are required");
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const statusMapping: Record<string, string> = {
      "queued": "queued",
      "sent": "sent",
      "delivered": "delivered",
      "failed": "failed",
      "undelivered": "failed",
    };

    const mappedStatus = statusMapping[messageStatus] || messageStatus;

    await supabase
      .from("integration_events")
      .update({
        status: mappedStatus,
        last_webhook_at: new Date().toISOString(),
        last_error: messageStatus === "failed" ? (params.ErrorMessage || "Delivery failed") : null,
        payload: params,
      })
      .eq("external_id", messageSid)
      .eq("provider", "twilio");

    return new Response("<Response><Message>OK</Message></Response>", {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    console.error("Twilio status-webhook error:", err);
    return new Response("<Response><Message>Error</Message></Response>", {
      status: 500,
      headers: { "Content-Type": "application/xml" },
    });
  }
});
