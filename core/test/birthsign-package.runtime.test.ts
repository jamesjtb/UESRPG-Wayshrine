import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";
import {
  CharacterCreator,
  ContentError,
  calculateBirthsignPackage,
  calculateCharacteristicScore,
  parseContentDefinition,
  type Birthsign,
  type ContentKind,
} from "../src/index";
import { completeGeneration } from "./support/CharacteristicGeneration";
import {
  creationCatalogs,
  deferred,
  TestContentCatalog,
} from "./support/ContentCatalog";

function authored<K extends ContentKind>(kind: K, domain: string) {
  const raw = z
    .record(z.string(), z.unknown())
    .parse(
      parse(
        readFileSync(
          new URL(`../content/${domain}/core.yml`, import.meta.url),
          "utf8",
        ),
      ),
    );
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      parseContentDefinition(kind, key, value),
    ]),
  );
}

function setup(signs = authored("birthsign", "birthsigns")) {
  const base = creationCatalogs().catalog.definitions;
  const catalog = new TestContentCatalog({
    ...base,
    birthsign: signs,
    trait: authored("trait", "traits"),
    power: authored("power", "powers"),
  });
  const creator = new CharacterCreator(catalog);
  return {
    creator,
    catalog,
    state: () => creator.getSnapshot().birthsignSelection,
  };
}

async function ready(creator: CharacterCreator) {
  completeGeneration(creator);
  await creator.chooseRace("argonian");
}

function luck(creator: CharacterCreator) {
  return calculateCharacteristicScore(
    creator.getCharacterPreview().characteristics.lck,
  ).total;
}

const expected = [
  ["theWarrior", {}, { str: 5, wp: -5 }, [], [], 1, 0, 1],
  ["theLady", { prs: 5 }, { prs: 5, end: 5, str: -5 }, [], [], 0, 0, 1],
  ["theSteed", {}, { ag: 5, wp: -5 }, [], [], 0, 2, 1],
  ["theLord", {}, { end: 5 }, [], [], 0, 0, 2],
  ["theMage", {}, { prc: -5 }, [], [], 0, 0, 1],
  ["theApprentice", {}, {}, [], [], 0, 0, 1],
  ["theAtronach", {}, { ag: -5 }, [], [], 0, 0, 1],
  [
    "theRitual",
    {},
    { lck: -5 },
    [],
    ["blessedTouch", "blessedWord", "marasGift"],
    0,
    0,
    1,
  ],
  ["theThief", {}, {}, [], ["akaviriDangerSense"], 0, 0, 1],
  ["theLover", { ag: 5 }, { ag: 5, prs: 5, wp: -5 }, [], [], 0, 0, 1],
  [
    "theShadow",
    {},
    { prc: 5, prs: -5 },
    ["moonshadow"],
    ["moonshadow"],
    0,
    0,
    1,
  ],
  [
    "theTower",
    { prc: 5 },
    { prc: 5, ag: 5, wp: -5 },
    ["treasureSeeker"],
    ["treasureSeeker"],
    0,
    0,
    1,
  ],
] as const;

describe("effective authored birthsign packages", () => {
  describe.each(expected)(
    "%s",
    (
      signKey,
      normalMods,
      starMods,
      normalPowers,
      starPowers,
      sp,
      speed,
      healing,
    ) => {
      it.each(["normal", "starCursed"] as const)(
        "projects %s, with all required choices resolved",
        async (variant) => {
          const { creator, state } = setup();
          await ready(creator);
          creator.setFreeBirthsignChoice(true);
          expect((await creator.chooseBirthsign({ signKey, variant })).ok).toBe(
            true,
          );
          for (const choice of state().choices) {
            if (choice.lifecycle.selection === "once") {
              expect(creator.getCharacterPreview().birthsign).toBeUndefined();
              creator.chooseBirthsignBonus(
                choice.choiceGroup.id,
                choice.choiceGroup.options
                  .slice(0, choice.choiceGroup.choose)
                  .map((option) => option.id),
              );
            }
          }
          expect(state().complete).toBe(true);
          expect(creator.finish().ok).toBe(true);
          const preview = creator.getCharacterPreview();
          expect(preview.birthsign).toEqual({ signKey, variant });
          const mods = Object.fromEntries(
            Object.entries(preview.characteristics)
              .filter(([, data]) => data.modifiers.length)
              .map(([key, data]) => [
                key,
                data.modifiers.reduce(
                  (sum, modifier) => sum + modifier.value,
                  0,
                ),
              ]),
          );
          expect(mods).toEqual(variant === "normal" ? normalMods : starMods);
          expect(preview.powers.map((power) => power.powerKey)).toEqual(
            variant === "normal" ? normalPowers : starPowers,
          );
          expect(
            preview.birthsignAdjustments.spMaximum.map(
              (modifier) => modifier.value,
            ),
          ).toEqual(sp ? [sp] : []);
          expect(
            preview.birthsignAdjustments.speed.map(
              (modifier) => modifier.value,
            ),
          ).toEqual(speed ? [speed] : []);
          expect(preview.birthsignAdjustments.naturalHealingMultiplier).toBe(
            healing,
          );
          expect(preview.attributes.sp.value).toBe(0);
          expect(preview.attributes.speed.value).toBe(0);
          expect(preview.attributes.luckyNumbers.value).toEqual([]);
          for (const power of preview.powers)
            expect(power.sourceId).toContain(`birthsign/${signKey}/`);
          for (const trait of preview.traits.filter(
            (trait) => trait.origin === "birthsign",
          ))
            expect(trait.sourceId).toContain(`birthsign/${signKey}/`);
        },
      );
    },
  );

  it("replaces trait parameter packages without combining same-key values or race sources", async () => {
    const { creator } = setup();
    await ready(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({
      signKey: "theApprentice",
      variant: "normal",
    });
    expect(
      creator
        .getCharacterPreview()
        .traits.filter((trait) => trait.origin === "birthsign")
        .map((trait) => trait.params),
    ).toEqual([{ X: 25 }, { type: "magic", X: 2 }]);
    await creator.chooseBirthsign({
      signKey: "theApprentice",
      variant: "starCursed",
    });
    const preview = creator.getCharacterPreview();
    expect(
      preview.traits
        .filter((trait) => trait.origin === "birthsign")
        .map((trait) => trait.params),
    ).toEqual([{ X: 50 }, { type: "magic", X: 3 }]);
    expect(preview.traits[0]).toEqual({
      traitKey: "amphibious",
      origin: "race",
    });
    await creator.chooseRace("altmer");
    await creator.chooseBirthsign({
      signKey: "theLord",
      variant: "starCursed",
    });
    expect(
      creator
        .getCharacterPreview()
        .traits.filter((trait) => trait.traitKey === "weakness"),
    ).toMatchObject([
      { origin: "race", params: { type: "magic", X: 2 } },
      {
        origin: "birthsign",
        params: { type: "fire", X: 2 },
        sourceId: "birthsign/theLord/starCursed/1",
      },
    ]);
  });

  it("withholds purchase cost and every benefit until penalties resolve; retains answers on revisit", async () => {
    const { creator, state } = setup();
    await ready(creator);
    await creator.submitBirthsignRoll({
      id: "sign",
      charge: "warrior",
      dice: [1],
    });
    await creator.chooseBirthsign({
      signKey: "theSteed",
      variant: "starCursed",
    });
    expect(state().purchaseCost).toBe(10);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    expect(luck(creator)).toBe(40);
    const id = state().choices[0]!.choiceGroup.id;
    for (const selections of [[], ["wp", "prc"], ["wp", "wp"], ["unknown"]]) {
      expect(creator.chooseBirthsignBonus(id, selections).ok).toBe(false);
      expect(creator.getCharacterPreview().birthsign).toBeUndefined();
      expect(luck(creator)).toBe(40);
    }
    expect(creator.chooseBirthsignBonus("unknown", ["wp"]).ok).toBe(false);
    expect(creator.chooseBirthsignBonus(id, ["wp"]).ok).toBe(true);
    expect(luck(creator)).toBe(30);
    expect(
      calculateCharacteristicScore(
        creator.getCharacterPreview().characteristics.ag,
      ).total,
    ).toBe(48);
    const first = creator.getCharacterPreview();
    await creator.chooseBirthsign({ signKey: "theSteed", variant: "normal" });
    expect(luck(creator)).toBe(35);
    expect(creator.getCharacterPreview().characteristics.wp.modifiers).toEqual(
      [],
    );
    await creator.chooseBirthsign({
      signKey: "theSteed",
      variant: "starCursed",
    });
    expect(creator.getCharacterPreview()).toEqual(first);
    await creator.restoreOriginalBirthsign();
    expect(luck(creator)).toBe(40);
    expect(
      creator.getCharacterPreview().characteristics.lck.purchaseCost,
    ).toBeUndefined();
    expect(creator.getCharacterPreview().birthsignAdjustments.speed).toEqual(
      [],
    );
  });

  it("revalidates retained stale answers and removes base choices in replacement variants", async () => {
    const sign: Birthsign = {
      label: "Test",
      description: "Test",
      bonuses: [
        {
          bonusType: "choice",
          lifecycle: { selection: "once" },
          choiceGroup: {
            id: "base",
            choose: 1,
            options: [
              {
                id: "str",
                effects: [
                  {
                    bonusType: "characteristic",
                    bonusTargetKey: "str",
                    bonusValue: 5,
                  },
                ],
              },
            ],
          },
        },
      ],
      starCursed: { overwriteBaseBonuses: true, bonuses: [] },
    };
    const { creator, state } = setup({ test: sign });
    await ready(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({ signKey: "test", variant: "normal" });
    creator.chooseBirthsignBonus("test/base", ["unknown"]);
    await creator.chooseBirthsign({ signKey: "test", variant: "starCursed" });
    expect(state().choices).toEqual([]);
    expect(state().complete).toBe(true);
    expect(creator.getCharacterPreview().characteristics.str.modifiers).toEqual(
      [],
    );
    await creator.chooseBirthsign({ signKey: "test", variant: "normal" });
    expect(state().choices[0]!.selections).toEqual(["unknown"]);
    expect(
      state().issues.some((issue) => issue.code === "invalid-option"),
    ).toBe(true);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    creator.chooseBirthsignBonus("test/base", ["str"]);
    expect(state().complete).toBe(true);
  });

  it("validates choose counts across independent once groups and detaches offered options", async () => {
    const choice = {
      bonusType: "choice",
      lifecycle: { selection: "once" },
      choiceGroup: {
        id: "two",
        choose: 2,
        options: [
          {
            id: "str",
            effects: [
              {
                bonusType: "characteristic",
                bonusTargetKey: "str",
                bonusValue: 5,
              },
            ],
          },
          {
            id: "end",
            effects: [
              {
                bonusType: "characteristic",
                bonusTargetKey: "end",
                bonusValue: -5,
              },
            ],
          },
        ],
      },
    } as const;
    const { creator, state } = setup({
      test: {
        label: "Test",
        description: "Test",
        bonuses: [choice],
        starCursed: {
          overwriteBaseBonuses: false,
          bonuses: [
            {
              ...choice,
              choiceGroup: { ...choice.choiceGroup, id: "one", choose: 1 },
            },
          ],
        },
      },
    });
    await ready(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({ signKey: "test", variant: "starCursed" });
    const snapshot = state();
    snapshot.choices[0]!.choiceGroup.options[0]!.id = "mutated";
    snapshot.choices[0]!.lifecycle.selection = "recurring";
    expect(state().choices[0]!.choiceGroup.options[0]!.id).toBe("str");
    expect(state().choices[0]!.lifecycle.selection).toBe("once");
    expect(creator.chooseBirthsignBonus("test/two", ["str"]).ok).toBe(false);
    expect(creator.chooseBirthsignBonus("test/two", ["str", "end"]).ok).toBe(
      false,
    ); // The other group is still unresolved.
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    expect(creator.chooseBirthsignBonus("test/one", ["end"]).ok).toBe(true);
    expect(
      creator
        .getCharacterPreview()
        .characteristics.end.modifiers.map((modifier) => modifier.value),
    ).toEqual([-5, -5]);
    const resolved = creator.getCharacterPreview();
    await creator.chooseBirthsign({ signKey: "test", variant: "normal" });
    expect(
      creator
        .getCharacterPreview()
        .characteristics.end.modifiers.map((modifier) => modifier.value),
    ).toEqual([-5]);
    await creator.chooseBirthsign({ signKey: "test", variant: "starCursed" });
    expect(creator.getCharacterPreview()).toEqual(resolved);
    creator.chooseBirthsignBonus("test/two", []);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
  });

  it("keeps recurring Ritual choices descriptive and not editable or blocking", async () => {
    const { creator, state } = setup();
    await ready(creator);
    await creator.submitBirthsignRoll({
      id: "ritual",
      charge: "mage",
      dice: [4],
    });
    expect(state().choices[0]!.lifecycle).toEqual({
      selection: "recurring",
      chooseAt: "longRest",
      expiresAt: "nextLongRest",
    });
    expect(state().complete).toBe(true);
    expect(
      creator.chooseBirthsignBonus(state().choices[0]!.choiceGroup.id, [
        "blessedTouch",
      ]).ok,
    ).toBe(false);
    expect(creator.getCharacterPreview().powers).toEqual([]);
    expect(creator.finish().ok).toBe(true);
  });

  it("replaces only projected rolled Luck for Star Thief and restores the accepted roll", async () => {
    const { creator, state } = setup();
    await ready(creator);
    await creator.submitBirthsignRoll({
      id: "thief",
      charge: "thief",
      dice: [1],
    });
    const generation = creator.getSnapshot().characteristicGeneration;
    await creator.chooseBirthsign({
      signKey: "theThief",
      variant: "starCursed",
    });
    expect(state().purchaseCost).toBe(5);
    expect(creator.getCharacterPreview().characteristics.lck).toMatchObject({
      baseline: 30,
      rolled: 50,
      purchaseCost: { value: 5 },
    });
    expect(luck(creator)).toBe(75);
    expect(
      creator.getCharacterPreview().birthsignAdjustments.extraLuckyNumbers,
    ).toMatchObject([{ count: 1, retainedRegardlessOfLuck: true }]);
    expect(creator.getSnapshot().characteristicGeneration).toEqual(generation);
    await creator.restoreOriginalBirthsign();
    expect(luck(creator)).toBe(40);
    expect(creator.getCharacterPreview().characteristics.lck.rolled).toBe(10);
    expect(creator.getSnapshot().characteristicGeneration).toEqual(generation);
  });
});

function costlySign(penalty: number): Birthsign {
  return {
    label: "Costly",
    description: "Test",
    bonuses: [],
    starCursed: {
      overwriteBaseBonuses: false,
      bonuses: [
        {
          bonusType: "characteristic",
          bonusTargetKey: "lck",
          bonusValue: penalty,
        },
      ],
    },
  };
}

describe("purchase affordability and lifecycle", () => {
  it("does not impose a negative-Luck prohibition on free inherent effects", async () => {
    const { creator, state } = setup({ costly: costlySign(-50) });
    await ready(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({ signKey: "costly", variant: "starCursed" });
    expect(state().complete).toBe(true);
    expect(luck(creator)).toBe(-10);
    expect(creator.finish().ok).toBe(true);
  });

  it("only projects the latest asynchronous package and evaluates current mode at commit", async () => {
    const { creator, catalog } = setup();
    await ready(creator);
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "birthsign" && key === "theShadow") await gate.promise;
    };
    const older = creator.chooseBirthsign({
      signKey: "theShadow",
      variant: "normal",
    });
    await creator.chooseBirthsign({
      signKey: "theRitual",
      variant: "starCursed",
    });
    expect(luck(creator)).toBe(25);
    gate.resolve();
    expect(await older).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(
      creator.getCharacterPreview().powers.map((power) => power.powerKey),
    ).toEqual(["blessedTouch", "blessedWord", "marasGift"]);
    const secondGate = deferred();
    catalog.beforeGet = async () => secondGate.promise;
    const next = creator.chooseBirthsign({
      signKey: "theThief",
      variant: "starCursed",
    });
    creator.setFreeBirthsignChoice(true);
    expect(creator.getCharacterPreview().powers).toEqual([]);
    secondGate.resolve();
    expect((await next).ok).toBe(true);
    expect(luck(creator)).toBe(80);
    expect(
      creator.getCharacterPreview().powers.map((power) => power.powerKey),
    ).toEqual(["akaviriDangerSense"]);
  });

  it.each([
    [-30, true, 0],
    [-31, false, 40],
  ] as const)(
    "inherent Luck %i permits purchase=%s",
    async (penalty, accepted, total) => {
      const { creator, state } = setup({ costly: costlySign(penalty) });
      await ready(creator);
      expect(
        (
          await creator.chooseBirthsign({
            signKey: "costly",
            variant: "starCursed",
          })
        ).ok,
      ).toBe(accepted);
      expect(luck(creator)).toBe(total);
      expect(state().selected?.signKey).toBe(accepted ? "costly" : undefined);
    },
  );

  it("counts Ritual's inherent -5 separately from its 10 purchase and leaves it in free choice", async () => {
    const { creator } = setup();
    await ready(creator);
    await creator.chooseBirthsign({
      signKey: "theRitual",
      variant: "starCursed",
    });
    expect(luck(creator)).toBe(25);
    expect(
      creator.getCharacterPreview().characteristics.lck.modifiers,
    ).toMatchObject([{ value: -5 }]);
    creator.setFreeBirthsignChoice(true);
    expect(luck(creator)).toBe(35);
    creator.setFreeBirthsignChoice(false);
    expect(luck(creator)).toBe(25);
    await creator.chooseBirthsign({ signKey: "theLady", variant: "normal" });
    expect(luck(creator)).toBe(35);
    expect(creator.getCharacterPreview().powers).toEqual([]);
  });

  it("exposes pending affordability until Luck exists and revalidates retained purchases after edits", async () => {
    const { creator, state } = setup({ costly: costlySign(-30) });
    await creator.chooseBirthsign({ signKey: "costly", variant: "starCursed" });
    expect(state().issues).toMatchObject([{ code: "affordability-pending" }]);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    await ready(creator);
    expect(state().complete).toBe(true);
    expect(luck(creator)).toBe(0);
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.submitLuckRoll({ id: "lower", dice: [1, 1] });
    expect(state().issues).toMatchObject([{ code: "unaffordable-selection" }]);
    expect(state().selected).toEqual({
      signKey: "costly",
      variant: "starCursed",
    });
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    expect(luck(creator)).toBe(32);
    expect(creator.finish().ok).toBe(false);
    creator.setFreeBirthsignChoice(true);
    expect(luck(creator)).toBe(2);
    expect(state().complete).toBe(true);
    expect(creator.setFreeBirthsignChoice(false).ok).toBe(false);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
  });

  it("evaluates async purchases against latest mode and generation, with no partial package", async () => {
    const { creator, catalog, state } = setup({
      costly: costlySign(-30),
      other: costlySign(0),
    });
    await ready(creator);
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "birthsign" && key === "costly") await gate.promise;
    };
    const pending = creator.chooseBirthsign({
      signKey: "costly",
      variant: "starCursed",
    });
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.submitLuckRoll({ id: "lower", dice: [1, 1] });
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "unaffordable-selection" }],
    });
    expect(state().selected).toBeUndefined();
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({ signKey: "costly", variant: "starCursed" });
    expect(luck(creator)).toBe(2);
  });

  it("suppresses committed grants during failed/pending intent and race changes; cancel restores", async () => {
    const { creator, catalog, state } = setup();
    await ready(creator);
    await creator.chooseBirthsign({ signKey: "theShadow", variant: "normal" });
    const before = creator.getCharacterPreview();
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseBirthsign({
      signKey: "theLady",
      variant: "normal",
    });
    expect(state().complete).toBe(false);
    expect(creator.getCharacterPreview().powers).toEqual([]);
    expect(luck(creator)).toBe(40);
    creator.cancelBirthsignSelection();
    expect(creator.getCharacterPreview()).toEqual(before);
    gate.reject(new ContentError("content-unavailable", "offline"));
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    catalog.beforeGet = async () => {
      throw new Error("offline");
    };
    await creator.chooseBirthsign({ signKey: "theLady", variant: "normal" });
    expect(creator.getCharacterPreview().powers).toEqual([]);
    expect(creator.finish().ok).toBe(false);
    creator.cancelBirthsignSelection();
    const race = creator.chooseRace("altmer");
    expect(
      state().issues.some((issue) => issue.code === "affordability-pending"),
    ).toBe(true);
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    await race;
    creator.cancelRaceSelection();
    expect(creator.getCharacterPreview()).toEqual(before);
  });

  it("retains ineligible free Star Thief with no grants or cost when standard mode returns", async () => {
    const { creator, state } = setup();
    await ready(creator);
    await creator.submitBirthsignRoll({
      id: "warrior",
      charge: "warrior",
      dice: [1],
    });
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({
      signKey: "theThief",
      variant: "starCursed",
    });
    expect(luck(creator)).toBe(80);
    creator.setFreeBirthsignChoice(false);
    expect(state().purchaseCost).toBeUndefined();
    expect(state().selected?.signKey).toBe("theThief");
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    expect(luck(creator)).toBe(40);
    creator.setFreeBirthsignChoice(true);
    expect(luck(creator)).toBe(80);
  });

  it("guards all three steps, preserves answers, and blocks finish when earlier steps invalidate", async () => {
    const { creator, state } = setup();
    expect(creator.finish().ok).toBe(false);
    await ready(creator);
    expect(creator.getSnapshot().canFinish).toBe(false);
    expect(creator.next().ok).toBe(true);
    expect(creator.next().ok).toBe(true);
    expect(creator.getSnapshot().currentStep).toBe("birthsign");
    expect(creator.finish().ok).toBe(false);
    await creator.submitBirthsignRoll({
      id: "steed",
      charge: "warrior",
      dice: [5, 3],
    });
    expect(creator.finish().ok).toBe(false);
    creator.chooseBirthsignBonus(state().choices[0]!.choiceGroup.id, ["wp"]);
    expect(creator.finish().ok).toBe(true);
    const generation = creator.getSnapshot().characteristicGeneration;
    creator.setCharacteristicAllocations({});
    expect(creator.getSnapshot().currentStep).toBe("birthsign");
    expect(creator.finish().ok).toBe(false);
    creator.setCharacteristicAllocations(
      generation.drafts.pointBuy.allocations,
    );
    expect(creator.finish().ok).toBe(true);
    await creator.chooseRace("altmer");
    expect(creator.finish().ok).toBe(false);
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(creator.finish().ok).toBe(true);
    creator.previous();
    creator.previous();
    expect(creator.finish().ok).toBe(true);
    expect(creator.getSnapshot().characteristicGeneration).toEqual(generation);
  });

  it("detaches snapshots, calculations and results, isolates sessions, and disposes pending grants", async () => {
    const { creator, catalog, state } = setup();
    await ready(creator);
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign({
      signKey: "theApprentice",
      variant: "starCursed",
    });
    const snapshot = state();
    const result = calculateBirthsignPackage({
      selection: snapshot.selected!,
      definition: snapshot.definition!,
      answers: snapshot.answers,
    });
    if (!result.ok) throw new Error("Expected package");
    result.value.traits[0]!.traitKey = "mutated";
    snapshot.definition!.bonuses = [];
    const finished = creator.finish();
    if (!finished.ok) throw new Error("Expected character");
    finished.value.traits[1]!.traitKey = "mutated";
    expect(creator.getCharacterPreview().traits[1]!.traitKey).toBe("powerWell");
    const second = new CharacterCreator(catalog);
    expect(second.getSnapshot().birthsignSelection.selected).toBeUndefined();
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseBirthsign({
      signKey: "theLady",
      variant: "normal",
    });
    creator.dispose();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getCharacterPreview().birthsign).toBeUndefined();
    expect(state().answers).toEqual([]);
    expect(creator.chooseBirthsignBonus("x", []).ok).toBe(false);
    expect(second.getSnapshot().birthsignSelection.issues).toMatchObject([
      { code: "birthsign-required" },
    ]);
  });
});
