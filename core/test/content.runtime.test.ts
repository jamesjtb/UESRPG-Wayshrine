import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { z } from "zod";
import type {
  ContentDefinitions,
  ContentKind,
} from "../interface/common/ContentCatalog";
import { ContentError } from "../src/content/ContentError";
import { ContentReader } from "../src/content/ContentReader";
import {
  contentIndexSchema,
  parseContentDefinition,
  skillSchema,
} from "../src/content/schemas";
import { validateRaceContent } from "../src/content/validateRaceContent";
import CharacterCreator from "../src/wizards/CharacterCreator";
import { SkillRank } from "../src/enum/SkillRank";
import { completeGeneration } from "./support/CharacteristicGeneration";
import {
  creationCatalogs,
  deferred,
  TestContentCatalog,
} from "./support/ContentCatalog";

/** Authoring-file access stays in tests, never in Core's runtime implementation. */
function readDefinitions<K extends ContentKind>(kind: K, directory: string) {
  const definitions: Record<string, ContentDefinitions[K]> = {};
  const path = new URL(`../content/${directory}/`, import.meta.url);
  for (const filename of readdirSync(path)
    .filter((name) => name.endsWith(".yml"))
    .sort()) {
    const document = parseDocument(
      readFileSync(new URL(filename, path), "utf8"),
    );
    expect(document.errors, filename).toEqual([]);
    const entries = z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .parse(document.toJS());
    for (const [key, definition] of Object.entries(entries)) {
      expect(
        Object.hasOwn(definitions, key),
        `Duplicate ${kind} key: ${key}`,
      ).toBe(false);
      definitions[key] = parseContentDefinition(
        kind,
        key,
        kind === "skill" ? { ...definition, skillKey: key } : definition,
      );
    }
  }
  return definitions;
}

describe("authored content", () => {
  it("validates every definition and all current race references", () => {
    const races = readDefinitions("race", "races");
    const skills = readDefinitions("skill", "skills");
    const traits = readDefinitions("trait", "traits");
    const skillKeys = new Set(Object.keys(skills));
    const traitDefinitions = new Map(Object.entries(traits));
    for (const [key, race] of Object.entries(races)) {
      expect(
        validateRaceContent(race, skillKeys, traitDefinitions),
        key,
      ).toEqual([]);
    }
    expect(skills.profession).toMatchObject({
      chooseGoverningCharacteristic: true,
      hasCustomName: true,
    });
  });

  it("creates an Altmer with exactly one Novice skill using real YAML definitions", async () => {
    const catalog = new TestContentCatalog({
      race: readDefinitions("race", "races"),
      skill: readDefinitions("skill", "skills"),
      trait: readDefinitions("trait", "traits"),
    });
    const creator = new CharacterCreator(catalog);
    expect((await creator.chooseRace("altmer")).ok).toBe(true);
    expect(creator.getSnapshot().racialBonusChoices[0]).toMatchObject({
      choose: 1,
    });
    expect(
      (
        await creator.chooseRacialBonus("altmer/magical-training", [
          "necromancy",
        ])
      ).ok,
    ).toBe(true);
    completeGeneration(creator);
    const result = creator.finish();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.skills).toEqual([
        {
          skill: {
            skillKey: "necromancy",
            label: "{LOCALE.skills.necromancy.label}",
            description: "{LOCALE.skills.necromancy.description}",
            governingCharacteristics: ["int"],
          },
          skillRank: SkillRank.Novice,
        },
      ]);
    }
  });
});

describe("content validation", () => {
  it("supports fixed and player-selected governing characteristics", () => {
    expect(
      skillSchema.safeParse({
        skillKey: "alchemy",
        governingCharacteristics: ["int"],
      }).success,
    ).toBe(true);
    expect(
      skillSchema.safeParse({
        skillKey: "profession",
        chooseGoverningCharacteristic: true,
        hasCustomName: true,
      }).success,
    ).toBe(true);
    expect(
      skillSchema.safeParse({
        skillKey: "profession",
        chooseGoverningCharacteristic: true,
        governingCharacteristics: ["str"],
      }).success,
    ).toBe(false);
    expect(
      skillSchema.safeParse({
        skillKey: "alchemy",
        governingCharacteristics: [],
      }).success,
    ).toBe(false);
    expect(
      skillSchema.safeParse({
        skillKey: "alteration",
        governingCharacteristics: ["Wp"],
      }).success,
    ).toBe(false);
    expect(
      skillSchema.safeParse({
        skillKey: "alchemy",
        governingCharacteristics: ["int", "int"],
      }).success,
    ).toBe(false);
  });

  it("rejects key mismatches, malformed definitions, and host fields", () => {
    expect(() =>
      parseContentDefinition("skill", "alchemy", {
        skillKey: "other",
        governingCharacteristics: ["int"],
      }),
    ).toThrow(ContentError);
    expect(() =>
      parseContentDefinition("skill", "alchemy", {
        skillKey: "alchemy",
        governingCharacteristics: ["int"],
        _id: "foundry-id",
      }),
    ).toThrow(ContentError);
    expect(() =>
      parseContentDefinition("trait", "weakness", {
        label: "Weakness",
        description: "",
        params: ["X", "X"],
      }),
    ).toThrow(ContentError);
    expect(() => parseContentDefinition("race", "altmer", {})).toThrow(
      ContentError,
    );
  });

  it("rejects duplicate or malformed browse results", () => {
    expect(
      contentIndexSchema.safeParse([
        { key: "alchemy", label: "Alchemy" },
        { key: "alchemy", label: "Duplicate" },
      ]).success,
    ).toBe(false);
    expect(
      contentIndexSchema.safeParse([
        { key: "alchemy", label: "Alchemy", system: {} },
      ]).success,
    ).toBe(false);
  });

  it("checks all choice definitions without requiring an answer", () => {
    const { altmer, traits } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "a", choose: 2, options: ["alchemy"] },
          { id: "b", choose: -1, options: ["alchemy"] },
          { id: "c", choose: 1.5, options: ["alchemy"] },
          { id: "d", choose: 1, options: ["alchemy", "alchemy"] },
        ],
      },
    ];
    expect(
      validateRaceContent(
        altmer,
        new Set(["alchemy"]),
        new Map(Object.entries(traits)),
      ),
    ).toHaveLength(4);
  });

  it("checks missing traits and missing/extra trait parameters", () => {
    const { altmer, traits, skills } = creationCatalogs();
    const keys = new Set(Object.keys(skills));
    expect(validateRaceContent(altmer, keys, new Map())).toMatchObject([
      { code: "invalid-race-definition" },
    ]);
    altmer.racialTraits = [{ traitKey: "weakness", params: { X: 2 } }];
    expect(
      validateRaceContent(altmer, keys, new Map(Object.entries(traits))),
    ).toHaveLength(1);
    altmer.racialTraits = [
      { traitKey: "weakness", params: { X: 2, type: "magic", extra: 1 } },
    ];
    expect(
      validateRaceContent(altmer, keys, new Map(Object.entries(traits))),
    ).toHaveLength(1);
  });

  it("does not apply an invalid race's baseline or traits", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialTraits = [{ traitKey: "missing" }];
    const creator = new CharacterCreator(catalog);
    expect(await creator.chooseRace("altmer")).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-race-definition" }],
    });
    expect(creator.getCharacterPreview().race).toBeUndefined();
    expect(creator.getCharacterPreview().characteristics.str.baseline).toBe(0);
    expect(creator.finish().ok).toBe(false);
  });
});

describe("session content reader", () => {
  it("rejects incompatible schemas before any loads", () => {
    const { catalog } = creationCatalogs();
    catalog.version.schemaVersion = 2;
    expect(() => new ContentReader(catalog)).toThrow(ContentError);
    expect(catalog.getCalls).toEqual([]);
  });

  it("checks revision consistency after an in-flight load as well as before", async () => {
    const { catalog } = creationCatalogs();
    const reader = new ContentReader(catalog);
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = reader.get("race", "altmer");
    catalog.version.revision = "updated";
    gate.resolve();
    await expect(pending).rejects.toMatchObject({
      code: "content-version-mismatch",
    });
  });

  it("distinguishes absent definitions from failed loads and allows retry", async () => {
    const { catalog } = creationCatalogs();
    const reader = new ContentReader(catalog);
    expect(await reader.get("skill", "missing")).toBeUndefined();
    catalog.beforeGet = async () => {
      throw new Error("offline");
    };
    await expect(reader.get("skill", "alchemy")).rejects.toMatchObject({
      code: "content-unavailable",
    });
    catalog.beforeGet = undefined;
    expect(await reader.get("skill", "alchemy")).toMatchObject({
      skillKey: "alchemy",
    });
  });
});
