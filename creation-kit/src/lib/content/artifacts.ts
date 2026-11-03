import {
  CONTENT_SCHEMA_VERSION,
  contentIndexSchema,
  contentVersionSchema,
} from "@wayshrine/core";
import { z } from "zod";

// Bump when the transport layout or encoding changes, even if Core does not.
export const CONTENT_ARTIFACT_FORMAT = 1;
export const contentKinds = ["race", "skill", "trait"] as const;
const kindSchema = z.enum(contentKinds);

export const manifestSchema = contentVersionSchema.extend({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
});

export const indexArtifactSchema = z.strictObject({
  version: manifestSchema,
  kind: kindSchema,
  entries: contentIndexSchema,
});

// Transport only: readers validate the payload with Core's parseContentDefinition.
export const definitionArtifactSchema = z.strictObject({
  version: manifestSchema,
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
