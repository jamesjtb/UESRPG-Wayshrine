import { z } from "zod";
import { intSchema, nonnegativeIntSchema } from "./numberSchema.ts";

export const baseCharacteristicKeySchema = z.enum([
  "strength",
  "endurance",
  "agility",
  "intelligence",
  "willpower",
  "perception",
  "personality",
]);

export const characteristicScoreSchema = nonnegativeIntSchema;

export const baseCharacteristicScoresSchema = z.strictObject({
  strength: characteristicScoreSchema,
  endurance: characteristicScoreSchema,
  agility: characteristicScoreSchema,
  intelligence: characteristicScoreSchema,
  willpower: characteristicScoreSchema,
  perception: characteristicScoreSchema,
  personality: characteristicScoreSchema,
});

// Relationships between these values are enforced by calculation functions.
export const calculatedCharacteristicSchema = z.strictObject({
  base: characteristicScoreSchema,
  effective: characteristicScoreSchema,
  bonus: nonnegativeIntSchema,
});

export const calculatedBaseCharacteristicsSchema = z.record(
  baseCharacteristicKeySchema,
  calculatedCharacteristicSchema,
);

// Totals only; individual modifier sources are outside this model.
// Missing entries represent zero.
export const baseCharacteristicModifierTotalsSchema = z.partialRecord(
  baseCharacteristicKeySchema,
  intSchema,
);

export type BaseCharacteristicKey = z.infer<typeof baseCharacteristicKeySchema>;
export type BaseCharacteristicScores = z.infer<
  typeof baseCharacteristicScoresSchema
>;
export type CalculatedCharacteristic = z.infer<
  typeof calculatedCharacteristicSchema
>;
export type CalculatedBaseCharacteristics = z.infer<
  typeof calculatedBaseCharacteristicsSchema
>;
export type BaseCharacteristicModifierTotals = z.infer<
  typeof baseCharacteristicModifierTotalsSchema
>;
