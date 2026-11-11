import { describe, expect, it } from "vitest";
import { calculateCharacteristicScore } from "../src/index";

describe("calculateCharacteristicScore", () => {
  it.each([
    [0, 0, 0, 0],
    [0, 9, 9, 0],
    [27, 5, 32, 3],
    [30, 20, 50, 5],
    [90, 9, 99, 9],
    [90, 15, 105, 0],
  ])(
    "calculates baseline %i + generated %i",
    (baseline, rolled, total, bonus) => {
      expect(calculateCharacteristicScore({ baseline, rolled })).toEqual({
        total,
        bonus,
      });
    },
  );

  it("applies explicit modifiers but not favored flags, without mutation", () => {
    const characteristic = {
      baseline: 27,
      rolled: 5,
      favored: true,
      modifiers: [{ sourceId: "effect", sourceText: "Effect", value: 9 }],
    };
    const before = structuredClone(characteristic);
    expect(calculateCharacteristicScore(characteristic)).toEqual({
      total: 41,
      bonus: 4,
    });
    expect(characteristic).toEqual(before);
  });

  it("deducts purchase cost separately from inherent modifiers, allowing exactly zero", () => {
    expect(
      calculateCharacteristicScore({
        baseline: 30,
        rolled: 10,
        modifiers: [
          { sourceId: "sign/effect", sourceText: "Effect", value: -30 },
        ],
        purchaseCost: {
          sourceId: "sign/purchase",
          sourceText: "Purchase",
          value: 10,
        },
      }),
    ).toEqual({ total: 0, bonus: 0 });
  });
});
