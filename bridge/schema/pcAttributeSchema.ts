import { z } from "zod";
import {
  attributeModifierKeySchema,
  calculatedAttributesSchema,
} from "./attributeSchema.ts";
import { intSchema, nonnegativeIntSchema } from "./numberSchema.ts";

export const calculatedPcAttributesSchema = calculatedAttributesSchema.extend({
  luckPointsMaximum: intSchema,
  luckyNumberCount: nonnegativeIntSchema,
  unluckyNumberCount: nonnegativeIntSchema,
});

export const pcAttributeModifierKeySchema = z.enum([
  ...attributeModifierKeySchema.options,
  "luckPointsMaximum",
]);

export const pcAttributeModifierTotalsSchema = z.partialRecord(
  pcAttributeModifierKeySchema,
  intSchema,
);

export type CalculatedPcAttributes = z.infer<
  typeof calculatedPcAttributesSchema
>;
export type PcAttributeModifierKey = z.infer<
  typeof pcAttributeModifierKeySchema
>;
export type PcAttributeModifierTotals = z.infer<
  typeof pcAttributeModifierTotalsSchema
>;
