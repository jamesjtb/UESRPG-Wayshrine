import { z } from "zod";
import { intSchema } from "./numberSchema.ts";

// Current pools may be negative; no maximum is enforced here.
export const currentResourcesSchema = z.strictObject({
  healthPoints: intSchema,
  staminaPoints: intSchema,
  magickaPoints: intSchema,
  actionPoints: intSchema,
});

export type CurrentResources = z.infer<typeof currentResourcesSchema>;
