import { HttpError, toHttpError } from "../../api/api.helper";

// API validates `leadId` / `memberIds`; the forms hold `lead` / `members` (full people).
const FIELD_ALIASES: Record<string, string> = { leadId: "lead", memberIds: "members" };

export function toFormError(error: unknown): HttpError {
  const httpError = toHttpError(error);
  return new HttpError(
    httpError.status,
    httpError.message,
    httpError.errors.map((e) => ({ ...e, field: FIELD_ALIASES[e.field] ?? e.field }))
  );
}

export const LEAD_ROLES = ["admin", "manager"] as const satisfies readonly ("admin" | "manager")[];
