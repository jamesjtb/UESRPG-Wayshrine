import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_SCHEMA_VERSION,
  parseContentDefinition,
  validateRaceContent,
} from "@wayshrine/core";
import type {
  ContentDefinitions,
  ContentKind,
  ContentSummary,
  ContentVersion,
} from "@wayshrine/core";
import { isMap, parseDocument } from "yaml";
import {
  CONTENT_ARTIFACT_FORMAT,
  contentKinds,
  definitionFilename,
} from "../src/lib/content/artifacts";

const directories = { race: "races", skill: "skills", trait: "traits" };

/** Sort object keys before JSON.stringify; preserve meaningful array ordering. */
function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value === null || typeof value !== "object") return value;

  const object = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(object).sort()) {
    sorted[key] = sortObjectKeys(object[key]);
  }
  return sorted;
}

function toJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value), null, 2) + "\n";
}

function prepareDefinition<K extends ContentKind>(
  kind: K,
  key: string,
  authored: unknown,
): ContentDefinitions[K] {
  if (
    authored === null ||
    typeof authored !== "object" ||
    Array.isArray(authored)
  ) {
    throw new Error(`Expected a definition map for ${kind} ${key}.`);
  }

  let definition = authored;
  if (kind === "skill" && !Object.hasOwn(authored, "skillKey")) {
    definition = { ...authored, skillKey: key };
  }
  return parseContentDefinition(kind, key, definition);
}

async function readDefinitionFile<K extends ContentKind>(
  path: string,
  kind: K,
  definitions: Map<string, ContentDefinitions[K]>,
) {
  const document = parseDocument(await readFile(path, "utf8"), {
    uniqueKeys: true,
    stringKeys: true,
  });
  if (document.errors.length) throw document.errors[0];
  if (!isMap(document.contents)) throw new Error("Expected a top-level map.");

  for (const [key, authored] of Object.entries(document.toJS())) {
    if (definitions.has(key)) throw new Error(`Duplicate ${kind} key: ${key}.`);
    definitions.set(key, prepareDefinition(kind, key, authored));
  }
}

async function readDefinitions<K extends ContentKind>(root: string, kind: K) {
  const definitions = new Map<string, ContentDefinitions[K]>();
  const directory = join(root, directories[kind]);
  const files = (await readdir(directory))
    .filter((file) => /\.ya?ml$/.test(file))
    .sort();

  for (const file of files) {
    const path = join(directory, file);
    try {
      await readDefinitionFile(path, kind, definitions);
    } catch (cause) {
      throw new Error(`Invalid content in ${path}.`, { cause });
    }
  }

  const ordered = [...definitions].sort(([left], [right]) =>
    left < right ? -1 : 1,
  );
  return new Map(ordered);
}

function addKindArtifacts<K extends ContentKind>(
  files: Map<string, string>,
  version: ContentVersion,
  kind: K,
  definitions: ReadonlyMap<string, ContentDefinitions[K]>,
) {
  const directory = `${version.revision}/${kind}`;
  const entries: ContentSummary[] = [];
  for (const [key, definition] of definitions) {
    entries.push({ key, label: definition.label ?? key });
    const path = `${directory}/definitions/${definitionFilename(key)}`;
    files.set(path, toJson({ version, kind, key, definition }));
  }
  files.set(`${directory}/index.json`, toJson({ version, kind, entries }));
}

/** outputDirectory is entirely generated and is replaced after validation. */
export async function generateContent(
  sourceDirectory: string,
  outputDirectory: string,
) {
  const content = {
    race: await readDefinitions(sourceDirectory, "race"),
    skill: await readDefinitions(sourceDirectory, "skill"),
    trait: await readDefinitions(sourceDirectory, "trait"),
  };

  const skillKeys = new Set(content.skill.keys());
  for (const [key, race] of content.race) {
    const issues = validateRaceContent(race, skillKeys, content.trait);
    if (issues.length)
      throw new Error(`Invalid race ${key}: ${JSON.stringify(issues)}`);
  }

  const revisionInput = {
    artifactFormat: CONTENT_ARTIFACT_FORMAT,
    schemaVersion: CONTENT_SCHEMA_VERSION,
    race: [...content.race],
    skill: [...content.skill],
    trait: [...content.trait],
  };
  const revision = createHash("sha256")
    .update(toJson(revisionInput))
    .digest("hex");
  const version = { schemaVersion: CONTENT_SCHEMA_VERSION, revision };

  const files = new Map<string, string>();
  files.set("manifest.json", toJson(version));
  for (const kind of contentKinds) {
    addKindArtifacts(files, version, kind, content[kind]);
  }

  // Prepare everything above before removing any previous generated output.
  await rm(outputDirectory, { recursive: true, force: true });
  for (const [relativePath, contents] of files) {
    const path = join(outputDirectory, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  return version;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await generateContent(
    fileURLToPath(new URL("../../core/content/", import.meta.url)),
    fileURLToPath(new URL("../public/content/", import.meta.url)),
  );
}
