import { z } from "zod";
import { intSchema } from "./numberSchema.ts";
import { currentResourcesSchema } from "./resourceSchema.ts";

export const currentPcResourcesSchema = currentResourcesSchema.extend({
  luckPoints: intSchema,
});

export type CurrentPcResources = z.infer<typeof currentPcResourcesSchema>;
