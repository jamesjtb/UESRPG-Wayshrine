import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { compileContentLocalization } from "@wayshrine/core/content-localization";
import type {
  ContentSource,
  LocaleSource,
  LocalizationDiagnostic,
} from "@wayshrine/core/content-localization";
import {
  CONTENT_SCHEMA_VERSION,
  parseContentDefinition,
  validateRaceContent,
  validateBirthsignContent,
  validateBirthsignChargeTables,
} from "@wayshrine/core";
import type {
  ContentDefinitions,
  ContentKind,
  ContentSummary,
} from "@wayshrine/core";
import { isMap, parseDocument } from "yaml";
import {
  CONTENT_ARTIFACT_FORMAT,
  contentKinds,
  definitionFilename,
  languageSchema,
} from "../src/lib/content/artifacts";
import type { ContentManifest } from "../src/lib/content/artifacts";

const domains = ["races", "skills", "traits", "birthsigns", "powers"] as const;

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

async function readYaml(path: string): Promise<unknown> {
  const document = parseDocument(await readFile(path, "utf8"), {
    uniqueKeys: true,
    stringKeys: true,
  });
  if (document.errors.length)
    throw new Error(`${path}: ${document.errors[0]!.message}`);
  if (!isMap(document.contents))
    throw new Error(`${path}: Expected a top-level map.`);
  return document.toJS();
}

async function optionalDirectory(path: string): Promise<string[]> {
  try {
    return (await readdir(path)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function readSources(root: string): Promise<ContentSource[]> {
  const sources: ContentSource[] = [];
  for (const domain of domains) {
    sources.push(...(await readDomainSources(root, domain)));
  }
  return sources;
}

async function readDomainSources(
  root: string,
  domain: ContentSource["domain"],
): Promise<ContentSource[]> {
  const sources: ContentSource[] = [];
  const directory = join(root, domain);
  for (const file of await optionalDirectory(directory)) {
    if (!/\.ya?ml$/.test(file)) continue;
    const source = join(directory, file);
    sources.push({ domain, source, data: await readYaml(source) });
  }
  return sources;
}

async function readLocales(root: string): Promise<LocaleSource[]> {
  const sources: LocaleSource[] = [];
  for (const language of await optionalDirectory(root)) {
    // Check even empty language directories, before constructing output paths.
    if (!languageSchema.safeParse(language).success) {
      throw new Error(
        `${join(root, language)}: Expected an exact canonical BCP 47 language directory.`,
      );
    }
    const shards = await readSources(join(root, language));
    sources.push(...shards.map((shard) => ({ ...shard, language })));
  }
  return sources;
}

function hash(value: unknown): string {
  return createHash("sha256").update(toJson(value)).digest("hex");
}

function normalizedContent(sources: ContentSource[]) {
  const result: Record<string, Record<string, unknown>> = Object.create(null);
  for (const domain of domains) result[domain] = Object.create(null);
  for (const shard of sources) Object.assign(result[shard.domain]!, shard.data);
  return result;
}

/** The shared compiler marks every unconsumed leaf; do not reimplement resolution. */
function consumedTranslations(
  locales: LocaleSource[],
  diagnostics: LocalizationDiagnostic[],
) {
  const unused = new Set<string>();
  for (const item of diagnostics) {
    if (item.code === "unused-entry")
      unused.add(JSON.stringify([item.source, item.language, item.path]));
  }
  const consumed: Record<string, unknown> = Object.create(null);
  for (const shard of locales) {
    addConsumedShard(consumed, shard, unused);
  }
  return consumed;
}

function addConsumedShard(
  consumed: Record<string, unknown>,
  shard: LocaleSource,
  unused: Set<string>,
) {
  // Called only after the compiler validates all supplied locale leaves.
  const entries = shard.data as Record<string, Record<string, unknown>>;
  for (const [key, entry] of Object.entries(entries)) {
    addConsumedEntry(consumed, shard, key, entry, unused);
  }
}

function addConsumedEntry(
  consumed: Record<string, unknown>,
  shard: LocaleSource,
  key: string,
  entry: Record<string, unknown>,
  unused: Set<string>,
  path: string[] = [key],
) {
  for (const [field, text] of Object.entries(entry)) {
    const leafPath = [...path, field];
    if (typeof text !== "string") {
      addConsumedEntry(
        consumed,
        shard,
        key,
        text as Record<string, unknown>,
        unused,
        leafPath,
      );
      continue;
    }
    if (unused.has(JSON.stringify([shard.source, shard.language, leafPath])))
      continue;
    // Temporary status is determined entirely by the preserved text marker.
    consumed[`${shard.language}.${shard.domain}.${leafPath.join(".")}`] = text;
  }
}

function runtimeDefinitions<K extends ContentKind>(
  kind: K,
  authored: Record<string, unknown>,
) {
  const definitions = new Map<string, ContentDefinitions[K]>();
  for (const key of Object.keys(authored).sort()) {
    definitions.set(key, prepareDefinition(kind, key, authored[key]));
  }
  return definitions;
}

function addKindArtifacts<K extends ContentKind>(
  files: Map<string, string>,
  manifest: ContentManifest,
  kind: K,
  definitions: ReadonlyMap<string, ContentDefinitions[K]>,
) {
  const directory = `${manifest.localization.language}/${manifest.version.revision}/${kind}`;
  const entries: ContentSummary[] = [];
  for (const [key, definition] of definitions) {
    entries.push({ key, label: definition.label ?? key });
    const path = `${directory}/definitions/${definitionFilename(key)}`;
    files.set(path, toJson({ ...manifest, kind, key, definition }));
  }
  files.set(`${directory}/index.json`, toJson({ ...manifest, kind, entries }));
}

export interface GenerateContentOptions {
  localeDirectory?: string;
  languages?: readonly string[];
  allowEnglishFallback?: boolean;
  onDiagnostic?: (diagnostic: LocalizationDiagnostic) => void;
}

function diagnosticMessage(item: LocalizationDiagnostic): string {
  return `${item.source}:${item.path.join(".")} [${item.language}/${item.code}] ${item.message}`;
}

function prepareLanguage(
  sources: ContentSource[],
  locales: LocaleSource[],
  language: string,
  options: GenerateContentOptions,
  files: Map<string, string>,
): ContentManifest {
  const result = compileContentLocalization({
    content: sources,
    locales,
    language,
    allowEnglishFallback: options.allowEnglishFallback ?? false,
  });
  for (const diagnostic of result.diagnostics)
    options.onDiagnostic?.(diagnostic);
  if (!result.success) {
    const messages = result.diagnostics
      .filter((item) => item.severity === "error")
      .map(diagnosticMessage);
    throw new Error(`Content localization failed:\n${messages.join("\n")}`);
  }
  const content = {
    race: runtimeDefinitions("race", result.definitions.races),
    skill: runtimeDefinitions("skill", result.definitions.skills),
    trait: runtimeDefinitions("trait", result.definitions.traits),
    birthsign: runtimeDefinitions("birthsign", result.definitions.birthsigns),
    power: runtimeDefinitions("power", result.definitions.powers),
  };
  const skillKeys = new Set(content.skill.keys());
  for (const [key, race] of content.race) {
    const issues = validateRaceContent(race, skillKeys, content.trait);
    if (issues.length) {
      const source = sources.find(
        (shard) =>
          shard.domain === "races" && Object.hasOwn(shard.data as object, key),
      )!.source;
      throw new Error(
        `${source}:${key}: Invalid race: ${JSON.stringify(issues)}`,
      );
    }
  }
  const sourceRevision = hash(normalizedContent(sources));
  for (const [key, sign] of content.birthsign) {
    const issues = validateBirthsignContent(
      sign,
      content.trait,
      new Set(content.power.keys()),
    );
    if (issues.length)
      throw new Error(`Invalid birthsign ${key}: ${issues.join(" ")}`);
  }
  const tableIssues = validateBirthsignChargeTables(
    new Set(content.birthsign.keys()),
  );
  if (tableIssues.length) throw new Error(tableIssues.join(" "));
  const localization = { ...result.metadata, sourceRevision };
  const revision = hash({
    artifactFormat: CONTENT_ARTIFACT_FORMAT,
    schemaVersion: CONTENT_SCHEMA_VERSION,
    localization,
    definitions: result.definitions,
    consumedTranslations: consumedTranslations(locales, result.diagnostics),
  });
  const manifest: ContentManifest = {
    artifactFormat: CONTENT_ARTIFACT_FORMAT,
    version: { schemaVersion: CONTENT_SCHEMA_VERSION, revision },
    localization,
  };
  files.set(`${language}/manifest.json`, toJson(manifest));
  for (const kind of contentKinds)
    addKindArtifacts(files, manifest, kind, content[kind]);
  return manifest;
}

/** outputDirectory is entirely generated and is replaced after validation. */
export async function generateContent(
  sourceDirectory: string,
  outputDirectory: string,
  options: GenerateContentOptions = {},
) {
  await readdir(sourceDirectory); // A missing source root must not publish an empty catalog.
  const sources = await readSources(sourceDirectory);
  const locales = await readLocales(
    options.localeDirectory ?? join(sourceDirectory, "../locales"),
  );
  const languages = options.languages ?? ["en"];
  if (!languages.length || new Set(languages).size !== languages.length) {
    throw new Error("Select at least one language, without duplicates.");
  }
  const files = new Map<string, string>();
  const manifests: ContentManifest[] = [];
  for (const language of languages) {
    manifests.push(prepareLanguage(sources, locales, language, options, files));
  }

  // Prepare everything above before removing any previous generated output.
  await rm(outputDirectory, { recursive: true, force: true });
  for (const [relativePath, contents] of files) {
    const path = join(outputDirectory, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  return manifests;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { values } = parseArgs({
    options: {
      language: { type: "string", multiple: true },
      "allow-english-fallback": { type: "boolean", default: false },
    },
  });
  await generateContent(
    fileURLToPath(new URL("../../core/content/", import.meta.url)),
    fileURLToPath(new URL("../public/content/", import.meta.url)),
    {
      languages: values.language ?? ["en"],
      allowEnglishFallback: values["allow-english-fallback"],
      onDiagnostic: (diagnostic) => {
        if (diagnostic.code === "fallback-used")
          console.warn(diagnosticMessage(diagnostic));
      },
    },
  );
}
