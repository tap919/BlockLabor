import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const { candidateId, templateId, subject, message } = await req.json();

    if (!candidateId || !templateId) {
      return badRequest("candidateId and templateId are required");
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return errorResponse(404, "CANDIDATE_NOT_FOUND", "Candidate not found");
    }

    const dropboxSignApiKey = getRequiredEnv("DROPBOX_SIGN_API_KEY");
    const dropboxSignClientId = getRequiredEnv("DROPBOX_SIGN_CLIENT_ID");

    const response = await fetch("https://api.hellosign.com/v3/signature_request/send_with_template", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${dropboxSignApiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_ids: [templateId],
        subject: subject || "Please sign your document",
        message: message || "Please review and sign the attached document.",
        signers: [
          {
            email_address: candidate.email,
            name: `${candidate.first_name} ${candidate.last_name}`,
            role: "signer",
          },
        ],
        client_id: dropboxSignClientId,
        test_mode: true,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      await supabase.from("integration_events").insert({
        provider: "dropbox_sign",
        event_type: "api_call_failed",
        external_id: null,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: result },
        attempts: 1,
        last_error: result.error?.message || "Unknown Dropbox Sign API error",
      });

      return internalError(`Dropbox Sign API error: ${result.error?.message || "Unknown"}`);
    }

    const signatureRequestId = result.signature_request?.signature_request_id;

    await supabase.from("integration_events").insert({
      provider: "dropbox_sign",
      event_type: "signature_request_sent",
      external_id: signatureRequestId,
      object_type: "candidate",
      object_id: candidateId,
      status: "pending",
      payload: result,
      attempts: 1,
    });

    await supabase
      .from("candidates")
      .update({ e_sign_status: "sent" })
      .eq("id", candidateId);

    return new Response(JSON.stringify({ success: true, signature_request_id: signatureRequestId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Dropbox Sign send-request error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
