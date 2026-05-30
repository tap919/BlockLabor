import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { AppError } from "../shared/errors.ts";
import { ok, fail } from "../shared/response.ts";
import { logEvent } from "../shared/logger.ts";
import { withRetry } from "../shared/retry.ts";

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  await logEvent(supabase, requestId, {
    category: "recruiter",
    type: "info",
    message: "dropbox-sign/send-request invoked",
  });

  try {
    if (req.method !== "POST") {
      throw new AppError("METHOD_NOT_ALLOWED", "Method not allowed", 405);
    }

    const { candidateId, templateId, subject, message } = await req.json();

    if (!candidateId || !templateId) {
      throw new AppError("VALIDATION_ERROR", "candidateId and templateId are required", 400);
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      throw new AppError("NOT_FOUND", "Candidate not found", 404);
    }

    const dropboxSignApiKey = getRequiredEnv("DROPBOX_SIGN_API_KEY");
    const dropboxSignClientId = getRequiredEnv("DROPBOX_SIGN_CLIENT_ID");

    const result = await withRetry(async () => {
      const response = await fetch(
        "https://api.hellosign.com/v3/signature_request/send_with_template",
        {
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
            test_mode: Deno.env.get("DROPBOX_SIGN_TEST_MODE") === "true",
          }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          throw new AppError("INVALID_CREDENTIALS", "Invalid Dropbox Sign API key", 401, false);
        }
        if (response.status === 429) {
          throw new AppError("RATE_LIMITED", "Dropbox Sign rate limit exceeded", 429, true);
        }
        if (response.status >= 500) {
          throw new AppError("UPSTREAM_ERROR", `Dropbox Sign server error: ${response.status}`, 502, true);
        }
        throw new AppError(
          "BAD_PROVIDER_RESPONSE",
          body.error?.message || "Unknown Dropbox Sign API error",
          502,
          false,
        );
      }

      return body;
    });

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

    await logEvent(supabase, requestId, {
      category: "recruiter",
      type: "success",
      message: `Signature request sent for candidate ${candidateId}`,
      meta: { signatureRequestId },
    });

    return ok({ signature_request_id: signatureRequestId });
  } catch (err) {
    const error =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL_ERROR", err instanceof Error ? err.message : "Unknown error", 500);

    if (!(err instanceof AppError) || err.status >= 500) {
      await supabase.from("integration_events").insert({
        provider: "dropbox_sign",
        event_type: "api_call_failed",
        external_id: null,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: err },
        attempts: 1,
        last_error: error.message,
      });
    }

    await logEvent(supabase, requestId, {
      category: "recruiter",
      type: "error",
      message: `dropbox-sign/send-request failed: ${error.message}`,
      meta: { code: error.code, retryable: error.retryable },
    });

    return fail(error, requestId);
  }
});
