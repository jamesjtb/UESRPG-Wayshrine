import { describe, expect, it } from "vitest";
import {
  BIRTHSIGN_CHARGE_TABLES,
  CharacterCreator,
  calculateCharacteristicScore,
  type Birthsign,
  type BirthsignQuoteResult,
  type BirthsignSelection,
} from "../src/index";
import {
  creationCatalogs,
  deferred,
  TestContentCatalog,
} from "./support/ContentCatalog";

const normal: BirthsignSelection = { signKey: "theWarrior", variant: "normal" };
const star: BirthsignSelection = { ...normal, variant: "starCursed" };
const thief: BirthsignSelection = {
  signKey: "theThief",
  variant: "starCursed",
};

function setup() {
  const signs: Record<string, Birthsign> = {};
  for (const table of BIRTHSIGN_CHARGE_TABLES) {
    for (const key of table.entries) {
      signs[key] = {
        label: key,
        description: "Lore",
        bonuses: [],
        starCursed: { overwriteBaseBonuses: false, bonuses: [] },
      };
    }
  }
  signs.theThief!.starCursed = {
    overwriteBaseBonuses: false,
    eligibility: {
      requiresNaturallyRolledSign: true,
      canSelectBySpendingLuck: false,
    },
    bonuses: [
      {
        bonusType: "replaceRolledCharacteristic",
        bonusTargetKey: "lck",
        bonusValue: 50,
      },
    ],
  };
  const catalog = new TestContentCatalog({
    ...creationCatalogs().catalog.definitions,
    birthsign: signs,
  });
  const creator = new CharacterCreator(catalog);
  return { creator, catalog, signs };
}

function value(result: BirthsignQuoteResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

function state(creator: CharacterCreator) {
  return JSON.stringify({
    snapshot: creator.getSnapshot(),
    preview: creator.getCharacterPreview(),
  });
}

async function context(creator: CharacterCreator) {
  await creator.chooseRace("argonian");
  creator.submitLuckRoll({ id: "luck", dice: [1, 1] });
}

describe("non-mutating birthsign quotes", () => {
  it("quotes without original history or generation and changes no state", async () => {
    const { creator } = setup();
    const before = state(creator);
    expect(value(await creator.quoteBirthsign(normal))).toMatchObject({
      eligible: true,
      purchaseCost: 5,
      acquisitionMethod: "purchase",
      answers: [],
      affordability: "pending",
      missingInputs: ["race", "luck"],
      finalLuck: undefined,
    });
    expect(value(await creator.quoteBirthsign(star))).toMatchObject({
      purchaseCost: 10,
    });
    expect(state(creator)).toBe(before);
  });

  it("matches actual 0/5/10 pricing and acquisition method, including original before free choice", async () => {
    const { creator } = setup();
    await context(creator);
    await creator.submitBirthsignRoll({
      id: "original",
      charge: "warrior",
      dice: [1],
    });
    for (const selection of [
      normal,
      star,
      { signKey: "theMage", variant: "normal" } as const,
      { signKey: "theMage", variant: "starCursed" } as const,
    ]) {
      const quote = value(await creator.quoteBirthsign(selection));
      expect((await creator.chooseBirthsign(selection)).ok).toBe(true);
      expect(creator.getSnapshot().birthsignSelection).toMatchObject({
        purchaseCost: quote.purchaseCost,
        acquisitionMethod: quote.acquisitionMethod,
      });
      expect(
        calculateCharacteristicScore(
          creator.getCharacterPreview().characteristics.lck,
        ).total,
      ).toBe(quote.finalLuck);
    }
    creator.setFreeBirthsignChoice(true);
    expect(value(await creator.quoteBirthsign(normal))).toMatchObject({
      purchaseCost: 0,
      acquisitionMethod: "original",
    });
  });

  it("shares both natural Thief exceptions and free-choice inherent replacement", async () => {
    for (const dice of [[1], [5, 1]]) {
      const { creator } = setup();
      await context(creator);
      expect(value(await creator.quoteBirthsign(thief))).toMatchObject({
        eligible: false,
        purchaseCost: undefined,
        eligibilityIssues: [{ code: "ineligible-selection" }],
      });
      creator.setFreeBirthsignChoice(true);
      expect(value(await creator.quoteBirthsign(thief))).toMatchObject({
        eligible: true,
        purchaseCost: 0,
        luckBeforePurchase: 80,
        finalLuck: 80,
      });
      creator.setFreeBirthsignChoice(false);
      await creator.submitBirthsignRoll({ id: "thief", charge: "thief", dice });
      expect(value(await creator.quoteBirthsign(thief))).toMatchObject({
        eligible: true,
        purchaseCost: dice.length === 1 ? 5 : 0,
        acquisitionMethod: dice.length === 1 ? "upgrade" : "original",
      });
    }
  });

  it("quotes provisional choices atomically without using or retaining existing answers", async () => {
    const { creator, signs } = setup();
    signs.theWarrior!.bonuses = [
      {
        bonusType: "choice",
        lifecycle: { selection: "once" },
        choiceGroup: {
          id: "luck",
          choose: 1,
          options: [
            {
              id: "penalty",
              effects: [
                {
                  bonusType: "characteristic",
                  bonusTargetKey: "lck",
                  bonusValue: -27,
                },
              ],
            },
          ],
        },
      },
    ];
    await context(creator);
    await creator.chooseBirthsign(normal);
    creator.chooseBirthsignBonus("theWarrior/luck", ["penalty"]);
    const before = state(creator);
    const missing = value(await creator.quoteBirthsign(normal));
    expect(missing).toMatchObject({
      purchaseCost: 5,
      effectivePackage: undefined,
      finalLuck: undefined,
      affordability: "pending",
    });
    expect(missing.choices[0]!.selections).toEqual([]);
    const answers = [{ choiceId: "theWarrior/luck", selections: ["penalty"] }];
    const quoted = value(await creator.quoteBirthsign(normal, answers));
    expect(quoted).toMatchObject({
      luckBeforePurchase: 5,
      finalLuck: 0,
      affordability: "affordable",
      missingInputs: [],
    });
    expect(quoted.effectivePackage).toBeDefined();
    for (const selections of [[], ["bad"], ["penalty", "penalty"]]) {
      expect(
        value(
          await creator.quoteBirthsign(normal, [
            { choiceId: "theWarrior/luck", selections },
          ]),
        ).effectivePackage,
      ).toBeUndefined();
    }
    expect(state(creator)).toBe(before);
    expect(
      calculateCharacteristicScore(
        creator.getCharacterPreview().characteristics.lck,
      ).total,
    ).toBe(quoted.finalLuck);
  });

  it("shares purchase affordability, but free choices do not impose a minimum", async () => {
    const { creator, signs } = setup();
    signs.theWarrior!.bonuses = [
      { bonusType: "characteristic", bonusTargetKey: "lck", bonusValue: -40 },
    ];
    await context(creator);
    const before = state(creator);
    expect(value(await creator.quoteBirthsign(normal))).toMatchObject({
      luckBeforePurchase: -8,
      finalLuck: -13,
      affordability: "unaffordable",
      issues: [{ code: "unaffordable-selection" }],
    });
    expect(state(creator)).toBe(before);
    expect(await creator.chooseBirthsign(normal)).toMatchObject({
      ok: false,
      issues: [{ code: "unaffordable-selection" }],
    });
    creator.setFreeBirthsignChoice(true);
    expect(value(await creator.quoteBirthsign(normal))).toMatchObject({
      finalLuck: -8,
      affordability: "affordable",
      issues: [],
    });
  });

  it.each([false, true])(
    "uses active additive/replacement packages and ignores recurring grants (overwrite=%s)",
    async (overwrite) => {
      const { creator, signs } = setup();
      signs.theWarrior!.bonuses = [
        {
          bonusType: "choice",
          lifecycle: { selection: "once" },
          choiceGroup: {
            id: "base",
            choose: 1,
            options: [
              {
                id: "base",
                effects: [
                  {
                    bonusType: "characteristic",
                    bonusTargetKey: "lck",
                    bonusValue: 2,
                  },
                ],
              },
            ],
          },
        },
      ];
      signs.theWarrior!.starCursed = {
        overwriteBaseBonuses: overwrite,
        bonuses: [
          {
            bonusType: "choice",
            lifecycle: { selection: "once" },
            choiceGroup: {
              id: "star",
              choose: 1,
              options: [
                {
                  id: "star",
                  effects: [
                    {
                      bonusType: "characteristic",
                      bonusTargetKey: "lck",
                      bonusValue: -5,
                    },
                  ],
                },
              ],
            },
          },
          {
            bonusType: "choice",
            lifecycle: {
              selection: "recurring",
              chooseAt: "longRest",
              expiresAt: "nextLongRest",
            },
            choiceGroup: {
              id: "recurring",
              choose: 1,
              options: [
                {
                  id: "later",
                  effects: [
                    {
                      bonusType: "characteristic",
                      bonusTargetKey: "lck",
                      bonusValue: 99,
                    },
                  ],
                },
              ],
            },
          },
        ],
      };
      await context(creator);
      const answers = [
        { choiceId: "theWarrior/base", selections: ["base"] },
        { choiceId: "theWarrior/star", selections: ["star"] },
        { choiceId: "theWarrior/recurring", selections: ["later"] },
      ];
      const quote = value(await creator.quoteBirthsign(star, answers));
      expect(quote.finalLuck).toBe(overwrite ? 17 : 19);
      expect(quote.choices).toHaveLength(overwrite ? 2 : 3);
      expect(quote.issues).toEqual([]);
      expect((await creator.chooseBirthsign(star)).ok).toBe(true);
      for (const answer of answers.slice(overwrite ? 1 : 0, 2))
        creator.chooseBirthsignBonus(answer.choiceId, answer.selections);
      expect(
        calculateCharacteristicScore(
          creator.getCharacterPreview().characteristics.lck,
        ).total,
      ).toBe(quote.finalLuck);
    },
  );

  it("captures detached input answers before I/O and reevaluates generation changes", async () => {
    const { creator, catalog } = setup();
    await context(creator);
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const selection = { ...normal };
    const answers = [{ choiceId: "inactive", selections: ["initial"] }];
    const pending = creator.quoteBirthsign(selection, answers);
    selection.signKey = "changed";
    answers[0]!.selections[0] = "changed";
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.submitLuckRoll({ id: "replacement", dice: [10, 10] });
    creator.setCharacteristicGenerationMethod("point-buy");
    const before = state(creator);
    gate.resolve();
    expect(value(await pending)).toMatchObject({
      selection: normal,
      answers: [{ selections: ["initial"] }],
      luckBeforePurchase: 50,
      finalLuck: 45,
    });
    expect(state(creator)).toBe(before);
  });

  it("preserves pending/failed selection intent and never cancels a real choose", async () => {
    const { creator, catalog } = setup();
    const gate = deferred();
    catalog.beforeGet = async (_, key) => {
      if (key === "theWarrior") await gate.promise;
    };
    const selection = creator.chooseBirthsign(normal);
    const before = state(creator);
    await creator.quoteBirthsign({ signKey: "theMage", variant: "normal" });
    expect(state(creator)).toBe(before);
    gate.reject(new Error("offline"));
    expect((await selection).ok).toBe(false);
    const failed = state(creator);
    await creator.quoteBirthsign({ signKey: "theMage", variant: "normal" });
    expect(state(creator)).toBe(failed);
    catalog.beforeGet = undefined;
    const choose = creator.chooseBirthsign(star);
    await creator.quoteBirthsign(normal);
    expect((await choose).ok).toBe(true);
    expect(creator.getSnapshot().birthsignSelection.selected).toEqual(star);
  });

  it("evaluates current roll, mode, and generation context and does not trust old quotes", async () => {
    const { creator, catalog } = setup();
    const gate = deferred();
    catalog.beforeGet = async (_, key) => {
      if (key === "theThief") await gate.promise;
    };
    const pending = creator.quoteBirthsign(thief);
    await context(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.submitBirthsignRoll({
      id: "original",
      charge: "warrior",
      dice: [1],
    });
    const before = state(creator);
    gate.resolve();
    expect(value(await pending)).toMatchObject({
      purchaseCost: 0,
      finalLuck: 80,
      acquisitionMethod: "freeChoice",
    });
    expect(state(creator)).toBe(before);
    creator.setFreeBirthsignChoice(false);
    expect(await creator.chooseBirthsign(thief)).toMatchObject({
      ok: false,
      issues: [{ code: "ineligible-selection" }],
    });
  });

  it("allows out-of-order independent quotes without changing original roll operations", async () => {
    const { creator, catalog } = setup();
    const gate = deferred();
    catalog.beforeGet = async (_, key) => {
      if (key === "theWarrior") await gate.promise;
    };
    const pending = creator.quoteBirthsign(normal);
    const roll = creator.submitBirthsignRoll({
      id: "original",
      charge: "warrior",
      dice: [1],
    });
    expect(
      value(
        await creator.quoteBirthsign({ signKey: "theMage", variant: "normal" }),
      ).purchaseCost,
    ).toBe(5);
    gate.resolve();
    expect((await roll).ok).toBe(true);
    expect(value(await pending).purchaseCost).toBe(0);
    expect(creator.getSnapshot().birthsignSelection.selected).toEqual(normal);
  });

  it("reports missing, malformed, invalid-reference, and version errors without session issues", async () => {
    for (const failure of [
      "missing",
      "malformed",
      "reference",
      "version",
      "offline",
    ] as const) {
      const { creator, catalog, signs } = setup();
      const before = state(creator);
      if (failure === "malformed") signs.theWarrior!.label = undefined!;
      if (failure === "reference")
        signs.theWarrior!.starCursed.bonuses = [
          { bonusType: "power", bonusTargetKey: "absent" },
        ];
      if (failure === "version")
        catalog.beforeGet = async () => {
          catalog.version.revision = "changed";
        };
      if (failure === "offline")
        catalog.beforeGet = async () => {
          throw new Error("offline");
        };
      const result = await creator.quoteBirthsign(
        failure === "missing" ? { ...normal, signKey: "absent" } : normal,
      );
      expect(result).toMatchObject({
        ok: false,
        issues: [
          {
            code: {
              missing: "unknown-birthsign",
              malformed: "invalid-content",
              reference: "invalid-content",
              version: "content-version-mismatch",
              offline: "content-unavailable",
            }[failure],
          },
        ],
      });
      expect(state(creator)).toBe(before);
    }
  });

  it("checks pinned versions through reference loading and validates trait parameters", async () => {
    const { creator, catalog, signs } = setup();
    signs.theWarrior!.bonuses = [
      {
        bonusType: "trait",
        bonusTargetKey: "weakness",
        bonusParams: { type: "magic", X: 2 },
      },
    ];
    const started = deferred();
    const gate = deferred();
    catalog.beforeGet = async (kind) => {
      if (kind !== "trait") return;
      started.resolve();
      await gate.promise;
    };
    const pending = creator.quoteBirthsign(normal);
    await started.promise;
    catalog.version.revision = "updated";
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "content-version-mismatch" }],
    });
    catalog.version.revision = "test-revision";
    catalog.beforeGet = undefined;
    signs.theWarrior!.bonuses = [
      {
        bonusType: "trait",
        bonusTargetKey: "weakness",
        bonusParams: { wrong: 1 },
      },
    ];
    expect(await creator.quoteBirthsign(normal)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-content" }],
    });
    signs.theWarrior!.bonuses = [
      { bonusType: "trait", bonusTargetKey: "absent" },
    ];
    expect(await creator.quoteBirthsign(normal)).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-content" }],
    });
  });

  it("rejects invalid candidate input without reads or state changes", async () => {
    const { creator, catalog } = setup();
    const before = state(creator);
    expect(
      await creator.quoteBirthsign({ ...normal, signKey: " " }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-selection" }] });
    expect(
      await creator.quoteBirthsign({
        ...normal,
        variant: "wrong" as BirthsignSelection["variant"],
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-selection" }] });
    expect(catalog.getCalls).toEqual([]);
    expect(state(creator)).toBe(before);
  });

  it("invalidates success and failure after disposal", async () => {
    for (const fails of [false, true]) {
      const { creator, catalog } = setup();
      const gate = deferred();
      catalog.beforeGet = async () => gate.promise;
      const pending = creator.quoteBirthsign(normal);
      creator.dispose();
      const before = state(creator);
      if (fails) gate.reject(new Error("offline"));
      else gate.resolve();
      expect(await pending).toMatchObject({
        ok: false,
        issues: [{ code: "disposed" }],
      });
      expect(await creator.quoteBirthsign(normal)).toMatchObject({
        ok: false,
        issues: [{ code: "disposed" }],
      });
      expect(state(creator)).toBe(before);
    }
  });

  it("detaches packages, params, choices, sources, definitions and issues", async () => {
    const { creator, signs } = setup();
    signs.theWarrior!.bonuses = [
      {
        bonusType: "trait",
        bonusTargetKey: "weakness",
        bonusParams: { type: "magic", X: 2 },
      },
      { bonusType: "characteristic", bonusTargetKey: "lck", bonusValue: 1 },
      {
        bonusType: "extraLuckyNumber",
        count: 1,
        retainedRegardlessOfLuck: true,
      },
      {
        bonusType: "choice",
        lifecycle: { selection: "once" },
        choiceGroup: {
          id: "c",
          choose: 1,
          options: [
            {
              id: "yes",
              effects: [
                {
                  bonusType: "attribute",
                  bonusTargetKey: "speed",
                  bonusValue: 1,
                },
              ],
            },
          ],
        },
      },
    ];
    const answers = [{ choiceId: "theWarrior/c", selections: ["yes"] }];
    const first = value(await creator.quoteBirthsign(normal, answers));
    const expected = JSON.stringify(first);
    first.definition.label = "changed";
    Object.assign(first.effectivePackage!.traits[0]!.params!, { X: 99 });
    first.effectivePackage!.characteristicModifiers.lck![0]!.value = 99;
    first.effectivePackage!.extraLuckyNumbers[0]!.count = 99;
    first.choices[0]!.choiceGroup.options[0]!.id = "changed";
    first.issues[0]!.message = "changed";
    expect(
      JSON.stringify(value(await creator.quoteBirthsign(normal, answers))),
    ).toBe(expected);
    expect(answers[0]!.selections).toEqual(["yes"]);
  });
});
