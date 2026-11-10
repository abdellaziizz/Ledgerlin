import { z } from "zod";
import { idParam } from "./accountSchema.js";

const reconcileSchema = z.object({
  body: z
    .object({ account_id: z.union([idParam, z.number().int().positive().transform(String)]).optional() })
    .optional()
    .default({}),
});

export { reconcileSchema };
