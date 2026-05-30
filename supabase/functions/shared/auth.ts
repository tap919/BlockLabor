import { createClient } from "npm:@supabase/supabase-js@2";

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getOptionalEnv(name: string, fallback: string = ""): string {
  return Deno.env.get(name) ?? fallback;
}

export async function getSecretFromVault(
  supabaseClient: ReturnType<typeof createClient>,
  secretName: string,
): Promise<string | null> {
  const { data, error } = await supabaseClient
    .from("vault")
    .select("decrypted_secret")
    .eq("name", secretName)
    .maybeSingle();

  if (error || !data) {
    console.error(`Vault lookup failed for "${secretName}":`, error?.message);
    return null;
  }

  return data.decrypted_secret as string;
}

export async function getIntegrationSecret(
  supabaseClient: ReturnType<typeof createClient>,
  envName: string,
  vaultName?: string,
): Promise<string> {
  const fromEnv = getOptionalEnv(envName);
  if (fromEnv) {
    return fromEnv;
  }

  if (vaultName) {
    const fromVault = await getSecretFromVault(supabaseClient, vaultName);
    if (fromVault) {
      return fromVault;
    }
  }

  throw new Error(
    `Secret "${envName}" not found in environment or vault${vaultName ? ` ("${vaultName}")` : ""}`,
  );
}
