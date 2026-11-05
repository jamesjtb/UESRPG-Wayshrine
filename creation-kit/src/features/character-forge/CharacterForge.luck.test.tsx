import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import { renderForge, selectRace, sheet } from "./test/forgeTestHelpers";

async function startLuck() {
  const user = userEvent.setup();
  const random = vi.fn(() => 0.45);
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  renderForge(undefined, createCharacteristicRoller(random));
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  function generation() {
    return snapshots.mock.results.at(-1)!.value.characteristicGeneration;
  }
  async function selectLuck() {
    await user.click(screen.getByRole("button", { name: "Actions for Luck" }));
    await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  }
  return { user, random, generation, selectLuck };
}

it("selects Luck with ordinary results for one atomic action, then permits Luck-only rerolls without spending another batch", async () => {
  const { user, random, generation, selectLuck } = await startLuck();
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(random).toHaveBeenCalledTimes(16);
  const before = generation();
  expect(screen.queryByRole("heading", { name: "Luck" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions for Luck" }));
  expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.queryByRole("menuitem", { name: "Unassign" })).toBeNull();
  expect(screen.queryByText("Assign To")).toBeNull();
  await user.keyboard("{Escape}");
  const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
  await user.click(unlimited);
  await selectLuck();
  const firstRoll = within(screen.getByRole("group", { name: "Roll 1" }));
  await user.click(
    firstRoll.getByRole("button", { name: "Actions for result: 10" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  await user.click(screen.getByRole("button", { name: "Reroll" }));
  expect(random).toHaveBeenCalledTimes(20);
  expect(generation().drafts.rolled.rolls[0]!.id).toBe("roll-9");
  expect(generation().drafts.luck!.id).toBe("roll-10");
  expect(generation().drafts.rolled.rolls.slice(1)).toEqual(
    before.drafts.rolled.rolls.slice(1),
  );
  const pool = generation().drafts.rolled;
  await selectLuck();
  await user.click(screen.getByRole("button", { name: "Reroll" }));
  expect(generation().drafts.rolled).toEqual(pool);
  expect(generation().drafts.luck!.id).toBe("roll-11");
  await selectLuck();
  await user.click(unlimited);
  expect(
    screen.getByRole("button", { name: "Actions for Luck" }).textContent,
  ).toBe("Luck");
  expect(screen.getByRole("button", { name: "Reroll Used" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(random).toHaveBeenCalledTimes(22);
  await user.click(unlimited);
  expect(screen.getByRole("button", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("drops only Luck from a mixed selection when unlimited is disabled, then rerolls the ordinary selection normally", async () => {
  const { user, random, generation, selectLuck } = await startLuck();
  await user.click(screen.getByRole("button", { name: "Roll" }));
  const luck = generation().drafts.luck;
  const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
  await user.click(unlimited);
  await selectLuck();
  await user.click(
    within(screen.getByRole("group", { name: "Roll 1" })).getByRole("button", {
      name: "Actions for result: 10",
    }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  await user.click(unlimited);
  expect(
    screen.getByRole("button", { name: "Actions for Luck" }).textContent,
  ).toBe("Luck");
  const action = screen.getByRole("button", { name: "Reroll (1 of 3)" });
  expect(action).toHaveProperty("disabled", false);
  await user.click(action);
  expect(random).toHaveBeenCalledTimes(18);
  expect(generation().drafts.luck).toEqual(luck);
  expect(generation().rerolls.batchSpent).toBe(true);
});

it("uses the same Luck selection and action in point buy, retaining allocations, shared Luck and the initial combined-roll behavior", async () => {
  const { user, random, generation, selectLuck } = await startLuck();
  const method = screen.getByRole("switch", {
    name: "Use Optional Point Buy Rules",
  });
  const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
  await user.click(method);
  const points = screen.getByRole("textbox", { name: "Strength points" });
  await user.clear(points);
  await user.type(points, "12");
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(random).toHaveBeenCalledTimes(2);
  const row = screen.getByRole("group", { name: "Point-buy characteristics" });
  expect(row.lastElementChild).toBe(
    screen.getByRole("group", { name: "Luck roll" }),
  );
  expect(screen.getByRole("button", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(unlimited);
  await selectLuck();
  await user.click(unlimited);
  expect(screen.getByRole("button", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(unlimited);
  await selectLuck();
  await user.click(screen.getByRole("button", { name: "Reroll" }));
  expect(random).toHaveBeenCalledTimes(4);
  expect(points).toHaveProperty("value", "12");
  expect(generation().rerolls.batchSpent).toBe(false);
  const luck = generation().drafts.luck;
  await user.click(method);
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(random).toHaveBeenCalledTimes(18);
  expect(generation().drafts.luck).toEqual(luck);
  expect(
    screen.getByRole("group", { name: "Characteristic rolls" })
      .lastElementChild,
  ).toBe(screen.getByRole("group", { name: "Luck roll" }));
  await user.click(method);
  expect(
    screen.getByRole("textbox", { name: "Strength points" }),
  ).toHaveProperty("value", "12");
});
