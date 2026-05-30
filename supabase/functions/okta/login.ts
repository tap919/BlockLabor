import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";
import { getOptionalEnv } from "../shared/auth.ts";

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/authorize")) {
      const oktaDomain = getRequiredEnv("OKTA_DOMAIN");
      const clientId = getRequiredEnv("OKTA_CLIENT_ID");
      const redirectUri = getRequiredEnv("OKTA_REDIRECT_URI");

      const authUrl = new URL(`https://${oktaDomain}/oauth2/default/v1/authorize`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid profile email groups");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", crypto.randomUUID());

      return Response.redirect(authUrl.toString(), 302);
    }

    if (req.method === "GET" && url.pathname.endsWith("/callback")) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (!code) {
        return badRequest("Authorization code is required");
      }

      const oktaDomain = getRequiredEnv("OKTA_DOMAIN");
      const clientId = getRequiredEnv("OKTA_CLIENT_ID");
      const clientSecret = getRequiredEnv("OKTA_CLIENT_SECRET");
      const redirectUri = getRequiredEnv("OKTA_REDIRECT_URI");

      const tokenResponse = await fetch(
        `https://${oktaDomain}/oauth2/default/v1/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }).toString(),
        },
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        return errorResponse(401, "TOKEN_EXCHANGE_FAILED", "Failed to exchange authorization code");
      }

      const idToken = tokenData.id_token;
      const parts = idToken.split(".");
      const claims = JSON.parse(atob(parts[1]));

      const email = claims.email;
      const name = claims.name || claims.preferred_username || email;
      const oktaGroups: string[] = claims.groups || [];

      const supabaseUrl = getRequiredEnv("SUPABASE_URL");
      const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: ssoConfig } = await supabase
        .from("sso_config")
        .select("role_mapping")
        .eq("provider", "okta")
        .maybeSingle();

      let mappedRole = "worker";
      const roleMapping = ssoConfig?.role_mapping as Record<string, string> | undefined;

      if (roleMapping) {
        for (const group of oktaGroups) {
          if (roleMapping[group]) {
            mappedRole = roleMapping[group];
            break;
          }
        }
      } else {
        if (oktaGroups.includes("Admin")) mappedRole = "owner";
        else if (oktaGroups.includes("Recruiter")) mappedRole = "recruiter";
        else if (oktaGroups.includes("Scheduler")) mappedRole = "scheduler";
        else if (oktaGroups.includes("Payroll")) mappedRole = "payroll";
      }

      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (!existingUser) {
        await supabase.from("users").insert({
          email,
          name,
          role: mappedRole,
          is_active: true,
        });
      } else {
        await supabase
          .from("users")
          .update({ name, role: mappedRole })
          .eq("id", existingUser.id);
      }

      const frontendUrl = getOptionalEnv("FRONTEND_URL", "http://localhost:3000");
      const redirectTarget = new URL("/auth/callback", frontendUrl);
      redirectTarget.searchParams.set("access_token", tokenData.access_token);
      redirectTarget.searchParams.set("id_token", idToken);
      redirectTarget.searchParams.set("expires_in", String(tokenData.expires_in || 3600));

      return Response.redirect(redirectTarget.toString(), 302);
    }

    if (req.method === "GET" && url.pathname.endsWith("/logout")) {
      const oktaDomain = getRequiredEnv("OKTA_DOMAIN");
      const clientId = getRequiredEnv("OKTA_CLIENT_ID");
      const frontendUrl = getOptionalEnv("FRONTEND_URL", "http://localhost:3000");

      const logoutUrl = new URL(`https://${oktaDomain}/oauth2/default/v1/logout`);
      logoutUrl.searchParams.set("id_token_hint", url.searchParams.get("id_token_hint") || "");
      logoutUrl.searchParams.set("post_logout_redirect_uri", frontendUrl);

      return Response.redirect(logoutUrl.toString(), 302);
    }

    return badRequest("Not found");
  } catch (err) {
    console.error("Okta login error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
