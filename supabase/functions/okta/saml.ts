import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv } from "../shared/auth.ts";
import { errorResponse, badRequest, internalError } from "../shared/error.ts";
import { getOptionalEnv } from "../shared/auth.ts";

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/metadata")) {
      const oktaDomain = getRequiredEnv("OKTA_DOMAIN");
      const metadataUrl = `https://${oktaDomain}/app/saml/metadata`;

      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.text();

      return new Response(metadata, {
        headers: { "Content-Type": "application/xml" },
      });
    }

    if (req.method === "POST" && url.pathname.endsWith("/acs")) {
      const formData = await req.formData();
      const samlResponse = formData.get("SAMLResponse") as string | null;

      if (!samlResponse) {
        return badRequest("SAMLResponse is required");
      }

      const decoded = atob(samlResponse);
      const emailMatch = decoded.match(/<saml2:Attribute Name="Email"[^>]*>.*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/s);
      const nameMatch = decoded.match(/<saml2:Attribute Name="FirstName"[^>]*>.*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/s);
      const lastNameMatch = decoded.match(/<saml2:Attribute Name="LastName"[^>]*>.*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/s);
      const groupMatch = decoded.match(/<saml2:Attribute Name="groups"[^>]*>.*?<saml2:AttributeValue[^>]*>([^<]+)<\/saml2:AttributeValue>/s);

      const email = emailMatch?.[1] || "";
      const firstName = nameMatch?.[1] || "";
      const lastName = lastNameMatch?.[1] || "";
      const name = `${firstName} ${lastName}`.trim() || email;
      const group = groupMatch?.[1] || "";

      if (!email) {
        return badRequest("Email attribute not found in SAML assertion");
      }

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

      if (roleMapping && roleMapping[group]) {
        mappedRole = roleMapping[group];
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
      return Response.redirect(`${frontendUrl}/auth/callback?provider=saml`, 302);
    }

    return badRequest("Not found");
  } catch (err) {
    console.error("Okta SAML error:", err);
    return internalError(err instanceof Error ? err.message : "Unknown error");
  }
});
