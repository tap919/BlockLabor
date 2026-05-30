import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return badRequest("Method not allowed");
  }

  try {
    const { candidateId, action } = await req.json();

    if (!candidateId || !action) {
      return badRequest("candidateId and action are required");
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, phone")
      .eq("id", candidateId)
      .single();

    if (!candidate) {
      return errorResponse(404, "CANDIDATE_NOT_FOUND", "Candidate not found");
    }

    const gustoApiKey = getRequiredEnv("GUSTO_API_KEY");

    const response = await fetch("https://api.gusto.com/v1/employees", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gustoApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        first_name: candidate.first_name,
        last_name: candidate.last_name,
        email: candidate.email,
        phone: candidate.phone || "",
        start_date: new Date().toISOString().split("T")[0],
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      await supabase.from("integration_events").insert({
        provider: "gusto",
        event_type: "api_call_failed",
        external_id: null,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: result },
        attempts: 1,
        last_error: result.errors?.[0]?.message || "Gusto API error",
      });

      return internalError(`Gusto error: ${result.errors?.[0]?.message || "Unknown"}`);
    }

    const gustoEmployeeId = result.id;

    await supabase.from("integration_events").insert({
      provider: "gusto",
      event_type: "employee_created",
      external_id: gustoEmployeeId,
      object_type: "candidate",
      object_id: candidateId,
      status: "processed",
      payload: result,
      attempts: 1,
    });

    return new Response(JSON.stringify({ success: true, gusto_employee_id: gustoEmployeeId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Gusto sync error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
