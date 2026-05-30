import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const { candidateId } = await req.json();

    if (!candidateId) {
      return badRequest("candidateId is required");
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, phone")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return errorResponse(404, "CANDIDATE_NOT_FOUND", "Candidate not found");
    }

    const checkrApiKey = getRequiredEnv("CHECKR_API_KEY");

    const checkrCandidateResponse = await fetch("https://api.checkr.com/v1/candidates", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${checkrApiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        phone: candidate.phone || "",
        work_locations: [],
      }),
    });

    const checkrCandidate = await checkrCandidateResponse.json();

    if (!checkrCandidateResponse.ok) {
      await supabase.from("integration_events").insert({
        provider: "checkr",
        event_type: "api_call_failed",
        external_id: null,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: checkrCandidate },
        attempts: 1,
        last_error: checkrCandidate.error || "Unknown Checkr API error",
      });

      return internalError(`Checkr API error: ${checkrCandidate.error || "Unknown"}`);
    }

    const checkrCandidateId = checkrCandidate.id;

    const reportResponse = await fetch("https://api.checkr.com/v1/reports", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${checkrApiKey}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidate_id: checkrCandidateId,
        package: "driver_pro", // Default package for staffing platform
      }),
    });

    const report = await reportResponse.json();

    if (!reportResponse.ok) {
      await supabase.from("integration_events").insert({
        provider: "checkr",
        event_type: "api_call_failed",
        external_id: checkrCandidateId,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: report },
        attempts: 1,
        last_error: report.error || "Failed to create Checkr report",
      });

      return internalError(`Checkr report error: ${report.error || "Unknown"}`);
    }

    await supabase.from("integration_events").insert({
      provider: "checkr",
      event_type: "background_check_invited",
      external_id: checkrCandidateId,
      object_type: "candidate",
      object_id: candidateId,
      status: "pending",
      payload: { candidate: checkrCandidate, report },
      attempts: 1,
    });

    await supabase
      .from("candidates")
      .update({
        background_check_status: "pending",
        background_check_id: checkrCandidateId,
      })
      .eq("id", candidateId);

    return new Response(
      JSON.stringify({
        success: true,
        checkr_candidate_id: checkrCandidateId,
        report_id: report.id,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Checkr invite-candidate error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
