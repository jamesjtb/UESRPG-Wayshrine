import assert from "node:assert/strict";
import test from "node:test";
import {
  baseCharacteristicScoresSchema,
  calculatedAttributesSchema,
  calculatedPcAttributesSchema,
  calculatedPcCharacteristicsSchema,
  characteristicScoreSchema,
  currentPcResourcesSchema,
  currentResourcesSchema,
  favoredCharacteristicsSchema,
  pcAttributeModifierTotalsSchema,
  pcCharacteristicModifierTotalsSchema,
  pcCharacteristicScoresSchema,
  pcStatisticsSchema,
} from "../src/index.ts";

const baseScores = {
  strength: 40,
  endurance: 40,
  agility: 40,
  intelligence: 40,
  willpower: 40,
  perception: 40,
  personality: 40,
};

const pcScores = { ...baseScores, luck: 40 };
const resources = {
  healthPoints: -1,
  staminaPoints: -2,
  magickaPoints: -3,
  actionPoints: -4,
};
const attributes = {
  healthPointsMaximum: 20,
  staminaPointsMaximum: 4,
  magickaPointsMaximum: 40,
  actionPointsMaximum: 3,
  linguistics: 2,
  initiativeRating: 12,
  speed: 12,
  carryRating: 24,
};

test("scores accept zero and values above 50 or 99, but reject negatives and fractions", () => {
  for (const value of [0, 50, 123]) {
    assert.equal(characteristicScoreSchema.parse(value), value);
  }
  for (const value of [-1, 1.5, Infinity, NaN]) {
    assert.equal(characteristicScoreSchema.safeParse(value).success, false);
  }
  assert.equal(
    pcCharacteristicScoresSchema.parse({ ...pcScores, luck: 123 }).luck,
    123,
  );
});

test("shared characteristics exclude Luck and PCs require all eight scores", () => {
  assert.deepEqual(
    baseCharacteristicScoresSchema.parse(baseScores),
    baseScores,
  );
  assert.equal(
    baseCharacteristicScoresSchema.safeParse(pcScores).success,
    false,
  );
  assert.equal(
    pcCharacteristicScoresSchema.safeParse(baseScores).success,
    false,
  );
  assert.deepEqual(pcCharacteristicScoresSchema.parse(pcScores), pcScores);
  assert.equal(
    pcCharacteristicScoresSchema.safeParse({ ...pcScores, morale: 40 }).success,
    false,
  );
});

test("favored characteristics require two distinct PC keys, including Luck", () => {
  assert.deepEqual(favoredCharacteristicsSchema.parse(["strength", "luck"]), [
    "strength",
    "luck",
  ]);
  for (const value of [
    [],
    ["strength"],
    ["luck", "luck"],
    ["strength", "morale"],
    ["strength", "luck", "agility"],
  ]) {
    assert.equal(favoredCharacteristicsSchema.safeParse(value).success, false);
  }
});

test("calculated characteristics require every PC key", () => {
  const calculated = Object.fromEntries(
    Object.entries(pcScores).map(([key, base]) => [
      key,
      { base, effective: base, bonus: 4 },
    ]),
  );
  assert.deepEqual(
    calculatedPcCharacteristicsSchema.parse(calculated),
    calculated,
  );
  const { luck, ...withoutLuck } = calculated;
  assert.equal(
    calculatedPcCharacteristicsSchema.safeParse(withoutLuck).success,
    false,
  );
});

test("current resources accept negative integers and separate PC Luck points", () => {
  assert.deepEqual(currentResourcesSchema.parse(resources), resources);
  const pcResources = { ...resources, luckPoints: -5 };
  assert.deepEqual(currentPcResourcesSchema.parse(pcResources), pcResources);
  assert.equal(currentResourcesSchema.safeParse(pcResources).success, false);
  assert.equal(currentPcResourcesSchema.safeParse(resources).success, false);
  assert.equal(
    currentPcResourcesSchema.safeParse({ ...pcResources, healthPoints: 0.5 })
      .success,
    false,
  );
});

test("attributes allow absent WT, constrain Linguistics, and fix maximum AP at 3", () => {
  assert.deepEqual(calculatedAttributesSchema.parse(attributes), attributes);
  assert.equal(
    calculatedAttributesSchema.safeParse({ ...attributes, woundThreshold: 12 })
      .success,
    true,
  );
  for (const linguistics of [-1, 5, 1.5]) {
    assert.equal(
      calculatedAttributesSchema.safeParse({ ...attributes, linguistics })
        .success,
      false,
    );
  }
  for (const linguistics of [0, 4]) {
    assert.equal(
      calculatedAttributesSchema.safeParse({ ...attributes, linguistics })
        .success,
      true,
    );
  }
  assert.equal(
    calculatedAttributesSchema.safeParse({
      ...attributes,
      actionPointsMaximum: 4,
    }).success,
    false,
  );
});

test("PC attributes accept lucky counts above five and reject negative unlucky counts", () => {
  const pcAttributes = {
    ...attributes,
    luckPointsMaximum: 6,
    luckyNumberCount: 6,
    unluckyNumberCount: 0,
  };
  assert.deepEqual(
    calculatedPcAttributesSchema.parse(pcAttributes),
    pcAttributes,
  );
  assert.equal(
    calculatedAttributesSchema.safeParse(pcAttributes).success,
    false,
  );
  assert.equal(
    calculatedPcAttributesSchema.safeParse({
      ...pcAttributes,
      unluckyNumberCount: -1,
    }).success,
    false,
  );
});

test("modifier totals are sparse signed integers and cannot modify AP maximum", () => {
  assert.deepEqual(pcCharacteristicModifierTotalsSchema.parse({}), {});
  assert.deepEqual(pcCharacteristicModifierTotalsSchema.parse({ luck: -10 }), {
    luck: -10,
  });
  assert.deepEqual(
    pcAttributeModifierTotalsSchema.parse({
      staminaPointsMaximum: 2,
      luckPointsMaximum: -1,
    }),
    { staminaPointsMaximum: 2, luckPointsMaximum: -1 },
  );
  assert.equal(
    pcAttributeModifierTotalsSchema.safeParse({ actionPointsMaximum: 1 })
      .success,
    false,
  );
  assert.equal(
    pcCharacteristicModifierTotalsSchema.safeParse({ strength: 0.5 }).success,
    false,
  );
});

test("stored PC statistics exclude calculated results", () => {
  const statistics = {
    characteristics: pcScores,
    favoredCharacteristics: ["strength", "luck"],
    currentResources: { ...resources, luckPoints: -5 },
    experiencePoints: 0,
  };
  assert.deepEqual(pcStatisticsSchema.parse(statistics), statistics);
  assert.equal(
    pcStatisticsSchema.safeParse({
      ...statistics,
      calculatedAttributes: attributes,
    }).success,
    false,
  );
});
