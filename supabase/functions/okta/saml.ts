import { createClient } from "npm:@supabase/supabase-js@2";
import { getRequiredEnv, getOptionalEnv } from "../shared/auth.ts";
import { AppError } from "../shared/errors.ts";
import { logEvent } from "../shared/logger.ts";
import { fail } from "../shared/response.ts";

const supabaseUrl = getRequiredEnv("SUPABASE_URL");
const supabaseKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, supabaseKey);

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/metadata")) {
      await logEvent(supabase, requestId, {
        category: "system",
        type: "info",
        message: "Okta SAML metadata request",
      });

      const oktaDomain = getRequiredEnv("OKTA_DOMAIN");
      const metadataUrl = `https://${oktaDomain}/app/saml/metadata`;

      const metadataResponse = await fetch(metadataUrl);
      const metadata = await metadataResponse.text();

      return new Response(metadata, {
        headers: { "Content-Type": "application/xml" },
      });
    }

    if (req.method === "POST" && url.pathname.endsWith("/acs")) {
      await logEvent(supabase, requestId, {
        category: "system",
        type: "info",
        message: "Okta SAML ACS callback received",
      });

      const formData = await req.formData();
      const samlResponse = formData.get("SAMLResponse") as string | null;

      if (!samlResponse) {
        throw new AppError("BAD_REQUEST", "SAMLResponse is required", 400);
      }

      // Verify SAML response signature
      const samlConfig = await supabase
        .from("sso_config")
        .select("idp_certificate")
        .eq("provider", "okta")
        .maybeSingle();

      if (!samlConfig?.data?.idp_certificate) {
        throw new AppError('SAML_CONFIG_MISSING', 'IdP certificate not configured for SAML verification', 500, false);
      }

      // Decode the SAML response to get the signature
      const decodedSaml = atob(samlResponse);

      // Extract the SignedInfo element for verification
      const signedInfoMatch = decodedSaml.match(/<ds:SignedInfo>([\s\S]*?)<\/ds:SignedInfo>/);
      if (!signedInfoMatch) {
        throw new AppError('INVALID_SAML', 'No SignedInfo element found in SAML response', 400, false);
      }

      // Extract the signature value
      const signatureValueMatch = decodedSaml.match(/<ds:SignatureValue>([\s\S]*?)<\/ds:SignatureValue>/);
      if (!signatureValueMatch) {
        throw new AppError('INVALID_SAML', 'No SignatureValue found in SAML response', 400, false);
      }

      // Verify the signature against the IdP certificate
      const certPem = samlConfig.data.idp_certificate
        .replace(/-----BEGIN CERTIFICATE-----/, '')
        .replace(/-----END CERTIFICATE-----/, '')
        .replace(/\s/g, '');

      const certDer = Uint8Array.from(atob(certPem), c => c.charCodeAt(0));

      const cert = await crypto.subtle.importKey(
        'spki',
        certDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );

      const signedInfoDecoder = new TextEncoder();
      const sigValue = Uint8Array.from(atob(signatureValueMatch[1]), c => c.charCodeAt(0));

      const signatureValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cert,
        sigValue,
        signedInfoDecoder.encode(signedInfoMatch[1]),
      );

      if (!signatureValid) {
        throw new AppError('INVALID_SAML_SIGNATURE', 'SAML response signature verification failed', 401, false);
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
        throw new AppError("BAD_REQUEST", "Email attribute not found in SAML assertion", 400);
      }

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

    throw new AppError("BAD_REQUEST", "Not found", 404);
  } catch (err) {
    const appErr =
      err instanceof AppError
        ? err
        : new AppError("INTERNAL", err instanceof Error ? err.message : "Unknown error", 500);

    await logEvent(supabase, requestId, {
      category: "system",
      type: "error",
      message: `Okta SAML error: ${appErr.message}`,
      meta: { code: appErr.code },
    });

    return fail(appErr, requestId);
  }
});
