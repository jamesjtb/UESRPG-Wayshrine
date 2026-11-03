import { describe, expect, it } from "vitest";
import {
  calculateCharacteristicGeneration,
  Characteristic,
  PcCharacteristic,
  validateCharacteristicGeneration,
} from "../src/index";
import type { CharacteristicGenerationAnswer } from "../src/index";
import PcCharacterData from "../src/data/CharacterData";

type RolledAnswer = Extract<
  CharacteristicGenerationAnswer,
  { method: "rolled" }
>;
type PointBuyAnswer = Extract<
  CharacteristicGenerationAnswer,
  { method: "point-buy" }
>;

function rolledAnswer(): RolledAnswer {
  return {
    method: "rolled",
    favored: [Characteristic.Str, Characteristic.Int],
    luck: { id: "luck", dice: [10, 10] },
    rolls: Object.values(Characteristic).map((key, index) => ({
      id: `roll-${key}`,
      dice: [index + 1, 10],
    })),
    assignments: {
      str: "roll-prs",
      end: "roll-end",
      ag: "roll-ag",
      int: "roll-int",
      wp: "roll-wp",
      prc: "roll-prc",
      prs: "roll-str",
    },
  };
}

function pointBuyAnswer(): PointBuyAnswer {
  return {
    method: "point-buy",
    favored: [Characteristic.End, Characteristic.Wp],
    luck: { id: "luck", dice: [1, 1] },
    allocations: { str: 20, end: 20, ag: 20, int: 10, wp: 10, prc: 0, prs: 0 },
  };
}

function codes(answer?: CharacteristicGenerationAnswer) {
  return validateCharacteristicGeneration(answer).map((issue) => issue.code);
}

describe("characteristic generation", () => {
  it("projects separately identified rolls by assignment, not submission order", () => {
    const answer = rolledAnswer();
    const before = structuredClone(answer);
    expect(validateCharacteristicGeneration(answer)).toEqual([]);
    const result = calculateCharacteristicGeneration(answer);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected a valid roll answer");
    expect(result.value).toEqual({
      str: { rolled: 17, favored: true },
      end: { rolled: 12, favored: false },
      ag: { rolled: 13, favored: false },
      int: { rolled: 14, favored: true },
      wp: { rolled: 15, favored: false },
      prc: { rolled: 16, favored: false },
      prs: { rolled: 11, favored: false },
      lck: { rolled: 20, favored: false },
    });
    expect(answer).toEqual(before);
  });

  it("projects point buy into rolled fields without changing baselines or modifiers", () => {
    const character = new PcCharacterData();
    character.updateCharacteristic(Characteristic.Str, {
      baseline: 25,
      modifiers: [{ sourceId: "test", sourceText: "Test", value: 5 }],
    });
    const result = calculateCharacteristicGeneration(pointBuyAnswer());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected valid point buy");
    for (const key of Object.values(PcCharacteristic)) {
      character.updateCharacteristic(key, result.value[key]);
    }
    expect(character.characteristics.str).toMatchObject({
      baseline: 25,
      rolled: 20,
    });
    expect(character.characteristics.str.modifiers).toHaveLength(1);
    expect(character.characteristics.prs.rolled).toBe(0);
    expect(character.characteristics.end.favored).toBe(true);
    expect(character.characteristics.lck).toMatchObject({
      baseline: 30,
      rolled: 2,
      favored: false,
    });
    expect(
      character.characteristics.lck.baseline +
        character.characteristics.lck.rolled,
    ).toBe(32);
  });

  it("keeps Luck at baseline 30 plus only the dice total, capped at 50", () => {
    const character = new PcCharacterData();
    expect(character.characteristics.lck.baseline).toBe(30);
    expect(character.characteristics.lck.rolled).toBe(0);
    const result = calculateCharacteristicGeneration(rolledAnswer());
    if (!result.ok) throw new Error("Expected valid generation");
    expect(
      character.characteristics.lck.baseline + result.value.lck.rolled,
    ).toBe(50);
  });

  it("returns structured issues, not a projection, for incomplete answers", () => {
    expect(codes()).toEqual(
      expect.arrayContaining([
        "generation-method",
        "favored-count",
        "invalid-dice",
      ]),
    );
    expect(codes({ method: "rolled" })).toContain("roll-count");
    expect(codes({ method: "rolled" })).toContain("invalid-assignment");
    expect(codes({ method: "point-buy" })).toContain("invalid-allocation");
    expect(calculateCharacteristicGeneration()).toMatchObject({
      ok: false,
      issues: expect.any(Array),
    });
  });

  it("rejects unsupported methods and runtime values that are not numbers", () => {
    expect(
      codes({
        ...pointBuyAnswer(),
        // @ts-expect-error The host may send an unsupported method at runtime.
        method: "other",
      }),
    ).toContain("generation-method");
    expect(
      codes({
        ...pointBuyAnswer(),
        allocations: {
          ...pointBuyAnswer().allocations,
          // @ts-expect-error Numeric strings must not be coerced into point allocations.
          str: "20",
        },
      }),
    ).toContain("invalid-allocation");
    expect(
      codes({
        ...rolledAnswer(),
        luck: {
          id: "luck",
          dice: [
            // @ts-expect-error Numeric strings must not be coerced into die faces.
            "1",
            10,
          ],
        },
      }),
    ).toContain("invalid-dice");
  });

  it("allows equal totals from seven separately identified rolls", () => {
    const answer = rolledAnswer();
    expect(
      codes({
        ...answer,
        rolls: answer.rolls!.map((roll) => ({ ...roll, dice: [5, 5] })),
      }),
    ).toEqual([]);
  });

  it("requires exactly two distinct non-Luck favored characteristics", () => {
    expect(
      codes({ ...rolledAnswer(), favored: [Characteristic.Str] }),
    ).toContain("favored-count");
    expect(
      codes({
        ...rolledAnswer(),
        favored: [Characteristic.Str, Characteristic.Str],
      }),
    ).toContain("duplicate-favored");
    expect(
      codes({
        ...rolledAnswer(),
        favored: [Characteristic.Str, Characteristic.Int, Characteristic.Wp],
      }),
    ).toContain("favored-count");
    expect(
      codes({
        ...rolledAnswer(),
        favored: [
          Characteristic.Str,
          // @ts-expect-error Runtime validation also rejects Luck as a favored key.
          PcCharacteristic.Lck,
        ],
      }),
    ).toContain("invalid-favored");
  });

  it.each([NaN, Infinity, -Infinity, 0, -1, 11, 1.5])(
    "rejects invalid d10 faces: %s",
    (face) => {
      const answer = rolledAnswer();
      expect(
        codes({ ...answer, luck: { id: "luck", dice: [face, 1] } }),
      ).toContain("invalid-dice");
      expect(
        codes({
          ...answer,
          rolls: [{ id: "bad", dice: [1, face] }, ...answer.rolls!.slice(1)],
        }),
      ).toContain("invalid-dice");
    },
  );

  it.each([[], [1], [1, 2, 3], new Array<number>(2)].map((dice) => ({ dice })))(
    "rejects incomplete or extra dice: %j",
    ({ dice }) => {
      expect(
        codes({ ...rolledAnswer(), luck: { id: "luck", dice } }),
      ).toContain("invalid-dice");
    },
  );

  it("rejects missing, duplicate, or extra rolls and missing roll identities", () => {
    const answer = rolledAnswer();
    expect(codes({ ...answer, rolls: answer.rolls!.slice(1) })).toContain(
      "roll-count",
    );
    expect(
      codes({
        ...answer,
        rolls: [...answer.rolls!, { id: "extra", dice: [1, 1] }],
      }),
    ).toContain("roll-count");
    expect(
      codes({
        ...answer,
        rolls: [answer.rolls![0]!, ...answer.rolls!.slice(0, 6)],
      }),
    ).toContain("roll-identity");
    expect(codes({ ...answer, luck: { id: " ", dice: [1, 1] } })).toContain(
      "roll-identity",
    );
  });

  it("requires a bijection between seven roll IDs and seven shared keys", () => {
    const answer = rolledAnswer();
    const { str, ...missingAssignment } = answer.assignments!;
    expect(codes({ ...answer, assignments: missingAssignment })).toContain(
      "invalid-assignment",
    );
    expect(
      codes({
        ...answer,
        assignments: { ...answer.assignments, str: "unknown" },
      }),
    ).toContain("invalid-assignment");
    expect(
      codes({
        ...answer,
        assignments: { ...answer.assignments, str: "roll-end" },
      }),
    ).toContain("invalid-assignment");
    expect(
      codes({
        ...answer,
        assignments: {
          ...answer.assignments,
          // @ts-expect-error Luck cannot consume a shared roll.
          lck: "luck",
        },
      }),
    ).toContain("invalid-assignment");
  });

  it.each([NaN, Infinity, -Infinity, -1, 21, 1.5])(
    "rejects invalid point allocations: %s",
    (value) => {
      const answer = pointBuyAnswer();
      expect(
        codes({
          ...answer,
          allocations: { ...answer.allocations, str: value },
        }),
      ).toContain("invalid-allocation");
    },
  );

  it("requires all seven allocations, no Luck allocation, and exactly 80 points", () => {
    const answer = pointBuyAnswer();
    const { str, ...missingAllocation } = answer.allocations!;
    expect(codes({ ...answer, allocations: missingAllocation })).toContain(
      "invalid-allocation",
    );
    expect(
      codes({ ...answer, allocations: { ...answer.allocations, str: 19 } }),
    ).toContain("point-budget");
    expect(
      codes({ ...answer, allocations: { ...answer.allocations, prs: 1 } }),
    ).toContain("point-budget");
    expect(
      codes({
        ...answer,
        allocations: {
          ...answer.allocations,
          // @ts-expect-error Luck is rolled separately, never purchased.
          lck: 0,
        },
      }),
    ).toContain("invalid-allocation");
  });

  it("recalculates replaced submissions without retaining previous roll results", () => {
    const answer = rolledAnswer();
    const first = calculateCharacteristicGeneration(answer);
    const replaced = calculateCharacteristicGeneration({
      ...answer,
      rolls: answer.rolls!.map((roll) =>
        roll.id === "roll-prs" ? { ...roll, dice: [1, 1] } : roll,
      ),
      luck: { id: "luck", dice: [1, 2] },
    });
    if (!first.ok || !replaced.ok)
      throw new Error("Expected valid submissions");
    expect(first.value.str.rolled).toBe(17);
    expect(replaced.value.str.rolled).toBe(2);
    expect(replaced.value.lck.rolled).toBe(3);
  });
});
