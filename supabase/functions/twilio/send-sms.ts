import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const { to, body, jobId, candidateId } = await req.json();

    if (!to || !body) {
      return badRequest("to and body are required");
    }

    const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
    const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
    const fromNumber = getRequiredEnv("TWILIO_FROM_NUMBER");

    const formData = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    });

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
    );

    const result = await response.json();

    if (!response.ok) {
      const supabaseUrl = getRequiredEnv("SUPABASE_URL");
      const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("integration_events").insert({
        provider: "twilio",
        event_type: "api_call_failed",
        external_id: null,
        object_type: candidateId ? "candidate" : null,
        object_id: jobId || null,
        status: "failed",
        payload: { error: result, to, jobId, candidateId },
        attempts: 1,
        last_error: result.message || "Unknown Twilio error",
      });

      return internalError(`Twilio API error: ${result.message || "Unknown"}`);
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("integration_events").insert({
      provider: "twilio",
      event_type: "sms_sent",
      external_id: result.sid,
      object_type: candidateId ? "candidate" : null,
      object_id: jobId || null,
      status: "sent",
      payload: { ...result, to, body },
      attempts: 1,
    });

    return new Response(JSON.stringify({ success: true, message_sid: result.sid }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Twilio send-sms error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
