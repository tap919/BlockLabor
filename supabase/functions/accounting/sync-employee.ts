import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv, getOptionalEnv } from "../shared/auth.ts";
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

    const quickbooksAccessToken = getRequiredEnv("QUICKBOOKS_ACCESS_TOKEN");
    const quickbooksRealmId = getRequiredEnv("QUICKBOOKS_REALM_ID");
    const companyId = getRequiredEnv("QUICKBOOKS_COMPANY_ID");

    let endpoint = "";
    let method = "POST";
    let body: Record<string, unknown> = {};

    if (action === "create") {
      endpoint = `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/employee`;
      body = {
        PrimaryAddr: {},
        PrimaryPhone: { FreeFormNumber: candidate.phone || "" },
        PrintOnCheckName: `${candidate.first_name} ${candidate.last_name}`,
        FamilyName: candidate.last_name,
        GivenName: candidate.first_name,
        BillableTime: false,
      };
    } else if (action === "update") {
      endpoint = `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/employee`;
      method = "POST";
      body = {
        Id: candidate.id,
        FamilyName: candidate.last_name,
        GivenName: candidate.first_name,
        PrimaryEmailAddr: { Address: candidate.email },
        sparse: true,
      };
    } else {
      return badRequest(`Unknown action: ${action}. Supported: create, update`);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${quickbooksAccessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      await supabase.from("integration_events").insert({
        provider: "quickbooks",
        event_type: `api_call_failed`,
        external_id: null,
        object_type: "candidate",
        object_id: candidateId,
        status: "failed",
        payload: { error: result },
        attempts: 1,
        last_error: result.Fault?.Error?.[0]?.Message || "QuickBooks API error",
      });

      return internalError(`QuickBooks error: ${result.Fault?.Error?.[0]?.Message || "Unknown"}`);
    }

    const qbEmployeeId = result.Employee?.Id || result.Id;

    await supabase.from("integration_events").insert({
      provider: "quickbooks",
      event_type: `employee_${action}d`,
      external_id: qbEmployeeId,
      object_type: "candidate",
      object_id: candidateId,
      status: "processed",
      payload: result,
      attempts: 1,
    });

    return new Response(JSON.stringify({ success: true, quickbooks_employee_id: qbEmployeeId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("QuickBooks sync error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
