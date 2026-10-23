import { z } from "zod";
import {
  baseCharacteristicKeySchema,
  baseCharacteristicScoresSchema,
  calculatedCharacteristicSchema,
  characteristicScoreSchema,
} from "./characteristicSchema.ts";
import { intSchema } from "./numberSchema.ts";

export const pcCharacteristicKeySchema = z.enum([
  ...baseCharacteristicKeySchema.options,
  "luck",
]);

export const pcCharacteristicScoresSchema =
  baseCharacteristicScoresSchema.extend({
    luck: characteristicScoreSchema,
  });

export const favoredCharacteristicsSchema = z
  .tuple([pcCharacteristicKeySchema, pcCharacteristicKeySchema])
  .refine(([first, second]) => first !== second, {
    message: "Favored characteristics must be distinct.",
  });

export const calculatedPcCharacteristicsSchema = z.record(
  pcCharacteristicKeySchema,
  calculatedCharacteristicSchema,
);

export const pcCharacteristicModifierTotalsSchema = z.partialRecord(
  pcCharacteristicKeySchema,
  intSchema,
);

export type PcCharacteristicKey = z.infer<typeof pcCharacteristicKeySchema>;
export type PcCharacteristicScores = z.infer<
  typeof pcCharacteristicScoresSchema
>;
export type FavoredCharacteristics = z.infer<
  typeof favoredCharacteristicsSchema
>;
export type CalculatedPcCharacteristics = z.infer<
  typeof calculatedPcCharacteristicsSchema
>;
export type PcCharacteristicModifierTotals = z.infer<
  typeof pcCharacteristicModifierTotalsSchema
>;
