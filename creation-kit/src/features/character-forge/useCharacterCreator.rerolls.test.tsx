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

it("acquires selected Luck with the pool and leaves both unchanged when either replacement is invalid", () => {
  const { result, drafts, rollDice } = setup();
  act(() => result.current.setUnlimitedCharacteristicRerolls(true));
  const before = drafts();
  rollDice.mockReturnValueOnce({ id: "valid-pool", dice: [2, 2] });
  rollDice.mockReturnValueOnce({ id: "bad-luck", dice: [0, 2] });
  act(() => {
    expect(
      result.current.rerollCharacteristics(["roll-1"], rollDice, true),
    ).toMatchObject({
      ok: false,
      issues: [{ field: "luck", code: "invalid-dice" }],
    });
  });
  expect(drafts()).toEqual(before);
  act(() => {
    expect(
      result.current.rerollCharacteristics(["roll-1"], rollDice, true)?.ok,
    ).toBe(true);
  });
  expect(drafts().rolled.rolls[0]!.id).toBe("roll-8");
  expect(drafts().luck!.id).toBe("roll-9");
});

it("checks current Core policy if unlimited is disabled during mixed dice acquisition", () => {
  const { result, drafts } = setup();
  act(() => result.current.setUnlimitedCharacteristicRerolls(true));
  const before = drafts();
  let calls = 0;
  function acquire() {
    calls += 1;
    result.current.setUnlimitedCharacteristicRerolls(false);
    return { id: `new-${calls}`, dice: [2, 2] };
  }
  act(() => {
    expect(
      result.current.rerollCharacteristics(["roll-1"], acquire, true),
    ).toMatchObject({
      ok: false,
      issues: [{ field: "luck", code: "reroll-unavailable" }],
    });
  });
  expect(drafts()).toEqual(before);
  expect(
    result.current.view!.snapshot.characteristicGeneration.rerolls.batchSpent,
  ).toBe(false);
});

it("does not submit partially acquired mixed dice when Luck acquisition throws", () => {
  const { result, drafts, rollDice } = setup();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  act(() => result.current.setUnlimitedCharacteristicRerolls(true));
  const before = drafts();
  rollDice.mockReturnValueOnce({ id: "valid-pool", dice: [2, 2] });
  rollDice.mockImplementationOnce(() => {
    throw new Error("Luck dice unavailable");
  });
  act(() => {
    expect(
      result.current.rerollCharacteristics(["roll-1"], rollDice, true),
    ).toBeUndefined();
  });
  expect(drafts()).toEqual(before);
  expect(result.current.view!.errorOpened).toBe(true);
  expect(error).toHaveBeenCalledOnce();
});

it("acquires one replacement per selected target and publishes Core's selective replacement and assignments", () => {
  const { result, rollDice, rolls, assignments, drafts } = setup();
  rollDice.mockReturnValueOnce({ id: "lower-result", dice: [1, 1] });
  const retainedCommand = result.current.rerollCharacteristics;
  act(() => {
    expect(retainedCommand([rolls[0]!.id, rolls[2]!.id], rollDice)?.ok).toBe(
      true,
    );
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
  expect(
    result.current.view!.snapshot.characteristicGeneration.rerolls.batchSpent,
  ).toBe(true);
  const final = drafts();
  act(() => {
    expect(retainedCommand(["lower-result"], rollDice)).toMatchObject({
      ok: false,
      issues: [{ code: "reroll-unavailable" }],
    });
    expect(result.current.submitCharacteristicRolls(rolls)).toMatchObject({
      ok: false,
      issues: [{ code: "pool-initialized" }],
    });
  });
  expect(drafts()).toEqual(final);
  expect(rollDice).toHaveBeenCalledTimes(10);
});

it("returns structured Core rejections without changing accepted answers and permits retry", () => {
  const { result, drafts, rollDice } = setup();
  const before = drafts();
  act(() =>
    expect(
      result.current.rerollCharacteristics(["roll-1"], () => ({
        id: "bad",
        dice: [0, 11],
      })),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "invalid-dice", field: "rolls", rollId: "bad" }],
    }),
  );
  expect(drafts()).toEqual(before);
  expect(result.current.view!.errorOpened).toBe(false);
  expect(
    result.current.view!.snapshot.characteristicGeneration.rerolls.batchSpent,
  ).toBe(false);
  act(() =>
    expect(result.current.rerollCharacteristics(["roll-1"], rollDice)?.ok).toBe(
      true,
    ),
  );
});

it("uses current Core policy for retained callbacks after the option changes", () => {
  const { result, drafts, rollDice } = setup();
  const reroll = result.current.rerollCharacteristics;
  act(() => {
    result.current.setUnlimitedCharacteristicRerolls(true);
    expect(
      reroll(
        drafts().rolled.rolls.map((roll) => roll.id),
        rollDice,
      )?.ok,
    ).toBe(true);
  });
  expect(rollDice).toHaveBeenCalledTimes(14);
  const before = drafts();
  act(() => {
    result.current.setUnlimitedCharacteristicRerolls(false);
    expect(reroll([drafts().rolled.rolls[0]!.id], rollDice)).toMatchObject({
      ok: false,
      issues: [{ code: "reroll-unavailable" }],
    });
  });
  expect(drafts()).toEqual(before);
  expect(
    result.current.view!.snapshot.characteristicGeneration.rerolls.batchSpent,
  ).toBe(true);
});

it("retains policy through methods, navigation, race changes and Luck edits, and resets only for a new session", async () => {
  const { result, rerender, rollDice, drafts } = setup();
  await act(async () => result.current.chooseRace("argonian"));
  act(() => {
    result.current.next();
    result.current.setUnlimitedCharacteristicRerolls(true);
    result.current.rerollCharacteristics(["roll-1"], rollDice);
    result.current.setCharacteristicGenerationMethod("point-buy");
    result.current.previous();
    result.current.submitLuckRoll({ id: "luck-2", dice: [10, 10] });
  });
  await act(async () => result.current.chooseRace("altmer"));
  act(() => result.current.setCharacteristicGenerationMethod("rolled"));
  expect(
    result.current.view!.snapshot.characteristicGeneration.rerolls,
  ).toMatchObject({
    unlimited: true,
    batchSpent: true,
  });
  expect(drafts().rolled.rolls[0]!.id).toBe("roll-8");
  expect(drafts().luck).toEqual({ id: "luck-2", dice: [10, 10] });
  const stale = result.current;
  rerender({ catalog: fixtureCatalog() });
  const fresh = result.current.view;
  act(() => {
    stale.setUnlimitedCharacteristicRerolls(true);
    expect(stale.rerollCharacteristics(["roll-2"], rollDice)).toBeUndefined();
  });
  expect(result.current.view).toBe(fresh);
  expect(fresh!.snapshot.characteristicGeneration.rerolls).toMatchObject({
    unlimited: false,
    batchSpent: false,
  });
  expect(drafts().rolled).toEqual({ rolls: [], assignments: {} });
  expect(rollDice).toHaveBeenCalledTimes(8);
});

it("reports acquisition exceptions through the existing error modal without publishing a partial batch", () => {
  const { result, drafts, rollDice } = setup();
  const before = drafts();
  const failure = new Error("dice service unavailable");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const acquire = vi
    .fn()
    .mockReturnValueOnce({ id: "new", dice: [1, 2] })
    .mockImplementationOnce(() => {
      throw failure;
    });
  act(() => {
    expect(
      result.current.rerollCharacteristics(["roll-1", "roll-2"], acquire),
    ).toBeUndefined();
  });
  expect(drafts()).toEqual(before);
  expect(result.current.view!.errorOpened).toBe(true);
  expect(log).toHaveBeenCalledWith(
    "Characteristic dice acquisition failed.",
    failure,
  );
  act(() => {
    result.current.dismissError();
    expect(result.current.rerollCharacteristics(["roll-1"], rollDice)?.ok).toBe(
      true,
    );
  });
  log.mockRestore();
});

it("ignores acquisition-error reporters retained from a replaced or unmounted session", () => {
  const { result, rerender, unmount } = setup();
  const staleReporter = result.current.reportDiceAcquisitionFailure;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  rerender({ catalog: fixtureCatalog() });
  const fresh = result.current.view;
  act(() => staleReporter(new Error("obsolete acquisition")));
  expect(result.current.view).toBe(fresh);
  expect(result.current.view!.errorOpened).toBe(false);
  const unmountedReporter = result.current.reportDiceAcquisitionFailure;
  unmount();
  act(() => unmountedReporter(new Error("unmounted acquisition")));
  expect(log).not.toHaveBeenCalled();
});

it("stops acquisition and ignores errors if the originating session is disposed during acquisition", () => {
  const { result, unmount, rollDice } = setup();
  const reroll = result.current.rerollCharacteristics;
  const acquire = vi.fn(() => {
    unmount();
    return rollDice();
  });
  act(() => {
    expect(reroll(["roll-1", "roll-2"], acquire)).toBeUndefined();
  });
  expect(acquire).toHaveBeenCalledTimes(1);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const disposed = setup();
  act(() => {
    expect(
      disposed.result.current.rerollCharacteristics(["roll-1"], () => {
        disposed.unmount();
        throw new Error("obsolete acquisition");
      }),
    ).toBeUndefined();
  });
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});
