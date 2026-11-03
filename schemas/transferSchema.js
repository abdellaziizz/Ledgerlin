import { z } from "zod";

const accountId = z.number().int().positive();

// Money is integer minor units (piastres, cents); floats are rejected.
const transferSchema = z.object({
  body: z
    .object({
      from_account_id: accountId,
      to_account_id: accountId,
      amount_minor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "must be an ISO 4217 code like EGP"),
      description: z.string().trim().max(500).optional(),
    })
    .refine((b) => b.from_account_id !== b.to_account_id, {
      message: "cannot transfer to the same account",
      path: ["to_account_id"],
    }),
});

export { transferSchema };
