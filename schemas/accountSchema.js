import { z } from "zod";

// accounts.id is a bigint identity; keep it as a digit string so it never loses precision.
const idParam = z.string().regex(/^[1-9]\d*$/, "must be a positive integer id");

const accountParamsSchema = z.object({
  params: z.object({ id: idParam }),
});

// Customers can only open wallets; system accounts are created by migrations/seed.
const createAccountSchema = z.object({
  body: z.object({
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "must be an ISO 4217 code like EGP"),
  }),
});

// Keyset pagination: cursor is the last entry id seen; next page is id < cursor.
const statementQuerySchema = z.object({
  params: z.object({ id: idParam }),
  query: z.object({
    cursor: idParam.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }),
});

export { accountParamsSchema, createAccountSchema, statementQuerySchema };
