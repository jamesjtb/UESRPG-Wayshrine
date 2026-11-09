import {
  CONTENT_SCHEMA_VERSION,
  contentIndexSchema,
  contentVersionSchema,
} from "@wayshrine/core";
import { z } from "zod";

// Bump when the transport layout or encoding changes, even if Core does not.
export const CONTENT_ARTIFACT_FORMAT = 2;
export const contentKinds = ["race", "skill", "trait"] as const;
const kindSchema = z.enum(contentKinds);

const versionSchema = contentVersionSchema.extend({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
});

export const languageSchema = z.string().refine((language) => {
  try {
    return Intl.getCanonicalLocales(language)[0] === language;
  } catch {
    return false;
  }
}, "Expected an exact canonical BCP 47 language tag.");

export const localizationSchema = z.strictObject({
  language: languageSchema,
  sourceRevision: z.string().regex(/^[a-f0-9]{64}$/),
  allowEnglishFallback: z.boolean(),
});

const identity = {
  artifactFormat: z.literal(CONTENT_ARTIFACT_FORMAT),
  version: versionSchema,
  localization: localizationSchema,
};

export const manifestSchema = z.strictObject(identity);

export const indexArtifactSchema = z.strictObject({
  ...identity,
  kind: kindSchema,
  entries: contentIndexSchema,
});

// Transport only: readers validate the payload with Core's parseContentDefinition.
export const definitionArtifactSchema = z.strictObject({
  ...identity,
  kind: kindSchema,
  key: z.string().min(1),
  definition: z.unknown(),
});

export type ContentManifest = z.infer<typeof manifestSchema>;
export type ContentIndexArtifact = z.infer<typeof indexArtifactSchema>;
export type ContentDefinitionArtifact = z.infer<
  typeof definitionArtifactSchema
>;

/** A disk filename. URL-encode this filename when constructing an HTTP path. */
export function definitionFilename(key: string): string {
  // Escape dots (URL normalization) and remaining URI punctuation (portable files).
  const encodedKey = encodeURIComponent(key);
  const filename = encodedKey.replace(/[.!'()*]/g, (character) => {
    const hex = character.charCodeAt(0).toString(16).toUpperCase();
    return `%${hex}`;
  });
  return `${filename}.json`;
}
