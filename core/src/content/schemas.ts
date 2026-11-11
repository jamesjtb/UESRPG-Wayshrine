import { z } from "zod";
import type {
  ContentDefinitions,
  ContentKind,
} from "../../interface/common/ContentCatalog";
import { Characteristic } from "../enum/Characteristic";
import { ContentError } from "./ContentError";
import { birthsignSchema } from "./birthsignSchema";
export {
  birthsignSchema,
  birthsignChoiceSchema,
  birthsignEffectSchema,
} from "./birthsignSchema";

export const CONTENT_SCHEMA_VERSION = 2;

const keySchema = z.string().min(1);
const characteristicSchema = z.enum(Characteristic);
const parameterValuesSchema = z.record(
  keySchema,
  z.union([z.string(), z.number()]),
);

export const traitSchema = z.strictObject({
  label: z.string(),
  description: z.string(),
  params: z
    .array(keySchema)
    .refine(
      (params) => new Set(params).size === params.length,
      "Trait parameter names must be distinct.",
    )
    .exactOptional(),
});

export const powerSchema = z.strictObject({
  label: z.string().min(1),
  description: z.string().min(1),
});

const skillFields = {
  skillKey: keySchema,
  label: z.string().exactOptional(),
  description: z.string().exactOptional(),
  hasCustomName: z.boolean().exactOptional(),
};

export const skillSchema = z.union([
  z.strictObject({
    ...skillFields,
    governingCharacteristics: z
      .array(characteristicSchema)
      .min(1)
      .refine(
        (keys) => new Set(keys).size === keys.length,
        "Governing characteristics must be distinct.",
      ),
    chooseGoverningCharacteristic: z.literal(false).exactOptional(),
  }),
  z.strictObject({
    ...skillFields,
    chooseGoverningCharacteristic: z.literal(true),
  }),
]);

export const raceSchema = z.strictObject({
  label: z.string(),
  description: z.string(),
  baselineCharacteristics: z.record(characteristicSchema, z.number()),
  racialTraits: z.array(
    z.strictObject({
      traitKey: keySchema,
      params: parameterValuesSchema.exactOptional(),
      origin: z.enum(["race", "purchased"]).exactOptional(),
    }),
  ),
  racialBonuses: z
    .array(
      z.strictObject({
        bonusType: z.literal("skill"),
        choiceGroups: z.array(
          z.strictObject({
            id: keySchema,
            choose: z.number(),
            options: z.array(keySchema),
          }),
        ),
      }),
    )
    .exactOptional(),
});

export const contentIndexSchema = z
  .array(
    z.strictObject({
      key: keySchema,
      label: z.string(),
    }),
  )
  .refine(
    (entries) =>
      new Set(entries.map((entry) => entry.key)).size === entries.length,
    "Content index keys must be distinct.",
  );

export const contentVersionSchema = z.strictObject({
  schemaVersion: z.number().int().positive(),
  revision: keySchema,
});

const definitionSchemas: {
  [K in ContentKind]: z.ZodType<ContentDefinitions[K]>;
} = {
  race: raceSchema,
  skill: skillSchema,
  trait: traitSchema,
  birthsign: birthsignSchema,
  power: powerSchema,
};

/** Validate and detach a definition from transport/adapter-owned objects. */
export function parseContentDefinition<K extends ContentKind>(
  kind: K,
  key: string,
  value: unknown,
): ContentDefinitions[K] {
  const result = definitionSchemas[kind].safeParse(value);
  if (!keySchema.safeParse(key).success || !result.success) {
    throw new ContentError(
      "invalid-content",
      `Invalid ${kind} definition: ${key}.`,
      {
        cause: result.success ? undefined : result.error,
      },
    );
  }
  if (kind === "skill" && skillSchema.parse(result.data).skillKey !== key) {
    throw new ContentError(
      "invalid-content",
      `Skill key does not match ${key}.`,
    );
  }
  return result.data;
}
