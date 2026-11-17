import { isValidObjectId } from "mongoose";
import { z } from "zod";

export const objectId = (label: string) =>
  z
    .string({ error: `${label} is invalid` })
    .refine((value) => isValidObjectId(value), `${label} is invalid`);

export const pageSchema = z.coerce.number().int().min(1).default(1);
export const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
export const orderSchema = z.enum(["asc", "desc"]);

// "a,b" or ?x=a&x=b → ["a", "b"]; each value must be one of `values`
export const csvEnum = <T extends string>(values: readonly [T, ...T[]]) =>
  z.preprocess(
    (raw) => {
      const list = Array.isArray(raw) ? raw : [raw];
      return [
        ...new Set(
          list
            .flatMap((item) => String(item).split(","))
            .map((item) => item.trim())
            .filter(Boolean)
        ),
      ];
    },
    z.array(z.enum(values)).max(values.length)
  );
