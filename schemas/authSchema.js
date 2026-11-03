import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// bcrypt ignores everything after 72 bytes, so cap the length there.
const registerSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(8).max(72),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1).max(72),
  }),
});

export { registerSchema, loginSchema };
