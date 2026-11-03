import { describe, expect, it } from "vitest";
import { validateChoice } from "../src/wizards/validateChoice";

describe("shared choices", () => {
  const group = {
    id: "training",
    choose: 2,
    options: ["alchemy", "alteration", "conjuration"],
  };
  const answer = (selections: string[]) => ({ choiceId: group.id, selections });

  it("requires exactly choose distinct available options", () => {
    expect(validateChoice(group, answer(["alchemy", "alteration"]))).toEqual(
      [],
    );
    expect(validateChoice(group)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "selection-count" }),
      ]),
    );
    expect(
      validateChoice(group, answer(["alchemy", "alteration", "conjuration"])),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "selection-count" }),
      ]),
    );
    expect(validateChoice(group, answer(["alchemy", "alchemy"]))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate-selection" }),
      ]),
    );
    expect(validateChoice(group, answer(["alchemy", "unknown"]))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-option" }),
      ]),
    );
  });

  it.each([-1, 1.5, NaN, Infinity, 4])(
    "rejects an impossible choose value: %s",
    (choose) => {
      expect(validateChoice({ ...group, choose })).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid-choice-definition" }),
        ]),
      );
    },
  );

  it("rejects duplicate options and mismatched answer IDs", () => {
    expect(
      validateChoice({ ...group, options: ["alchemy", "alchemy"] }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-choice-definition" }),
      ]),
    );
    expect(
      validateChoice(group, {
        choiceId: "other",
        selections: ["alchemy", "alteration"],
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-option" }),
      ]),
    );
  });

  it("allows a zero-selection requirement", () => {
    expect(validateChoice({ id: "none", choose: 0, options: [] })).toEqual([]);
  });
});
