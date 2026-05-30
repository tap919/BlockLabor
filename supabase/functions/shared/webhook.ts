export async function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256",
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(secret);
  const msgBytes = encoder.encode(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: algorithm === "sha256" ? "SHA-256" : "SHA-1" },
    false,
    ["sign"],
  );

  const expected = await crypto.subtle.sign("HMAC", key, msgBytes);

  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex.length !== signature.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }

  return diff === 0;
}

export async function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  const signatureInput = url + sortedKeys.map((k) => `${k}${params[k]}`).join("");

  return await verifyHmacSignature(signatureInput, signature, authToken, "sha1");
}
