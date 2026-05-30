import { createClient } from "npm:@supabase/supabase-js@2";

interface IdempotencyCheck {
  exists: boolean;
  status?: string;
  error?: string;
}

export async function checkIdempotency(
  supabaseClient: ReturnType<typeof createClient>,
  provider: string,
  externalId: string,
): Promise<IdempotencyCheck> {
  const { data, error } = await supabaseClient
    .from("integration_events")
    .select("status, last_error")
    .eq("provider", provider)
    .eq("external_id", externalId)
    .maybeSingle();

  if (error) {
    return { exists: false, error: error.message };
  }

  if (data) {
    return { exists: true, status: data.status };
  }

  return { exists: false };
}

export async function markProcessed(
  supabaseClient: ReturnType<typeof createClient>,
  provider: string,
  eventType: string,
  externalId: string,
  objectType: string | null,
  objectId: string | null,
  payload: unknown,
  status: string = "processed",
): Promise<string | null> {
  const { error } = await supabaseClient
    .from("integration_events")
    .insert({
      provider,
      event_type: eventType,
      external_id: externalId,
      object_type: objectType,
      object_id: objectId,
      status,
      payload: payload as Record<string, unknown>,
    });

  if (error) {
    console.error("Failed to log integration event:", error.message);
    return error.message;
  }

  return null;
}
