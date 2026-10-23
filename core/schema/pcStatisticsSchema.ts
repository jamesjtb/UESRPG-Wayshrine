import { z } from "zod";
import { nonnegativeIntSchema } from "./numberSchema.ts";
import {
  favoredCharacteristicsSchema,
  pcCharacteristicScoresSchema,
} from "./pcCharacteristicSchema.ts";
import { currentPcResourcesSchema } from "./pcResourceSchema.ts";

// Stored statistics only; effective scores, bonuses, and attributes are derived.
// This is not a complete character schema.
export const pcStatisticsSchema = z.strictObject({
  characteristics: pcCharacteristicScoresSchema,
  favoredCharacteristics: favoredCharacteristicsSchema,
  currentResources: currentPcResourcesSchema,
  experiencePoints: nonnegativeIntSchema,
});

export type PcStatistics = z.infer<typeof pcStatisticsSchema>;
