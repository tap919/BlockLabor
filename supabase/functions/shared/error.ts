export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorEnvelope = {
    success: false,
    error: { code, message, details },
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function badRequest(message: string, details?: unknown): Response {
  return errorResponse(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message: string = "Unauthorized"): Response {
  return errorResponse(401, "UNAUTHORIZED", message);
}

export function notFound(message: string = "Not found"): Response {
  return errorResponse(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown): Response {
  return errorResponse(409, "CONFLICT", message, details);
}

export function internalError(message: string = "Internal server error"): Response {
  return errorResponse(500, "INTERNAL_ERROR", message);
}
