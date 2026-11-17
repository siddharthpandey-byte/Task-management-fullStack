import { z } from "zod";
import { PROJECT_KEY_REGEX, PROJECT_LIMITS } from "../constants/project.constant";
import type { Person } from "../types/project.types";

// Same rules as backend validators/project.validator.ts; the backend remains the authority.
const name = z
  .string()
  .trim()
  .min(1, "Project name is required")
  .min(
    PROJECT_LIMITS.NAME_MIN,
    `Project name must be at least ${PROJECT_LIMITS.NAME_MIN} characters`
  )
  .max(
    PROJECT_LIMITS.NAME_MAX,
    `Project name must be at most ${PROJECT_LIMITS.NAME_MAX} characters`
  );

const key = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Project key is required")
  .regex(
    PROJECT_KEY_REGEX,
    "Key must be 2–10 characters: letters and numbers, starting with a letter"
  );

const description = z
  .string()
  .trim()
  .max(
    PROJECT_LIMITS.DESCRIPTION_MAX,
    `Description must be at most ${PROJECT_LIMITS.DESCRIPTION_MAX} characters`
  );

// pickers hold full people so chips can render; only ids are sent to the API
const person = z.custom<Person>(
  (value) => !!value && typeof value === "object" && typeof (value as Person).id === "string"
);

// Boolean(): a `!== null` arrow would be inferred as a type guard and narrow the output type
const lead = person.nullable().refine((value) => Boolean(value), "Choose a project lead");

const members = z
  .array(person)
  .max(
    PROJECT_LIMITS.MEMBERS_MAX,
    `A project can have at most ${PROJECT_LIMITS.MEMBERS_MAX} members`
  );

export const createProjectSchema = z.object({ name, key, description, lead, members });
export const projectDetailsSchema = z.object({ name, description, lead, members });

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>;
export type ProjectDetailsFormValues = z.infer<typeof projectDetailsSchema>;
