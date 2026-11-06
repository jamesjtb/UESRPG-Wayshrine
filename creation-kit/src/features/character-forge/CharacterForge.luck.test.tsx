import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import draftClasses from "./steps/characteristics/CharacteristicDraftPreview.module.css";
import {
  assignDraftResult,
  expandOptions,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

async function startLuck() {
  const user = userEvent.setup();
  const random = vi.fn(() => 0.45);
  const rollDice = vi.fn(createCharacteristicRoller(random));
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  renderForge(undefined, rollDice);
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await expandOptions(user);
  function generation() {
    return snapshots.mock.results.at(-1)!.value.characteristicGeneration;
  }
  async function rerollLuck() {
    await user.click(
      screen.getByRole("button", { name: "Rolled result for Luck" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  }
  async function selectOrdinary() {
    await user.click(
      within(screen.getByRole("group", { name: "Roll 1" })).getByRole("button"),
    );
  }
  return { user, random, rollDice, generation, rerollLuck, selectOrdinary };
}

function luckCells() {
  const table = within(
    screen.getByRole("table", { name: "Characteristic draft preview" }),
  );
  const row = table.getByRole("rowheader", { name: "Luck" }).closest("tr")!;
  return within(row).getAllByRole("cell");
}

function disabledLuckValue() {
  const control = screen.getByRole("button", {
    name: "Rolled result for Luck",
  });
  expect(control).toHaveProperty("disabled", true);
  expect(control.getAttribute("aria-haspopup")).toBeNull();
  return control;
}

it("rerolls table Luck immediately, preserving ordinary selections, pool and allowance", async () => {
  const { user, random, generation, rerollLuck, selectOrdinary } =
    await startLuck();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  expect(random).toHaveBeenCalledTimes(16);
  expect(screen.queryByRole("group", { name: "Luck roll" })).toBeNull();
  await user.click(disabledLuckValue());
  expect(screen.queryByRole("menuitem", { name: "Reroll" })).toBeNull();
  expect(random).toHaveBeenCalledTimes(16);
  expect(
    screen.getByRole("group", { name: "Characteristic rolls" }).children,
  ).toHaveLength(7);
  await selectOrdinary();
  await user.click(screen.getByRole("switch", { name: "Unlimited Rerolls" }));
  const before = generation();
  await rerollLuck();
  expect(random).toHaveBeenCalledTimes(18);
  expect(generation().drafts.rolled).toEqual(before.drafts.rolled);
  expect(generation().rerolls).toEqual(before.rerolls);
  expect(generation().drafts.luck!.id).toBe("roll-9");
  expect(screen.getByRole("button", { name: "Reroll" })).toHaveProperty(
    "disabled",
    false,
  );
  expect(
    screen.getByRole("group", { name: "Roll 1" }).hasAttribute("data-selected"),
  ).toBe(true);
  await user.click(screen.getByRole("button", { name: "Reroll" }));
  expect(random).toHaveBeenCalledTimes(20);
  expect(generation().drafts.rolled.rolls[0]!.id).toBe("roll-10");
  expect(generation().drafts.luck!.id).toBe("roll-9");
  expect(generation().rerolls.batchSpent).toBe(true);
  const spent = generation();
  await rerollLuck();
  expect(generation().rerolls).toEqual(spent.rerolls);
  expect(generation().drafts.rolled).toEqual(spent.drafts.rolled);
  await user.click(screen.getByRole("switch", { name: "Unlimited Rerolls" }));
  disabledLuckValue();
  expect(screen.getByRole("button", { name: "Reroll Used" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("clears hidden ordinary selections on assignment and returns unassigned results in pool order", async () => {
  const { user, generation, selectOrdinary } = await startLuck();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  await selectOrdinary();
  await assignDraftResult(user, "Strength", 0);
  expect(screen.queryByRole("group", { name: "Roll 1" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Reroll (0 of 3)" }),
  ).toHaveProperty("disabled", true);
  expect(generation().rerolls.batchSpent).toBe(false);
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Strength" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  await assignDraftResult(user, "Endurance", 0);
  expect(generation().drafts.rolled.assignments).toEqual({ end: "roll-1" });
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Endurance" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  const pool = screen.getByRole("group", { name: "Characteristic rolls" });
  expect(
    [...pool.children].map((element) =>
      element.querySelector('[role="group"]')?.getAttribute("aria-label"),
    ),
  ).toEqual(Array.from({ length: 7 }, (_, i) => `Roll ${i + 1}`));
  expect(
    screen.getByRole("group", { name: "Roll 1" }).hasAttribute("data-selected"),
  ).toBe(false);
  expect(
    screen.getByRole("button", { name: "Reroll (0 of 3)" }),
  ).toHaveProperty("disabled", true);
});

it("acquires initial Luck in point buy and rerolls it from the table without a result tile or batch button", async () => {
  const { user, random, generation, rerollLuck } = await startLuck();
  const method = screen.getByRole("switch", {
    name: "Use Optional Point Buy Rules",
  });
  await user.click(method);
  const points = screen.getByRole("textbox", { name: "Strength points" });
  await user.clear(points);
  await user.type(points, "12");
  const initial = within(luckCells()[1]!).getByRole("button", { name: "Roll" });
  expect(initial.classList.contains(draftClasses.contribution)).toBe(true);
  expect(screen.getAllByRole("button", { name: "Roll" })).toEqual([initial]);
  expect(luckCells()[2]!.textContent).toBe("30");
  const beforeInitial = generation();
  await user.click(initial);
  expect(random).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "Roll" })).toBeNull();
  expect(luckCells()[1]!.textContent).toBe("10");
  await user.click(disabledLuckValue());
  expect(screen.queryByRole("menuitem", { name: "Reroll" })).toBeNull();
  expect(random).toHaveBeenCalledTimes(2);
  expect(luckCells()[2]!.textContent).toBe("40");
  expect(generation().drafts.luck?.dice).toEqual([5, 5]);
  expect(generation().drafts.pointBuy).toEqual(beforeInitial.drafts.pointBuy);
  expect(generation().rerolls).toEqual(beforeInitial.rerolls);
  expect(
    within(
      screen.getByRole("table", { name: "Characteristic draft preview" }),
    ).getAllByRole("textbox", { name: / points$/ }),
  ).toHaveLength(7);
  expect(screen.queryByRole("group", { name: "Luck roll" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reroll" })).toBeNull();
  await user.click(screen.getByRole("switch", { name: "Unlimited Rerolls" }));
  const before = generation();
  await rerollLuck();
  expect(random).toHaveBeenCalledTimes(4);
  expect(points).toHaveProperty("value", "12");
  expect(generation().rerolls).toEqual(before.rerolls);
  expect(generation().drafts.pointBuy).toEqual(before.drafts.pointBuy);
  const luck = generation().drafts.luck;
  await user.click(method);
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  expect(random).toHaveBeenCalledTimes(18);
  expect(generation().drafts.luck).toEqual(luck);
});

it("keeps invalid initial point-buy Luck repairable inside its cell without enabling rerolls", async () => {
  const { user, rollDice, generation } = await startLuck();
  await user.click(
    screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  );
  const before = generation();
  rollDice.mockReturnValueOnce({ id: "invalid-luck", dice: [0, 11] });
  await user.click(
    within(luckCells()[1]!).getByRole("button", { name: "Roll" }),
  );
  expect(generation().drafts.luck?.id).toBe("invalid-luck");
  expect(within(luckCells()[1]!).getByRole("status").textContent).toContain(
    "Luck requires exactly two integer d10 faces",
  );
  expect(
    screen.queryByRole("button", { name: "Rolled result for Luck" }),
  ).toBeNull();
  expect(luckCells()[2]!.textContent).toBe("30");
  await user.click(
    within(luckCells()[1]!).getByRole("button", { name: "Roll" }),
  );
  expect(luckCells()[1]!.textContent).toBe("10");
  expect(luckCells()[2]!.textContent).toBe("40");
  expect(generation().rerolls).toEqual(before.rerolls);
  expect(generation().drafts.pointBuy).toEqual(before.drafts.pointBuy);
  expect(screen.queryByRole("button", { name: "Roll" })).toBeNull();
  disabledLuckValue();
});

it("shows rejected Luck commands inline and acquisition failures through the existing error seam", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { user, rollDice, generation, rerollLuck, selectOrdinary } =
    await startLuck();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  await selectOrdinary();
  await user.click(screen.getByRole("switch", { name: "Unlimited Rerolls" }));
  const before = generation();
  rollDice.mockReturnValueOnce({ id: "invalid", dice: [0, 11] });
  await rerollLuck();
  expect(
    screen.getByRole("group", { name: "Luck reroll feedback" }).textContent,
  ).toContain("Luck requires exactly two integer d10 faces");
  expect(generation()).toEqual(before);
  rollDice.mockImplementationOnce(() => {
    throw new Error("dice service offline");
  });
  await rerollLuck();
  expect(
    await screen.findByRole("dialog", { name: "Something went wrong!" }),
  ).toBeTruthy();
  expect(console.error).toHaveBeenCalled();
  expect(generation()).toEqual(before);
  await user.click(screen.getByRole("button", { name: "OK" }));
  expect(
    screen.getByRole("group", { name: "Roll 1" }).hasAttribute("data-selected"),
  ).toBe(true);
});
