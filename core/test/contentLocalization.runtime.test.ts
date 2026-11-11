import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { compileContentLocalization } from "@wayshrine/core/content-localization";
import type {
  AuthoredDomain,
  ContentSource,
  LocaleSource,
  LocalizationInput,
} from "@wayshrine/core/content-localization";

const domains: AuthoredDomain[] = [
  "races",
  "traits",
  "skills",
  "birthsigns",
  "powers",
];

async function catalogSources(root: string): Promise<ContentSource[]> {
  const sources: ContentSource[] = [];
  for (const domain of domains) {
    const directory = new URL(`../${root}/${domain}/`, import.meta.url);
    for (const file of (await readdir(directory)).sort()) {
      const url = new URL(file, directory);
      sources.push({
        domain,
        source: fileURLToPath(url),
        data: parse(await readFile(url, "utf8"), {
          uniqueKeys: true,
          stringKeys: true,
        }),
      });
    }
  }
  return sources;
}

function fixture(target?: Record<string, unknown>): LocalizationInput {
  const locales: LocaleSource[] = [
    {
      domain: "traits",
      language: "en",
      source: "en/traits.yml",
      data: { power: { label: "Power {X}", description: "Approved prose" } },
    },
  ];
  if (target)
    locales.push({
      domain: "traits",
      language: "fr",
      source: "fr/traits.yml",
      data: { power: target },
    });
  return {
    language: "fr",
    content: [
      {
        domain: "traits",
        source: "traits.yml",
        data: {
          power: {
            label: "{LOCALE.traits.power.label}",
            description: "{LOCALE.traits.power.description}",
            params: ["X"],
          },
        },
      },
    ],
    locales,
  };
}

function expectFailure(input: LocalizationInput, code: string) {
  const result = compileContentLocalization(input);
  expect(result.success).toBe(false);
  expect(result).not.toHaveProperty("definitions");
  expect(result.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code, severity: "error" }),
    ]),
  );
  return result;
}

function mechanicsOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(mechanicsOnly);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["label", "description", "prompt"].includes(key))
      .map(([key, child]) => [key, mechanicsOnly(child)]),
  );
}

describe("build-time content localization public entrypoint", () => {
  it("allows natural locale prose in English, French, staged and unrequested entries", () => {
    const input = fixture({
      label: "Puissance {X}",
      description: "La population locale.",
    });
    input.locales = [
      {
        ...input.locales[0]!,
        data: {
          power: {
            label: "Power {X}",
            description: "Choose an English locale. The locale is local.",
          },
        },
      },
      input.locales[1]!,
      {
        domain: "races",
        language: "fr",
        source: "staged.yml",
        data: {
          future: {
            label: "Population locale",
            description: "La population locale.",
          },
        },
      },
      {
        domain: "skills",
        language: "de",
        source: "unrequested.yml",
        data: {
          future: {
            label: "English locale",
            description: "The locale is configurable.",
          },
        },
      },
    ];
    const result = compileContentLocalization(input);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.definitions.traits.power!.description).toBe(
        "La population locale.",
      );
    input.language = "en";
    const english = compileContentLocalization(input);
    expect(english.success).toBe(true);
    if (english.success)
      expect(english.definitions.traits.power!.description).toBe(
        "Choose an English locale. The locale is local.",
      );
  });

  it.each([
    "{LOCALE.traits.power.label}",
    "{{LOCALE.traits.power.label}}",
    "{ locale.traits.power.label }",
    "{LOCALE..power.label}",
    "{LOCALE.traits.power.label",
    "LOCALE.traits.power.label}",
    "LOCALE..power.label",
    "{LOCALE}",
  ])(
    "rejects reference-shaped terminal text even in unrequested staged entries: %s",
    (label) => {
      const input = fixture({ label: "Puissance {X}", description: "Texte" });
      input.locales = [
        ...input.locales,
        {
          domain: "traits",
          language: "de",
          source: "staged.yml",
          data: { future: { label } },
        },
      ];
      const result = expectFailure(input, "malformed-reference");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          source: "staged.yml",
          path: ["future", "label"],
        }),
      );
    },
  );

  it.each(["content", "locales"] as const)(
    "rejects an actual own __proto__ entry in %s before it can disappear",
    (kind) => {
      const input = fixture({ label: "Puissance {X}", description: "Texte" });
      const data: unknown = JSON.parse(
        '{"__proto__":{"label":"Reserved","description":"Reserved"}}',
      );
      expect(Object.hasOwn(data as object, "__proto__")).toBe(true);
      if (kind === "content")
        input.content = [
          ...input.content,
          { domain: "traits", source: "reserved.yml", data },
        ];
      else
        input.locales = [
          ...input.locales,
          { domain: "traits", language: "en", source: "reserved.yml", data },
        ];
      const result = expectFailure(input, "invalid-shape");
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          source: "reserved.yml",
          path: ["__proto__"],
          message: expect.stringContaining("__proto__"),
        }),
      );
    },
  );

  it("rejects own __proto__ keys in nested mechanical parameter maps", () => {
    const input = fixture({ label: "Puissance {X}", description: "Texte" });
    const data: unknown = JSON.parse(
      '{"sign":{"label":"{LOCALE.birthsigns.sign.label}","description":"{LOCALE.birthsigns.sign.description}","bonuses":[{"bonusType":"trait","bonusTargetKey":"power","bonusParams":{"__proto__":2}}],"starCursed":{"overwriteBaseBonuses":false,"bonuses":[]}}}',
    );
    input.content = [
      ...input.content,
      { domain: "birthsigns", source: "nested.yml", data },
    ];
    input.locales = [
      ...input.locales,
      {
        domain: "birthsigns",
        language: "en",
        source: "en/sign.yml",
        data: { sign: { label: "Sign", description: "Sign prose" } },
      },
    ];
    input.allowEnglishFallback = true;
    const result = expectFailure(input, "invalid-shape");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        source: "nested.yml",
        path: ["sign", "bonuses", 0, "bonusParams", "__proto__"],
      }),
    );
  });

  it("rejects own __proto__ keys nested in locale entries", () => {
    const input = fixture({ label: "Puissance {X}", description: "Texte" });
    const data: unknown = JSON.parse(
      '{"future":{"label":"Staged","__proto__":"Reserved"}}',
    );
    input.locales = [
      ...input.locales,
      { domain: "races", language: "en", source: "nested-locale.yml", data },
    ];
    const result = expectFailure(input, "invalid-shape");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        source: "nested-locale.yml",
        path: ["future", "__proto__"],
      }),
    );
  });

  it("compiles all actual English catalogs, preserves mechanics and detaches nested data", async () => {
    const content = await catalogSources("content");
    const locales = (await catalogSources("locales/en")).map((source) => ({
      ...source,
      language: "en",
    }));
    const input = { content, locales, language: "en" };
    const before = structuredClone(input);
    const result = compileContentLocalization(input);
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.severity === "error",
      ),
    ).toEqual([]);
    if (!result.success)
      throw new Error("Expected successful actual-catalog compilation");
    expect(Object.keys(result.definitions.races)).toEqual([
      "altmer",
      "argonian",
    ]);
    expect(Object.keys(result.definitions.traits)).toHaveLength(46);
    expect(Object.keys(result.definitions.skills)).toHaveLength(27);
    expect(Object.keys(result.definitions.birthsigns)).toHaveLength(12);
    expect(Object.keys(result.definitions.powers)).toHaveLength(10);
    const unusedRaces = new Set(
      result.diagnostics
        .filter(
          (diagnostic) =>
            diagnostic.code === "unused-entry" &&
            diagnostic.reference?.includes("LOCALE.races."),
        )
        .map((diagnostic) => diagnostic.path[0]),
    );
    expect(unusedRaces.size).toBe(21);
    expect(result.definitions.traits.skeletal!.description).toContain(
      "Burning (X)",
    );
    expect(result.definitions.traits.powerWell!.description).toContain("{X}");
    expect(JSON.stringify(result.definitions)).not.toContain("LOCALE");
    for (const source of content) {
      for (const [key, authored] of Object.entries(
        source.data as Record<string, Record<string, unknown>>,
      )) {
        const {
          label: _label,
          description: _description,
          ...mechanics
        } = authored;
        const {
          label: _resolvedLabel,
          description: _resolvedDescription,
          ...resolvedMechanics
        } = result.definitions[source.domain][key]!;
        expect(mechanicsOnly(resolvedMechanics)).toEqual(
          mechanicsOnly(mechanics),
        );
      }
    }
    expect(input).toEqual(before);
    Reflect.set(
      result.definitions.races.altmer!.baselineCharacteristics,
      "str",
      999,
    );
    result.definitions.traits.powerWell!.label = "Changed";
    expect(input).toEqual(before);
    const again = compileContentLocalization(input);
    expect(
      again.success &&
        again.definitions.races.altmer!.baselineCharacteristics.str,
    ).not.toBe(999);
  });

  it("allows approved placeholder movement, repetition and ordering across the pair", () => {
    const result = compileContentLocalization(
      fixture({ label: "Puissance", description: "Valeur {X}, encore {X}" }),
    );
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.definitions.traits.power!.description).toBe(
        "Valeur {X}, encore {X}",
      );
  });

  it("is strict by default and uses only explicit per-leaf English fallback", () => {
    const input = fixture({ label: "Puissance {X}" });
    expectFailure(input, "missing-target-key");
    input.allowEnglishFallback = true;
    const result = compileContentLocalization(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.definitions.traits.power).toMatchObject({
      label: "Puissance {X}",
      description: "Approved prose",
    });
    expect(result.metadata).toEqual({
      language: "fr",
      allowEnglishFallback: true,
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "fallback-used",
        source: "traits.yml",
        language: "fr",
        reference: "{LOCALE.traits.power.description}",
      }),
    );
    input.language = "fr-CA";
    input.allowEnglishFallback = false;
    expectFailure(input, "missing-target-key");
  });

  it("requires English even when the translation is complete", () => {
    const input = fixture({ label: "Puissance {X}", description: "Texte" });
    input.locales = input.locales.slice(1);
    input.allowEnglishFallback = true;
    expectFailure(input, "missing-english-key");
  });

  it("checks effective pair parity after fallback", () => {
    const input = fixture({ label: "Puissance" });
    input.allowEnglishFallback = true;
    expectFailure(input, "placeholder-set-mismatch");
  });

  it("does not substitute for temporary translations and enforces approved counterpart parity", () => {
    const input = fixture({
      label: "Puissance",
      description: "[TEMPORARY: description pending]",
    });
    input.allowEnglishFallback = true;
    const failed = expectFailure(input, "placeholder-set-mismatch");
    expect(
      failed.diagnostics.some(
        (diagnostic) => diagnostic.code === "temporary-text",
      ),
    ).toBe(true);
    const result = compileContentLocalization(
      fixture({ label: "Puissance {X}", description: "[TEMPORARY: pending]" }),
    );
    expect(result.success).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "fallback-used",
      ),
    ).toBe(false);
    if (result.success)
      expect(result.definitions.traits.power!.description).toBe(
        "[TEMPORARY: pending]",
      );
  });

  it("temporary English exempts only its own field, including when fallback makes a mixed pair", () => {
    const input = fixture({ label: "Puissance" });
    input.locales = [
      {
        ...input.locales[0]!,
        data: {
          power: { label: "Power {X}", description: "[TEMPORARY: pending]" },
        },
      },
      input.locales[1]!,
    ];
    input.allowEnglishFallback = true;
    expectFailure(input, "placeholder-set-mismatch");
    input.locales = [
      {
        ...input.locales[0]!,
        data: {
          power: {
            label: "[TEMPORARY: label pending]",
            description: "Approved",
          },
        },
      },
      input.locales[1]!,
    ];
    expect(compileContentLocalization(input).success).toBe(true);
  });

  it.each(["fr-ca", "EN", "iw", "not_a_language"])(
    "rejects noncanonical language %s",
    (language) => {
      const input = fixture();
      input.language = language;
      expectFailure(input, "invalid-language");
    },
  );

  it.each([
    ["{LOCALE.traits.power.label} extra", "malformed-reference"],
    ["{{LOCALE.traits.power.label}}", "malformed-reference"],
    ["{LOCALE.traits.absent.label}", "malformed-reference"],
    ["{LOCALE.traits.power.other}", "malformed-reference"],
    ["{LOCALE..power.label}", "malformed-reference"],
    ["literal", "malformed-reference"],
  ])("rejects authored reference %s", (label, code) => {
    const input = fixture();
    input.content = [
      {
        ...input.content[0]!,
        data: {
          power: {
            label,
            description: "{LOCALE.traits.power.description}",
            params: ["X"],
          },
        },
      },
    ];
    expectFailure(input, code);
  });

  it.each([
    ["{unknown}", "unknown-placeholder"],
    ["{x}", "unknown-placeholder"],
    ["[TEMPORARY: {unknown}]", "unknown-placeholder"],
    ["{{X}}", "malformed-placeholder"],
    ["{X", "malformed-placeholder"],
    ["X}", "malformed-placeholder"],
    ["{}", "malformed-placeholder"],
    ["{LOCALE.traits.power.label}", "malformed-reference"],
    ["LOCALE.traits.power.label", "malformed-reference"],
  ])(
    "rejects invalid present template %s without falling back",
    (label, code) => {
      const input = fixture({ label, description: "Texte" });
      input.allowEnglishFallback = true;
      const result = expectFailure(input, code);
      expect(
        result.diagnostics.some(
          (diagnostic) => diagnostic.code === "fallback-used",
        ),
      ).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          source: "fr/traits.yml",
          path: ["power", "label"],
          language: "fr",
        }),
      );
    },
  );

  it.each([
    null,
    [],
    { power: null },
    { power: { label: 4 } },
    { power: { label: " " } },
    { power: { title: "Wrong" } },
    { "bad.key": { label: "Bad" } },
  ])("validates parsed locale shape %j", (data) => {
    const input = fixture();
    input.locales = [{ ...input.locales[0]!, data }];
    expectFailure(input, "invalid-shape");
  });

  it("rejects duplicate locale keys even when shards contain disjoint fields", () => {
    const input = fixture();
    input.locales = [
      ...input.locales,
      {
        ...input.locales[0]!,
        source: "second.yml",
        data: { power: { description: "Other" } },
      },
    ];
    const result = expectFailure(input, "duplicate-key");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        source: "second.yml",
        message: expect.stringContaining("en/traits.yml"),
      }),
    );
  });

  it("rejects duplicate authored keys and invalid content mechanics/display fields", () => {
    const input = fixture();
    input.content = [
      ...input.content,
      { ...input.content[0]!, source: "duplicate.yml" },
    ];
    expectFailure(input, "duplicate-key");
    input.content = [
      {
        ...input.content[0]!,
        data: {
          power: {
            label: "x",
            description: "y",
            title: "unknown",
            params: [2],
          },
        },
      },
    ];
    expectFailure(input, "invalid-shape");
  });

  it("validates staged leaves without creating definitions", () => {
    const input = fixture();
    input.language = "en";
    input.locales = [
      ...input.locales,
      {
        domain: "races",
        language: "en",
        source: "staged.yml",
        data: { staged: { label: "Future", description: "Future prose" } },
      },
    ];
    const result = compileContentLocalization(input);
    expect(result.success).toBe(true);
    if (result.success)
      expect(Object.keys(result.definitions.races)).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "unused-entry", source: "staged.yml" }),
    );
    input.locales = [
      ...input.locales,
      {
        domain: "skills",
        language: "en",
        source: "bad-staged.yml",
        data: { staged: { label: "{X}" } },
      },
    ];
    expectFailure(input, "unknown-placeholder");
  });
});
