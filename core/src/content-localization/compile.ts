import type { z } from "zod";
import type {
  AuthoredContent,
  AuthoredDefinitions,
  AuthoredDomain,
} from "../../interface/common/AuthoredContent";
import type {
  ContentSource,
  LocaleSource,
  LocalizationDiagnostic,
  LocalizationInput,
  LocalizationResult,
} from "../../interface/common/ContentLocalization";
import {
  definitionSchemas,
  fields,
  inputSchema,
  localeEntrySchema,
  mapSchema,
} from "./schemas";

interface Location {
  source: string;
  path: (string | number)[];
  language: string;
  reference?: string;
}
interface Definition {
  domain: AuthoredDomain;
  key: string;
  value: AuthoredDefinitions[AuthoredDomain];
  location: Location;
}
interface Leaf {
  text: string;
  names: Set<string>;
  temporary: boolean;
  location: Location;
}
interface State {
  diagnostics: LocalizationDiagnostic[];
  definitions: Map<string, Definition>;
  leaves: Map<string, Leaf>;
  used: Set<string>;
}

function report(
  state: State,
  code: LocalizationDiagnostic["code"],
  location: Location,
  message: string,
  severity: "error" | "info" = "error",
  placeholder?: string,
) {
  const diagnostic: LocalizationDiagnostic = {
    code,
    severity,
    ...location,
    message,
  };
  if (placeholder !== undefined) diagnostic.placeholder = placeholder;
  state.diagnostics.push(diagnostic);
}

function shapeErrors(state: State, error: z.ZodError, location: Location) {
  for (const issue of error.issues) {
    const path = [...location.path, ...issue.path.map(String)];
    report(state, "invalid-shape", { ...location, path }, issue.message);
  }
}

function canonicalLanguage(state: State, language: string, location: Location) {
  try {
    if (Intl.getCanonicalLocales(language)[0] === language) return true;
  } catch {
    /* Invalid tags are reported through the same boundary diagnostic. */
  }
  report(
    state,
    "invalid-language",
    location,
    `Expected an exact canonical BCP 47 tag: ${language}.`,
  );
  return false;
}

/** Check raw parsed data before Zod can omit this reserved own property. */
function rejectReservedKeys(
  state: State,
  value: unknown,
  location: Location,
  ancestors = new Set<object>(),
): boolean {
  if (value === null || typeof value !== "object" || ancestors.has(value))
    return false;
  ancestors.add(value);
  let rejected = Object.hasOwn(value, "__proto__");
  if (rejected) {
    report(
      state,
      "invalid-shape",
      { ...location, path: [...location.path, "__proto__"] },
      "The own key __proto__ is reserved and cannot be preserved by the parsed-content boundary.",
    );
  }
  for (const [key, child] of Object.entries(value)) {
    const segment = Array.isArray(value) ? Number(key) : key;
    const childRejected = rejectReservedKeys(
      state,
      child,
      { ...location, path: [...location.path, segment] },
      ancestors,
    );
    rejected = childRejected || rejected;
  }
  ancestors.delete(value);
  return rejected;
}

function readContent(state: State, shard: ContentSource) {
  const location = { source: shard.source, path: [], language: "en" };
  if (rejectReservedKeys(state, shard.data, location)) return;
  const parsed = mapSchema.safeParse(shard.data);
  if (!parsed.success) return shapeErrors(state, parsed.error, location);
  for (const [key, value] of Object.entries(parsed.data)) {
    readDefinition(state, shard.domain, key, value, {
      ...location,
      path: [key],
    });
  }
}

function readDefinition(
  state: State,
  domain: AuthoredDomain,
  key: string,
  value: unknown,
  location: Location,
) {
  const id = `${domain}.${key}`;
  const previous = state.definitions.get(id);
  if (previous) {
    report(
      state,
      "duplicate-key",
      location,
      `Duplicate ${id}; first defined in ${previous.location.source}.`,
    );
    return;
  }
  const parsed = definitionSchemas[domain].safeParse(value);
  if (!parsed.success) return shapeErrors(state, parsed.error, location);
  if (
    domain === "skills" &&
    "skillKey" in parsed.data &&
    parsed.data.skillKey !== key
  ) {
    report(state, "invalid-shape", location, `skillKey must equal ${key}.`);
  }
  state.definitions.set(id, { domain, key, value: parsed.data, location });
}

function template(
  state: State,
  text: string,
  location: Location,
  params: readonly string[] | undefined,
): Leaf {
  const names = new Set<string>();
  const remainder = text.replace(
    /\{([A-Za-z_][A-Za-z0-9_-]*)\}/g,
    (_match, name: string) => {
      names.add(name);
      return "";
    },
  );
  // Braced LOCALE prefixes or bare dotted paths are reference-shaped. The word
  // “locale” in prose (including sentence-final punctuation) is ordinary text.
  if (/(?:\{\s*LOCALE\b|\bLOCALE\.(?=[A-Za-z_.{]))/i.test(text)) {
    report(
      state,
      "malformed-reference",
      location,
      "Locale leaves must be terminal text, without LOCALE reference tokens.",
    );
  }
  if (/[{}]/.test(remainder)) {
    report(
      state,
      "malformed-placeholder",
      location,
      "Expected balanced single-brace parameter placeholders.",
    );
  }
  const leaf = {
    text,
    names,
    temporary: /\[TEMPORARY:[^\]]+\]/.test(text),
    location,
  };
  validateNames(state, leaf, params);
  if (leaf.temporary)
    report(
      state,
      "temporary-text",
      location,
      "Visibly marked temporary text.",
      "info",
    );
  return leaf;
}

function validateNames(
  state: State,
  leaf: Leaf,
  params: readonly string[] | undefined,
) {
  if (params === undefined) return; // Staged traits have no declaration yet.
  for (const name of leaf.names) {
    if (!params.includes(name))
      report(
        state,
        "unknown-placeholder",
        leaf.location,
        `Undeclared parameter: ${name}.`,
        "error",
        name,
      );
  }
}

function parameters(
  definition: Definition | undefined,
  domain: AuthoredDomain,
): readonly string[] | undefined {
  if (domain !== "traits") return [];
  if (!definition) return undefined;
  return "params" in definition.value ? (definition.value.params ?? []) : [];
}

function readLocales(state: State, shards: readonly LocaleSource[]) {
  const entries = new Map<string, string>();
  for (const shard of shards) readLocaleShard(state, entries, shard);
}

function readLocaleShard(
  state: State,
  entries: Map<string, string>,
  shard: LocaleSource,
) {
  const location: Location = {
    source: shard.source,
    path: [],
    language: shard.language,
  };
  if (!canonicalLanguage(state, shard.language, location)) return;
  if (rejectReservedKeys(state, shard.data, location)) return;
  const parsed = mapSchema.safeParse(shard.data);
  if (!parsed.success) return shapeErrors(state, parsed.error, location);
  for (const [key, value] of Object.entries(parsed.data)) {
    const id = `${shard.language}.${shard.domain}.${key}`;
    const entryLocation = { ...location, path: [key] };
    if (entries.has(id)) {
      report(
        state,
        "duplicate-key",
        entryLocation,
        `Duplicate ${id}; first defined in ${entries.get(id)}.`,
      );
      continue;
    }
    entries.set(id, shard.source);
    readLocaleEntry(state, shard.domain, key, value, entryLocation);
  }
}

function readLocaleEntry(
  state: State,
  domain: AuthoredDomain,
  key: string,
  value: unknown,
  location: Location,
) {
  const parsed = localeEntrySchema.safeParse(value);
  if (!parsed.success) return shapeErrors(state, parsed.error, location);
  const definition = state.definitions.get(`${domain}.${key}`);
  for (const field of fields) {
    const text = parsed.data[field];
    if (text === undefined) continue;
    const reference = `{LOCALE.${domain}.${key}.${field}}`;
    const leafLocation = { ...location, path: [key, field], reference };
    const leaf = template(
      state,
      text,
      leafLocation,
      parameters(definition, domain),
    );
    state.leaves.set(`${location.language}.${domain}.${key}.${field}`, leaf);
  }
}

function referencePath(
  state: State,
  text: string,
  location: Location,
): string | undefined {
  const match =
    /^\{LOCALE\.(races|traits|skills|birthsigns)\.([A-Za-z_][A-Za-z0-9_-]*)\.(label|description)\}$/.exec(
      text,
    );
  if (!match || !state.definitions.has(`${match[1]}.${match[2]}`)) {
    report(
      state,
      "malformed-reference",
      { ...location, reference: text },
      "Expected a full-field LOCALE reference to an authored definition and display field.",
    );
    return undefined;
  }
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function resolveField(
  state: State,
  definition: Definition,
  field: (typeof fields)[number],
  input: LocalizationInput,
): { english: Leaf; effective: Leaf } | undefined {
  const location = {
    ...definition.location,
    path: [definition.key, field],
    language: input.language,
  };
  const text = definition.value[field];
  if (text === undefined) return undefined; // Boundary schema requires both fields.
  const path = referencePath(state, text, location);
  if (path === undefined) return undefined;
  const referenceLocation = { ...location, reference: text };
  const englishId = `en.${path}`;
  const targetId = `${input.language}.${path}`;
  state.used.add(englishId);
  state.used.add(targetId);
  const english = state.leaves.get(englishId);
  if (!english) {
    report(
      state,
      "missing-english-key",
      { ...referenceLocation, language: "en" },
      "Mandatory English display text is missing.",
    );
    return undefined;
  }
  let effective = state.leaves.get(targetId);
  if (!effective && input.allowEnglishFallback) {
    effective = english;
    report(
      state,
      "fallback-used",
      referenceLocation,
      `Using English from ${english.location.source}.`,
      "info",
    );
  }
  if (!effective) {
    report(
      state,
      "missing-target-key",
      referenceLocation,
      "Requested language display text is missing.",
    );
    return undefined;
  }
  const params = parameters(definition, definition.domain);
  validateNames(state, english, params);
  if (effective !== english) validateNames(state, effective, params);
  return { english, effective };
}

function sameNames(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((name) => right.has(name));
}

function checkParity(state: State, english: Leaf[], effective: Leaf[]) {
  const allApproved = [...english, ...effective].every(
    (leaf) => !leaf.temporary,
  );
  if (allApproved) {
    const sourceNames = new Set(english.flatMap((leaf) => [...leaf.names]));
    const targetNames = new Set(effective.flatMap((leaf) => [...leaf.names]));
    if (!sameNames(sourceNames, targetNames))
      report(
        state,
        "placeholder-set-mismatch",
        effective[0]!.location,
        "Effective display pair must preserve the combined English parameter set.",
      );
    return;
  }
  for (let index = 0; index < english.length; index++) {
    const source = english[index]!;
    const target = effective[index]!;
    if (
      !source.temporary &&
      !target.temporary &&
      !sameNames(source.names, target.names)
    ) {
      report(
        state,
        "placeholder-set-mismatch",
        target.location,
        "Approved field must preserve its English parameter set when either pair contains temporary text.",
      );
    }
  }
}

function resolveDefinition(
  state: State,
  definition: Definition,
  input: LocalizationInput,
) {
  const label = resolveField(state, definition, "label", input);
  const description = resolveField(state, definition, "description", input);
  if (!label || !description) return;
  checkParity(
    state,
    [label.english, description.english],
    [label.effective, description.effective],
  );
  definition.value.label = label.effective.text;
  definition.value.description = description.effective.text;
}

/** Host-neutral build boundary: parsed YAML in, detached definitions or diagnostics-only failure out. */
export function compileContentLocalization(
  input: LocalizationInput,
): LocalizationResult {
  const state: State = {
    diagnostics: [],
    definitions: new Map(),
    leaves: new Map(),
    used: new Set(),
  };
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    shapeErrors(state, parsed.error, {
      source: "<input>",
      path: [],
      language: "",
    });
    return { success: false, diagnostics: state.diagnostics };
  }
  input = parsed.data;
  canonicalLanguage(state, input.language, {
    source: "<input>",
    path: ["language"],
    language: input.language,
  });
  for (const shard of input.content) readContent(state, shard);
  readLocales(state, input.locales);
  // Invalid present text is never eligible for fallback, even during inspection.
  if (state.diagnostics.some((diagnostic) => diagnostic.severity === "error"))
    return { success: false, diagnostics: state.diagnostics };
  for (const definition of state.definitions.values())
    resolveDefinition(state, definition, input);
  for (const [id, leaf] of state.leaves) {
    if (!state.used.has(id))
      report(
        state,
        "unused-entry",
        leaf.location,
        "Locale leaf is unused by this compilation (possibly staged content).",
        "info",
      );
  }
  if (state.diagnostics.some((diagnostic) => diagnostic.severity === "error"))
    return { success: false, diagnostics: state.diagnostics };
  const definitions: AuthoredContent = {
    races: Object.create(null),
    traits: Object.create(null),
    skills: Object.create(null),
    birthsigns: Object.create(null),
  };
  for (const definition of state.definitions.values()) {
    // The domain schema established this correlation at the parsed-input boundary.
    const target: Record<string, AuthoredDefinitions[AuthoredDomain]> =
      definitions[definition.domain];
    target[definition.key] = definition.value;
  }
  return {
    success: true,
    definitions,
    metadata: {
      language: input.language,
      allowEnglishFallback: input.allowEnglishFallback ?? false,
    },
    diagnostics: state.diagnostics,
  };
}
