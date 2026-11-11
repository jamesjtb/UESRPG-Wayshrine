import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  BIRTHSIGN_CHARGE_TABLES,
  birthsignSchema,
  birthsignEffectSchema,
  birthsignChoiceSchema,
  parseContentDefinition,
  validateBirthsignChargeTables,
  validateBirthsignContent,
} from "../src/index";
import type {
  Birthsign,
  BirthsignBonus,
  BirthsignEffect,
  ContentDefinitions,
  ContentKind,
} from "../src/index";

function readDomain<K extends ContentKind>(
  kind: K,
  domain: string,
): Map<string, ContentDefinitions[K]> {
  const directory = new URL(`../content/${domain}/`, import.meta.url);
  const definitions = new Map<string, ContentDefinitions[K]>();
  for (const file of readdirSync(directory)) {
    const data = parse(
      readFileSync(new URL(file, directory), "utf8"),
    ) as Record<string, unknown>;
    for (const [key, value] of Object.entries(data))
      definitions.set(key, parseContentDefinition(kind, key, value));
  }
  return definitions;
}

const choice = {
  bonusType: "choice",
  choiceGroup: {
    id: "penalty",
    prompt: "Choose a characteristic.",
    choose: 1,
    options: [
      {
        id: "str",
        effects: [
          {
            bonusType: "characteristic",
            bonusTargetKey: "str",
            bonusValue: -5,
          },
        ],
      },
    ],
  },
  lifecycle: { selection: "once" },
} as const;
const sign: Birthsign = {
  label: "Sign",
  description: "Lore",
  bonuses: [choice],
  starCursed: {
    description: "Variant",
    overwriteBaseBonuses: false,
    bonuses: [],
  },
};

describe("birthsign and display-only power runtime boundaries", () => {
  it("validates all twelve real signs, ten powers, traits and all charge table references", () => {
    const signs = readDomain("birthsign", "birthsigns");
    const powers = readDomain("power", "powers");
    const traits = readDomain("trait", "traits");
    expect(signs.size).toBe(12);
    expect([...powers.keys()]).toEqual([
      "adrenalineRush",
      "akaviriDangerSense",
      "ancestorGuardian",
      "blessedTouch",
      "blessedWord",
      "theCalling",
      "marasGift",
      "moonshadow",
      "treasureSeeker",
      "warCry",
    ]);
    expect(validateBirthsignChargeTables(new Set(signs.keys()))).toEqual([]);
    for (const [key, definition] of signs)
      expect(
        validateBirthsignContent(definition, traits, new Set(powers.keys())),
        key,
      ).toEqual([]);
    expect(BIRTHSIGN_CHARGE_TABLES.map((table) => table.entries)).toEqual([
      ["theWarrior", "theLady", "theSteed", "theLord"],
      ["theMage", "theApprentice", "theAtronach", "theRitual"],
      ["theThief", "theLover", "theShadow", "theTower"],
    ]);
    expect(BIRTHSIGN_CHARGE_TABLES.map((table) => table.fifthResult)).toEqual(
      Array(3).fill("rerollStarCursed"),
    );
    expect(validateBirthsignChargeTables(new Set())).toHaveLength(12);
  });

  it("detaches definitions and rejects activation fields on powers", () => {
    const parsed = parseContentDefinition("birthsign", "sign", sign);
    expect(parsed).toEqual(sign);
    expect(parsed.starCursed).not.toBe(sign.starCursed);
    expect(parsed.bonuses[0]).not.toBe(choice);
    expect(
      parseContentDefinition("power", "power", {
        label: "Power",
        description: "Prose",
      }),
    ).toEqual({ label: "Power", description: "Prose" });
    expect(() =>
      parseContentDefinition("power", "power", {
        label: "Power",
        description: "Prose",
        activation: "longRest",
      }),
    ).toThrow();
  });

  it.each([
    { bonusType: "characteristic", bonusTargetKey: "strength", bonusValue: 5 },
    { bonusType: "attribute", bonusTargetKey: "hpMaximum", bonusValue: 5 },
    { bonusType: "multiplier", bonusTargetKey: "speed", bonusValue: 2 },
    {
      bonusType: "trait",
      bonusTargetKey: "weakness",
      bonusParams: { X: true },
    },
    { bonusType: "power", bonusTargetKey: "moonshadow", bonusValue: 5 },
    { bonusType: "extraLuckyNumber", count: 0, retainedRegardlessOfLuck: true },
    {
      bonusType: "extraLuckyNumber",
      count: 1.5,
      retainedRegardlessOfLuck: true,
    },
    {
      bonusType: "extraLuckyNumber",
      count: 1,
      retainedRegardlessOfLuck: false,
    },
    {
      bonusType: "replaceRolledCharacteristic",
      bonusTargetKey: "luck",
      bonusValue: 50,
    },
  ])("rejects malformed effect %j", (effect) =>
    expect(birthsignEffectSchema.safeParse(effect).success).toBe(false),
  );

  it.each([0, -1, 0.5, 2])("rejects invalid choice count %s", (choose) => {
    expect(
      birthsignChoiceSchema.safeParse({
        ...choice,
        choiceGroup: { ...choice.choiceGroup, choose },
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate IDs, empty and nested choices, malformed lifecycle and eligibility", () => {
    const group = choice.choiceGroup;
    for (const options of [
      [],
      [...group.options, ...group.options],
      [{ id: "empty", effects: [] }],
      [{ id: "nested", effects: [choice] }],
    ]) {
      expect(
        birthsignChoiceSchema.safeParse({
          ...choice,
          choiceGroup: { ...group, options },
        }).success,
      ).toBe(false);
    }
    expect(
      birthsignSchema.safeParse({
        ...sign,
        starCursed: { ...sign.starCursed, bonuses: [choice] },
      }).success,
    ).toBe(false);
    for (const lifecycle of [
      { selection: "recurring" },
      { selection: "once", chooseAt: "longRest" },
      {
        selection: "recurring",
        chooseAt: "shortRest",
        expiresAt: "nextLongRest",
      },
    ]) {
      expect(
        birthsignChoiceSchema.safeParse({ ...choice, lifecycle }).success,
      ).toBe(false);
    }
    expect(
      birthsignChoiceSchema.safeParse({
        ...choice,
        lifecycle: {
          selection: "recurring",
          chooseAt: "longRest",
          expiresAt: "nextLongRest",
        },
      }).success,
    ).toBe(true);
    for (const eligibility of [
      { requiresNaturallyRolledSign: false, canSelectBySpendingLuck: false },
      { requiresNaturallyRolledSign: true, canSelectBySpendingLuck: true },
      { requiresNaturallyRolledSign: true },
    ]) {
      expect(
        birthsignSchema.safeParse({
          ...sign,
          starCursed: { ...sign.starCursed, eligibility },
        }).success,
      ).toBe(false);
    }
  });

  it.each(["normal", "starCursed", "normalChoice", "starChoice"])(
    "validates trait/power references and exact parameters in %s effects",
    (branch) => {
      const traits = new Map([
        [
          "weakness",
          { label: "Weakness", description: "Prose", params: ["type", "X"] },
        ],
      ]);
      const effects: BirthsignEffect[] = [
        { bonusType: "trait", bonusTargetKey: "missing" },
        { bonusType: "power", bonusTargetKey: "missing" },
        {
          bonusType: "trait",
          bonusTargetKey: "weakness",
          bonusParams: { X: 2 },
        },
        {
          bonusType: "trait",
          bonusTargetKey: "weakness",
          bonusParams: { X: 2, type: "fire", extra: 1 },
        },
      ];
      let bonuses: readonly BirthsignBonus[] = effects;
      if (branch.endsWith("Choice"))
        bonuses = [
          {
            ...choice,
            choiceGroup: {
              ...choice.choiceGroup,
              options: [{ id: "bad", effects }],
            },
          },
        ];
      const definition: Birthsign = {
        ...sign,
        bonuses: [],
        starCursed: { ...sign.starCursed, bonuses: [] },
      };
      if (branch.startsWith("star")) definition.starCursed.bonuses = bonuses;
      else definition.bonuses = bonuses;
      expect(
        validateBirthsignContent(definition, traits, new Set()),
      ).toHaveLength(4);
      expect(
        validateBirthsignContent(
          {
            ...sign,
            bonuses: [
              {
                bonusType: "trait",
                bonusTargetKey: "weakness",
                bonusParams: { X: 2, type: "fire" },
              },
              { bonusType: "power", bonusTargetKey: "known" },
            ],
          },
          traits,
          new Set(["known"]),
        ),
      ).toEqual([]);
    },
  );
});
