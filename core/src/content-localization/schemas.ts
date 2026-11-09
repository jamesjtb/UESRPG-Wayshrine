import { z } from "zod";
import type {
  AuthoredDefinitions,
  AuthoredDomain,
} from "../../interface/common/AuthoredContent";
import { PcCharacteristic } from "../enum/Characteristic";
import { raceSchema, skillSchema, traitSchema } from "../content/schemas";

export const domains = ["races", "traits", "skills", "birthsigns"] as const;
export const fields = ["label", "description"] as const;
export const keySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_-]*$/);
const text = z
  .string()
  .refine((value) => value.trim().length > 0, "Expected nonempty text.");
export const mapSchema = z.record(keySchema, z.unknown());
export const localeEntrySchema = z.strictObject({
  label: text.exactOptional(),
  description: text.exactOptional(),
});
export const inputSchema = z.strictObject({
  content: z.array(
    z.strictObject({
      domain: z.enum(domains),
      source: text,
      data: z.unknown(),
    }),
  ),
  locales: z.array(
    z.strictObject({
      domain: z.enum(domains),
      source: text,
      data: z.unknown(),
      language: text,
    }),
  ),
  language: text,
  allowEnglishFallback: z.boolean().exactOptional(),
});

const characteristic = z.enum(PcCharacteristic);
const effectSchema = z.discriminatedUnion("bonusType", [
  z.strictObject({
    bonusType: z.literal("characteristic"),
    bonusTargetKey: characteristic,
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("attribute"),
    bonusTargetKey: z.enum(["spMaximum", "speed"]),
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("multiplier"),
    bonusTargetKey: z.literal("naturalHealing"),
    bonusValue: z.number(),
  }),
  z.strictObject({
    bonusType: z.literal("trait"),
    bonusTargetKey: keySchema,
    bonusParams: z
      .record(keySchema, z.union([z.string(), z.number()]))
      .exactOptional(),
  }),
  z.strictObject({ bonusType: z.literal("power"), bonusTargetKey: keySchema }),
  z.strictObject({
    bonusType: z.literal("extraLuckyNumber"),
    count: z.number(),
    retainedRegardlessOfLuck: z.literal(true),
  }),
  z.strictObject({
    bonusType: z.literal("replaceRolledCharacteristic"),
    bonusTargetKey: characteristic,
    bonusValue: z.number(),
  }),
]);
const choiceSchema = z.strictObject({
  bonusType: z.literal("choice"),
  choiceGroup: z.strictObject({
    id: keySchema,
    choose: z.number(),
    options: z.array(
      z.strictObject({ id: keySchema, effects: z.array(effectSchema) }),
    ),
  }),
  lifecycle: z.union([
    z.strictObject({ selection: z.literal("once") }),
    z.strictObject({
      selection: z.literal("recurring"),
      chooseAt: z.literal("longRest"),
      expiresAt: z.literal("nextLongRest"),
    }),
  ]),
});
const bonuses = z.array(z.union([effectSchema, choiceSchema]));
const birthsignSchema = z.strictObject({
  label: text,
  description: text,
  bonuses,
  starCursed: z.strictObject({
    overwriteBaseBonuses: z.boolean(),
    bonuses,
    eligibility: z
      .strictObject({
        requiresNaturallyRolledSign: z.literal(true),
        canSelectBySpendingLuck: z.literal(false),
      })
      .exactOptional(),
  }),
});
const skillDisplay = {
  skillKey: keySchema.exactOptional(),
  label: text,
  description: text,
};
export const definitionSchemas: {
  [D in AuthoredDomain]: z.ZodType<AuthoredDefinitions[D]>;
} = {
  races: raceSchema.extend({ label: text, description: text }),
  traits: traitSchema.extend({
    label: text,
    description: text,
    params: z
      .array(keySchema)
      .refine((values) => new Set(values).size === values.length)
      .exactOptional(),
  }),
  skills: z.union([
    skillSchema.options[0].extend(skillDisplay),
    skillSchema.options[1].extend(skillDisplay),
  ]),
  birthsigns: birthsignSchema,
};
