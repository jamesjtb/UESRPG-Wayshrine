import { z } from "zod";
import type {
  AuthoredDefinitions,
  AuthoredDomain,
} from "../../interface/common/AuthoredContent";
import {
  birthsignSchema,
  powerSchema,
  raceSchema,
  skillSchema,
  traitSchema,
} from "../content/schemas";

export const domains = [
  "races",
  "traits",
  "skills",
  "birthsigns",
  "powers",
] as const;
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
export const birthsignLocaleEntrySchema = localeEntrySchema.extend({
  starCursed: z
    .strictObject({ description: text.exactOptional() })
    .exactOptional(),
  choices: z
    .record(keySchema, z.strictObject({ prompt: text.exactOptional() }))
    .exactOptional(),
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
  powers: powerSchema.extend({ label: text, description: text }),
};
