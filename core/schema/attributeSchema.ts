import { z } from "zod";
import { intSchema } from "./numberSchema.ts";

export const calculatedAttributesSchema = z.strictObject({
  healthPointsMaximum: intSchema,
  staminaPointsMaximum: intSchema,
  magickaPointsMaximum: intSchema,
  actionPointsMaximum: z.literal(3),
  // Absent when the Alternate Wounds rule is enabled.
  woundThreshold: intSchema.optional(),
  linguistics: intSchema.min(0).max(4),
  initiativeRating: intSchema,
  speed: intSchema,
  carryRating: intSchema,
});

// AP maximum is fixed and cannot receive modifiers.
export const attributeModifierKeySchema = z.enum([
  "healthPointsMaximum",
  "staminaPointsMaximum",
  "magickaPointsMaximum",
  "woundThreshold",
  "linguistics",
  "initiativeRating",
  "speed",
  "carryRating",
]);

export const attributeModifierTotalsSchema = z.partialRecord(
  attributeModifierKeySchema,
  intSchema,
);

export type CalculatedAttributes = z.infer<typeof calculatedAttributesSchema>;
export type AttributeModifierKey = z.infer<typeof attributeModifierKeySchema>;
export type AttributeModifierTotals = z.infer<
  typeof attributeModifierTotalsSchema
>;
