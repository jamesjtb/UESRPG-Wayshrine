import { act, renderHook } from "@testing-library/react";
import { Characteristic } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { fixtureCatalog } from "./test/testCatalog";
import { useCharacterCreator } from "./useCharacterCreator";
import { createCharacteristicRoller } from "./steps/characteristics/dice";

function setup() {
  const hook = renderHook(({ catalog }) => useCharacterCreator(catalog), {
    initialProps: { catalog: fixtureCatalog() },
  });
  const rollDice = vi.fn(createCharacteristicRoller(() => 0.45));
  const rolls = Array.from({ length: 7 }, () => rollDice());
  const assignments = Object.fromEntries(
    Object.values(Characteristic).map((key, index) => [key, rolls[index]!.id]),
  );
  act(() => {
    hook.result.current.submitCharacteristicRolls(rolls);
    hook.result.current.setCharacteristicAssignments(assignments);
    hook.result.current.submitLuckRoll({ id: "luck", dice: [3, 4] });
  });
  function drafts() {
    return hook.result.current.view!.snapshot.characteristicGeneration.drafts;
  }
  return { ...hook, rollDice, rolls, assignments, drafts };
}

it("uses one batch even below the cap, replaces selected results finally, and restores only untouched assignments", () => {
  const { result, rollDice, rolls, assignments, drafts } = setup();
  rollDice.mockReturnValueOnce({ id: "lower-result", dice: [1, 1] });
  const retainedCommand = result.current.rerollCharacteristics;
  act(() => {
    expect(retainedCommand([rolls[0]!.id, rolls[2]!.id], rollDice)).toBe(true);
  });
  expect(drafts().rolled.rolls).toEqual([
    { id: "lower-result", dice: [1, 1] },
    rolls[1],
    { id: "roll-8", dice: [5, 5] },
    ...rolls.slice(3),
  ]);
  const { str: _str, ag: _ag, ...untouched } = assignments;
  expect(drafts().rolled.assignments).toEqual(untouched);
  expect(drafts().luck).toEqual({ id: "luck", dice: [3, 4] });
  expect(result.current.view!.rerollBatchSpent).toBe(true);
  const final = drafts();
  act(() => {
    expect(retainedCommand(["lower-result"], rollDice)).toBe(false);
    result.current.submitCharacteristicRolls(rolls);
  });
  expect(drafts()).toEqual(final);
  expect(rollDice).toHaveBeenCalledTimes(9);
});

it("rejects empty, duplicate, over-cap, unknown, and Luck selections without acquiring dice", () => {
  const { result, rollDice, drafts } = setup();
  const before = drafts();
  for (const ids of [
    [],
    ["roll-1", "roll-1"],
    ["roll-1", "roll-2", "roll-3", "roll-4"],
    ["missing"],
    ["luck"],
  ]) {
    act(() =>
      expect(result.current.rerollCharacteristics(ids, rollDice)).toBe(false),
    );
  }
  expect(rollDice).toHaveBeenCalledTimes(7);
  expect(drafts()).toEqual(before);
  expect(result.current.view!.rerollBatchSpent).toBe(false);
});

it("does not consume the batch or change answers for invalid acquisition or reused identities", () => {
  const { result, drafts, rollDice } = setup();
  const before = drafts();
  for (const replacement of [
    { id: "bad", dice: [0, 11] },
    { id: "roll-1", dice: [1, 1] },
    { id: "roll-2", dice: [1, 1] },
  ]) {
    act(() =>
      expect(
        result.current.rerollCharacteristics(["roll-1"], () => replacement),
      ).toBe(false),
    );
    expect(drafts()).toEqual(before);
    expect(result.current.view!.rerollBatchSpent).toBe(false);
  }
  act(() =>
    expect(
      result.current.rerollCharacteristics(["roll-1", "roll-2"], () => ({
        id: "duplicate",
        dice: [1, 1],
      })),
    ).toBe(false),
  );
  expect(drafts()).toEqual(before);
  act(() =>
    expect(result.current.rerollCharacteristics(["roll-1"], rollDice)).toBe(
      true,
    ),
  );
});

it("permits repeated unlimited batches of seven, but never replenishes the normal batch when switched off", () => {
  const { result, drafts, rollDice } = setup();
  // A retained callback must consult current session policy, not rendered flags.
  const reroll = result.current.rerollCharacteristics;
  act(() => result.current.setUnlimitedRerolls(true));
  for (let batch = 0; batch < 2; batch += 1) {
    act(() =>
      expect(
        reroll(
          drafts().rolled.rolls.map((roll) => roll.id),
          rollDice,
        ),
      ).toBe(true),
    );
    expect(drafts().rolled.assignments).toEqual({});
  }
  expect(rollDice).toHaveBeenCalledTimes(21);
  const before = drafts();
  act(() => {
    result.current.setUnlimitedRerolls(false);
    expect(reroll([drafts().rolled.rolls[0]!.id], rollDice)).toBe(false);
  });
  expect(drafts()).toEqual(before);
  expect(result.current.view!.rerollBatchSpent).toBe(true);
  act(() => {
    result.current.setUnlimitedRerolls(true);
    expect(reroll([drafts().rolled.rolls[0]!.id], rollDice)).toBe(true);
  });
});

it("retains policy through methods, navigation, race changes and Luck edits, and resets only for a new session", async () => {
  const { result, rerender, rollDice, drafts } = setup();
  await act(async () => result.current.chooseRace("argonian"));
  act(() => {
    result.current.next();
    result.current.setUnlimitedRerolls(true);
    result.current.rerollCharacteristics(["roll-1"], rollDice);
    result.current.setCharacteristicGenerationMethod("point-buy");
    result.current.previous();
    result.current.submitLuckRoll({ id: "luck-2", dice: [10, 10] });
  });
  await act(async () => result.current.chooseRace("altmer"));
  act(() => result.current.setCharacteristicGenerationMethod("rolled"));
  expect(result.current.view).toMatchObject({
    unlimitedRerolls: true,
    rerollBatchSpent: true,
  });
  expect(drafts().rolled.rolls[0]!.id).toBe("roll-8");
  expect(drafts().luck).toEqual({ id: "luck-2", dice: [10, 10] });
  const stale = result.current;
  rerender({ catalog: fixtureCatalog() });
  const fresh = result.current.view;
  act(() => {
    stale.setUnlimitedRerolls(true);
    expect(stale.rerollCharacteristics(["roll-2"], rollDice)).toBe(false);
  });
  expect(result.current.view).toBe(fresh);
  expect(fresh).toMatchObject({
    unlimitedRerolls: false,
    rerollBatchSpent: false,
  });
  expect(drafts().rolled).toEqual({ rolls: [], assignments: {} });
  expect(rollDice).toHaveBeenCalledTimes(8);
});

it("switching unlimited off without using a batch leaves the single normal batch available", () => {
  const { result, rollDice } = setup();
  act(() => {
    result.current.setUnlimitedRerolls(true);
    result.current.setUnlimitedRerolls(false);
    expect(result.current.rerollCharacteristics(["roll-1"], rollDice)).toBe(
      true,
    );
  });
});
