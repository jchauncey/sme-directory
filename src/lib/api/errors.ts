import { z } from "zod";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/memberships";
import { SlugConflictError } from "@/lib/groups";

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function validationFailed(err: z.ZodError): Response {
  return Response.json(
    {
      error: "ValidationError",
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    },
    { status: 400 },
  );
}

export function errorToResponse(err: unknown): Response {
  if (err instanceof SlugConflictError) {
    return Response.json(
      { error: "SlugConflict", message: err.message, field: err.field },
      { status: 409 },
    );
  }
  if (err instanceof AuthorizationError) {
    return Response.json({ error: "Forbidden", message: err.message }, { status: 403 });
  }
  if (err instanceof NotFoundError) {
    return Response.json({ error: "NotFound", message: err.message }, { status: 404 });
  }
  if (err instanceof ConflictError) {
    return Response.json({ error: "Conflict", message: err.message }, { status: 409 });
  }
  if (err instanceof z.ZodError) {
    return validationFailed(err);
  }
  // Unknown — surface a generic 500. The error is intentionally not echoed back.
  console.error("Unhandled error in route handler:", err);
  return Response.json({ error: "InternalServerError" }, { status: 500 });
}
