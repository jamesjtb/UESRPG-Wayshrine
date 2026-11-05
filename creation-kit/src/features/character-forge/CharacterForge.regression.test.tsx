import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import {
  assignDraftResult,
  expectCharacteristic,
  expandOptions,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

it.each(["pool", "pool-luck", "point-buy"])(
  "reports initial %s dice acquisition failures without partial submission and permits retry",
  async (scenario) => {
    const user = userEvent.setup();
    const acquire = createCharacteristicRoller(() => 0.45);
    let calls = 0;
    const failureAt = scenario === "pool-luck" ? 8 : 1;
    const failure = new Error("dice source unavailable");
    const rollDice = vi.fn(() => {
      calls += 1;
      if (calls === failureAt) throw failure;
      return acquire();
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
    renderForge(undefined, rollDice);
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await user.click(screen.getByRole("button", { name: "Next" }));
    if (scenario === "point-buy") {
      await expandOptions(user);
      await user.click(
        screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
      );
    }
    const label =
      scenario === "point-buy" ? "Roll" : "Make Characteristic Roll";
    const before =
      snapshots.mock.results.at(-1)!.value.characteristicGeneration;
    await user.click(screen.getByRole("button", { name: label }));
    const error = await screen.findByRole("dialog", {
      name: "Something went wrong!",
    });
    expect(log).toHaveBeenCalledWith(
      "Characteristic dice acquisition failed.",
      failure,
    );
    expect(
      snapshots.mock.results.at(-1)!.value.characteristicGeneration,
    ).toEqual(before);
    await user.click(within(error).getByRole("button", { name: "OK" }));
    await user.click(screen.getByRole("button", { name: label }));
    const after = snapshots.mock.results.at(-1)!.value.characteristicGeneration;
    expect(after.drafts.luck?.dice).toEqual([5, 5]);
    expect(after.drafts.rolled.rolls).toHaveLength(
      scenario === "point-buy" ? 0 : 7,
    );
    expect(after.rerolls.batchSpent).toBe(false);
  },
);

it("handles the all-assigned zero-results panel and restores exactly the unassigned roll without spending a batch", async () => {
  const user = userEvent.setup();
  const rollDice = vi.fn(createCharacteristicRoller(() => 0.45));
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  renderForge(undefined, rollDice);
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  const labels = [
    "Strength",
    "Endurance",
    "Agility",
    "Intelligence",
    "Willpower",
    "Perception",
    "Personality",
  ];
  for (const [index, label] of labels.entries())
    await assignDraftResult(user, label, index);
  expectCharacteristic("Strength", {
    baseline: 25,
    generated: 10,
    favored: false,
    total: 35,
  });
  const pool = screen.getByRole("group", { name: "Characteristic rolls" });
  expect(within(pool).queryByRole("button")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Reroll (0 of 3)" }),
  ).toHaveProperty("disabled", true);
  await expandOptions(user);
  await user.click(screen.getByRole("switch", { name: "Unlimited Rerolls" }));
  expect(screen.getByRole("button", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  const before = snapshots.mock.results.at(-1)!.value.characteristicGeneration;
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Intelligence" }),
  );
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Unassign"]);
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  expectCharacteristic("Strength", {
    baseline: 25,
    generated: 0,
    favored: false,
    total: 25,
  });
  expectCharacteristic("Luck", {
    baseline: 30,
    generated: 10,
    favored: false,
    total: 40,
  });
  const draft = within(
    screen.getByRole("table", { name: "Characteristic draft preview" }),
  );
  const strengthRow = draft
    .getByRole("rowheader", { name: "Strength" })
    .closest("tr")!;
  expect(within(strengthRow).getAllByRole("cell")[1]!.textContent).toBe("10");
  expect(within(pool).getAllByRole("button")).toHaveLength(1);
  expect(
    within(pool)
      .getByRole("button", { name: "Roll 4, total 10" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(rollDice).toHaveBeenCalledTimes(8);
  const after = snapshots.mock.results.at(-1)!.value.characteristicGeneration;
  expect(after.drafts.rolled.rolls).toEqual(before.drafts.rolled.rolls);
  expect(after.rerolls).toEqual(before.rerolls);
  await assignDraftResult(user, "Intelligence", 3);
  expectCharacteristic("Strength", {
    baseline: 25,
    generated: 10,
    favored: false,
    total: 35,
  });
  expect(within(pool).queryByRole("button")).toBeNull();
  expect(
    snapshots.mock.results.at(-1)!.value.characteristicGeneration.drafts.rolled
      .assignments,
  ).toEqual(before.drafts.rolled.assignments);
});
