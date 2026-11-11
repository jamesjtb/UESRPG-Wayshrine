import type {
  ContentCatalog,
  ContentDefinitions,
  ContentKind,
  Race,
} from "@wayshrine/core";

const baselineCharacteristics = {
  str: 25,
  end: 25,
  ag: 25,
  int: 30,
  wp: 25,
  prc: 25,
  prs: 25,
};

type FixtureDefinitions = {
  [K in ContentKind]: Record<string, ContentDefinitions[K]>;
};

export function fixtureCatalog(
  configure?: (definitions: FixtureDefinitions) => void,
) {
  const races: Record<string, Race> = {
    altmer: {
      label: "Altmer",
      description: "An Altmer description.",
      baselineCharacteristics,
      racialTraits: [
        { traitKey: "magicWeakness", params: { type: "magic", X: 2 } },
      ],
      racialBonuses: [
        {
          bonusType: "skill",
          choiceGroups: [
            { id: "magic", choose: 1, options: ["alchemy", "alteration"] },
          ],
        },
      ],
    },
    argonian: {
      label: "Argonian",
      description: "A plain description.",
      baselineCharacteristics,
      racialTraits: [],
    },
    manyChoices: {
      label: "Many choices",
      description: "",
      baselineCharacteristics,
      racialTraits: [],
      racialBonuses: [
        {
          bonusType: "skill",
          choiceGroups: [
            { id: "pair", choose: 2, options: ["alchemy", "alteration"] },
            { id: "overlap", choose: 1, options: ["alchemy"] },
            { id: "none", choose: 0, options: ["alchemy"] },
          ],
        },
      ],
    },
  };
  const definitions: FixtureDefinitions = {
    birthsign: {},
    power: {},
    race: races,
    skill: {
      alchemy: {
        skillKey: "alchemy",
        label: "Alchemy",
        governingCharacteristics: ["int"],
      },
      alteration: { skillKey: "alteration", governingCharacteristics: ["wp"] },
    },
    trait: {
      magicWeakness: {
        label: "Weakness",
        description: "",
        params: ["type", "X"],
      },
    },
  };
  configure?.(definitions);
  const catalog: ContentCatalog = {
    version: { schemaVersion: 2, revision: "forge-test" },
    async list(kind) {
      return Object.entries(definitions[kind]).map(([key, definition]) => ({
        key,
        label: definition.label ?? "",
      }));
    },
    async get<K extends ContentKind>(
      kind: K,
      key: string,
    ): Promise<ContentDefinitions[K] | undefined> {
      return definitions[kind][key];
    },
  };
  return catalog;
}
