import { z } from "zod";
import {
  AuthorizationError,
  ConflictError,
  InvalidSuccessorError,
  NotAMemberError,
  NotFoundError,
  SoleOwnerCannotLeaveError,
} from "@/lib/memberships";
import { SlugConflictError } from "@/lib/groups";
import { ImageTooLargeError, InvalidImageError } from "@/lib/avatars";

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
  if (err instanceof NotAMemberError) {
    return Response.json({ error: "NotAMember", message: err.message }, { status: 404 });
  }
  if (err instanceof SoleOwnerCannotLeaveError) {
    return Response.json({ error: "SoleOwner", message: err.message }, { status: 409 });
  }
  if (err instanceof InvalidSuccessorError) {
    return Response.json({ error: "InvalidSuccessor", message: err.message }, { status: 422 });
  }
  if (err instanceof InvalidImageError) {
    return Response.json({ error: "InvalidImage", message: err.message }, { status: 400 });
  }
  if (err instanceof ImageTooLargeError) {
    return Response.json({ error: "ImageTooLarge", message: err.message }, { status: 413 });
  }
  if (err instanceof z.ZodError) {
    return validationFailed(err);
  }
  // Unknown — surface a generic 500. The error is intentionally not echoed back.
  console.error("Unhandled error in route handler:", err);
  return Response.json({ error: "InternalServerError" }, { status: 500 });
}
