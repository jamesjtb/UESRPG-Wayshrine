import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import { characteristicLabels } from "./steps/characteristics/characteristicLabels";
import {
  controlledReads,
  renderForge,
  selectRace,
  sheet,
  expectCharacteristic,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";

type User = ReturnType<typeof userEvent.setup>;

async function startGeneration(random: () => number) {
  const user = userEvent.setup();
  const catalog = fixtureCatalog();
  const reads = controlledReads(catalog);
  const race = reads.hold("race", "argonian");
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  renderForge(catalog, createCharacteristicRoller(random));
  await selectRace("Argonian");
  await act(async () => race.resolve());
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));

  function snapshot() {
    return snapshots.mock.results.at(-1)!.value;
  }

  return { user, snapshot };
}

function poolTile(index: number) {
  return screen.getByRole("button", {
    name: new RegExp(`^Roll ${index + 1}, total `),
  });
}

function poolAction(index: number) {
  return within(
    screen.getByRole("group", { name: `Roll ${index + 1}` }),
  ).getByRole("button", { name: /^Actions for result: \d+$/ });
}

async function toggleReroll(user: User, index: number, selected = false) {
  await user.click(poolAction(index));
  await user.click(
    screen.getByRole("menuitem", {
      name: selected ? "Don't reroll" : "Reroll",
    }),
  );
}

function poolRollButton(name: "Roll" | "Reroll" = "Roll") {
  return within(
    screen.getByRole("group", { name: "Rolled characteristics" }),
  ).getByRole("button", {
    name: name === "Reroll" ? /^Reroll(?: \(\d of 3\)| Used)?$/ : name,
  });
}

function luckRollButton(name: "Roll" | "Reroll" = "Roll") {
  return within(screen.getByRole("group", { name: "Luck roll" })).getByRole(
    "button",
    { name },
  );
}

async function chooseRoll(user: User, label: string, index: number) {
  await user.click(poolAction(index));
  await user.click(menuCharacteristic(label));
}

function menuCharacteristic(label: string) {
  return screen.getByRole("menuitem", { name: label });
}

async function unassignRoll(user: User, index: number) {
  await user.click(poolAction(index));
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  expect(screen.queryByRole("menu")).toBeNull();
}

async function assignPool(user: User) {
  const labels = Object.values(characteristicLabels);
  for (let index = 0; index < labels.length; index += 1) {
    await chooseRoll(user, labels[index]!, index);
  }
}

async function favorStrengthAndEndurance(user: User) {
  await user.click(screen.getByRole("checkbox", { name: "Strength" }));
  await user.click(screen.getByRole("checkbox", { name: "Endurance" }));
}

async function enterPoints(user: User, label: string, value: string) {
  const input = screen.getByRole("textbox", { name: `${label} points` });
  await user.clear(input);
  if (value !== "") await user.type(input, value);
  await user.tab();
  return input;
}

describe("Character Forge generation inputs", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("keeps over-limit selections removable when unlimited is switched off before any batch", async () => {
    const random = vi.fn(() => 0.45);
    const { user } = await startGeneration(random);
    await user.click(poolRollButton());
    const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
    await user.click(unlimited);
    for (let index = 1; index <= 4; index += 1) {
      await toggleReroll(user, index - 1);
    }
    await user.click(unlimited);
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", true);
    expect(poolRollButton("Reroll").textContent).toBe("Reroll (4 of 3)");
    await toggleReroll(user, 0, true);
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", false);
    await user.click(poolRollButton("Reroll"));
    expect(random).toHaveBeenCalledTimes(20);
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", true);
    expect(poolRollButton("Reroll").textContent).toBe("Reroll Used");
  });

  it("allows repeated unlimited seven-result batches and retains spent policy through modal dismissal and method/navigation changes", async () => {
    const random = vi.fn(() => 0.45);
    const { user, snapshot } = await startGeneration(random);
    const unlimited = () =>
      screen.getByRole("switch", { name: "Unlimited Rerolls" });
    expect(unlimited()).toHaveProperty("checked", false);
    await user.click(poolRollButton());
    await user.click(unlimited());
    expect(screen.queryByText(/Use ACTION/)).toBeNull();
    expect(screen.queryByText(/\d of \d selected/)).toBeNull();
    for (let batch = 0; batch < 2; batch += 1) {
      for (let index = 1; index <= 7; index += 1) {
        await toggleReroll(user, index - 1);
      }
      expect(poolRollButton("Reroll").textContent).toBe("Reroll");
      await user.click(poolRollButton("Reroll"));
      expect(poolRollButton("Reroll").textContent).toBe("Reroll");
      expect(poolRollButton("Reroll")).toHaveProperty("disabled", true);
    }
    expect(random).toHaveBeenCalledTimes(42);
    const rolls = snapshot().characteristicGeneration.drafts.rolled.rolls;
    await user.click(
      screen.getByRole("button", { name: "Close character creation" }),
    );
    await user.click(screen.getByRole("button", { name: "Create Character" }));
    expect(unlimited()).toHaveProperty("checked", true);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(unlimited()).toHaveProperty("checked", true);
    await user.click(unlimited());
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", true);
    await user.click(poolAction(0));
    expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
      "disabled",
      true,
    );
    await user.keyboard("{Escape}");
    expect(snapshot().characteristicGeneration.drafts.rolled.rolls).toEqual(
      rolls,
    );
    expect(random).toHaveBeenCalledTimes(42);
    expect(poolRollButton("Reroll").textContent).toBe("Reroll Used");
    await user.click(unlimited());
    expect(poolRollButton("Reroll").textContent).toBe("Reroll");
    await toggleReroll(user, 0);
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", false);
  });

  it("acquires explicit browser dice and assigns equal totals by distinct IDs, including partial clears", async () => {
    const samples = [0, 0.999, 0.4, 0.5];
    const random = vi.fn(() => samples.shift() ?? 0.45);
    const { user, snapshot } = await startGeneration(random);
    expect(random).not.toHaveBeenCalled();
    expect(screen.queryByText("Submit seven separate 2d10 rolls.")).toBeNull();
    expect(snapshot().characteristicGeneration.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "rolls", code: "roll-count" }),
      ]),
    );
    expect(
      screen.queryByText("Luck requires exactly two integer d10 faces (1–10)."),
    ).toBeNull();
    expect(screen.queryByText("Luck requires a non-empty roll ID.")).toBeNull();
    expect(snapshot().characteristicGeneration.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "luck", code: "roll-identity" }),
        expect.objectContaining({ field: "luck", code: "invalid-dice" }),
      ]),
    );
    expect(
      screen.queryByText(/Assign each roll once|Assign an available roll/),
    ).toBeNull();
    expect(
      screen.queryByText("Choose a roll to assign a characteristic."),
    ).toBeNull();
    expect(snapshot().characteristicGeneration.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "assignments",
          code: "invalid-assignment",
        }),
      ]),
    );
    expect(snapshot().canFinish).toBe(false);
    await user.click(poolRollButton());
    expect(random).toHaveBeenCalledTimes(14);
    const rolls = snapshot().characteristicGeneration.drafts.rolled.rolls;
    expect(rolls.slice(0, 2)).toEqual([
      { id: "roll-1", dice: [1, 10] },
      { id: "roll-2", dice: [5, 6] },
    ]);
    const pool = within(
      screen.getByRole("group", { name: "Characteristic rolls" }),
    );
    expect(pool.getAllByRole("button")).toHaveLength(14);
    expect(pool.getByRole("button", { name: "Roll 1, total 11" })).toBeTruthy();
    expect(pool.getByRole("button", { name: "Roll 2, total 11" })).toBeTruthy();
    expect(screen.queryByText(/roll-\d/)).toBeNull();
    expect(screen.queryByText("1 + 10")).toBeNull();
    await chooseRoll(user, "Strength", 0);
    await chooseRoll(user, "Endurance", 1);
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1", end: "roll-2" });
    expect(
      pool
        .getByRole("button", {
          name: "Roll 1, total 11, assigned Strength",
        })
        .getAttribute("aria-haspopup"),
    ).toBeNull();
    expect(
      pool.getByRole("button", {
        name: "Roll 2, total 11, assigned Endurance",
      }),
    ).toBeTruthy();
    const labels = Object.values(characteristicLabels);
    for (let index = 2; index < labels.length; index += 1) {
      await chooseRoll(user, labels[index]!, index);
    }
    await favorStrengthAndEndurance(user);
    await user.click(luckRollButton());
    expect(random).toHaveBeenCalledTimes(16);
    expect(snapshot().characteristicGeneration.complete).toBe(true);
    expect(snapshot().canFinish).toBe(true);
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 11,
      favored: true,
      total: 36,
    });
    expectCharacteristic("Endurance", {
      baseline: 25,
      generated: 11,
      favored: true,
      total: 36,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    const assignments =
      snapshot().characteristicGeneration.drafts.rolled.assignments;
    for (let index = 0; index < 7; index += 1) {
      expect(poolTile(index).getAttribute("aria-label")).toMatch(/, assigned /);
      expect(poolTile(index).getAttribute("aria-haspopup")).toBeNull();
      expect(poolTile(index).getAttribute("aria-expanded")).toBeNull();
    }
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual(assignments);
    await unassignRoll(user, 0);
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 0,
      favored: true,
      total: 25,
    });
    expectCharacteristic("Endurance", {
      baseline: 25,
      generated: 0,
      favored: true,
      total: 25,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    const partial = { ...assignments };
    delete partial.str;
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual(partial);
    await user.click(poolAction(0));
    expect(menuCharacteristic("Strength").textContent).toBe("Strength");
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Reroll", "Strength"]);
    expect(screen.queryByRole("menuitem", { name: "Endurance" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(snapshot().canFinish).toBe(false);
    await chooseRoll(user, "Strength", 0);
    expect(snapshot().characteristicGeneration.complete).toBe(true);
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 11,
      favored: true,
      total: 36,
    });
    expect(
      screen.queryByRole("dialog", { name: "Something went wrong!" }),
    ).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("unassigns through the integrated action in a fully assigned pool without clearing other answers", async () => {
    const assignments = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAssignments",
    );
    const { user, snapshot } = await startGeneration(() => 0.45);
    await user.click(poolRollButton());
    await assignPool(user);
    const rolls = snapshot().characteristicGeneration.drafts.rolled.rolls;
    const remaining = {
      ...snapshot().characteristicGeneration.drafts.rolled.assignments,
    };
    const keys = Object.keys(remaining);
    const initialSubmissions = assignments.mock.calls.length;
    for (let index = 0; index < 7; index += 1) {
      expect(poolTile(index).getAttribute("aria-label")).toMatch(/, assigned /);
      expect(poolTile(index).getAttribute("aria-haspopup")).toBeNull();
      await unassignRoll(user, index);
      delete remaining[keys[index]!];
      expect(assignments).toHaveBeenCalledTimes(initialSubmissions + index + 1);
      expect(assignments).toHaveBeenLastCalledWith(remaining);
      expect(
        snapshot().characteristicGeneration.drafts.rolled.assignments,
      ).toEqual(remaining);
      expect(screen.queryByRole("menu")).toBeNull();
    }
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    expect(snapshot().characteristicGeneration.drafts.rolled.rolls).toEqual(
      rolls,
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("rerolls selected results once, retains untouched assignments and other drafts, and rerolls Luck independently", async () => {
    const random = vi.fn(() => 0.45);
    const { user, snapshot } = await startGeneration(random);
    await user.type(
      screen.getByRole("textbox", { name: "Character name" }),
      "Neri",
    );
    await favorStrengthAndEndurance(user);
    await user.click(poolRollButton());
    await assignPool(user);
    await user.click(luckRollButton());
    const luckGroup = within(screen.getByRole("group", { name: "Luck roll" }));
    expect(luckGroup.queryByText("Luck baseline: 30.")).toBeNull();
    expect(
      luckGroup.queryByText(
        "Luck uses a separate 2d10 roll with either method.",
      ),
    ).toBeNull();
    expect(
      luckGroup.getByRole("button", { name: "Luck roll, total 10" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    await enterPoints(user, "Strength", "20");
    await enterPoints(user, "Endurance", "10");
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    const before = snapshot();
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 10,
      favored: true,
      total: 35,
    });
    expect(poolTile(0).getAttribute("aria-label")).toBe(
      "Roll 1, total 10, assigned Strength",
    );
    expect(
      screen.queryByText(
        "Rerolling replaces all seven rolls and clears every assignment.",
      ),
    ).toBeNull();
    for (let index = 1; index <= 3; index += 1) {
      await toggleReroll(user, index - 1);
    }
    await user.click(poolAction(0));
    expect(poolAction(0)).toHaveProperty("ariaExpanded", "true");
    await user.click(poolRollButton("Reroll"));
    expect(random).toHaveBeenCalledTimes(22);
    const drafts = snapshot().characteristicGeneration.drafts;
    expect(drafts).toMatchObject({
      method: "rolled",
      favored: before.characteristicGeneration.drafts.favored,
      luck: before.characteristicGeneration.drafts.luck,
      pointBuy: before.characteristicGeneration.drafts.pointBuy,
      rolled: {
        assignments: {
          int: before.characteristicGeneration.drafts.rolled.assignments.int,
          wp: before.characteristicGeneration.drafts.rolled.assignments.wp,
          prc: before.characteristicGeneration.drafts.rolled.assignments.prc,
          prs: before.characteristicGeneration.drafts.rolled.assignments.prs,
        },
      },
    });
    expect(drafts.rolled.rolls).toHaveLength(7);
    expect(drafts.rolled.rolls[0]?.id).toBe("roll-9");
    expect(drafts.rolled.rolls.slice(3)).toEqual(
      before.characteristicGeneration.drafts.rolled.rolls.slice(3),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    for (let index = 0; index < 3; index += 1)
      expect(poolAction(index)).toHaveProperty("ariaExpanded", "false");
    expect(poolRollButton("Reroll")).toHaveProperty("disabled", true);
    expect(snapshot().answers).toEqual(before.answers);
    expect(snapshot().canFinish).toBe(false);
    await chooseRoll(user, "Strength", 0);
    await chooseRoll(user, "Endurance", 1);
    await chooseRoll(user, "Agility", 2);
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 10,
      favored: true,
      total: 35,
    });
    const beforeLuck = snapshot().characteristicGeneration.drafts;
    await user.click(luckRollButton("Reroll"));
    expect(random).toHaveBeenCalledTimes(24);
    expect(snapshot().characteristicGeneration.drafts).toEqual({
      ...beforeLuck,
      luck: { id: "roll-12", dice: [5, 5] },
    });
    expect(
      luckGroup.getByRole("button", { name: "Luck roll, total 10" }),
    ).toBeTruthy();
    expect(snapshot().canFinish).toBe(true);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Strength points" }),
    ).toHaveProperty("value", "20");
    expect(
      screen.getByRole("textbox", { name: "Endurance points" }),
    ).toHaveProperty("value", "10");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    ).toHaveProperty("checked", true);
    expect(
      screen.getByRole("textbox", { name: "Strength points" }),
    ).toHaveProperty("value", "20");
    expect(
      screen.getByRole("textbox", { name: "Character name" }),
    ).toHaveProperty("value", "Neri");
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 0,
      favored: true,
      total: 25,
    });
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    expect(poolTile(0).getAttribute("aria-label")).toBe(
      "Roll 1, total 10, assigned Strength",
    );
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 10,
      favored: true,
      total: 35,
    });
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 0,
      favored: true,
      total: 25,
    });
    expect(random).toHaveBeenCalledTimes(24);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("moves a roll directly to an unoccupied target and keeps occupied targets excluded until explicitly unassigned", async () => {
    const assignments = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAssignments",
    );
    const { user, snapshot } = await startGeneration(() => 0.45);
    await user.click(poolRollButton());
    await user.click(poolTile(0));
    await user.keyboard("{Enter} ");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(assignments).not.toHaveBeenCalled();
    await user.click(poolAction(0));
    expect(poolAction(0)).toHaveProperty("ariaExpanded", "true");
    expect(assignments).not.toHaveBeenCalled();
    await user.click(menuCharacteristic("Strength"));
    expect(assignments).toHaveBeenCalledExactlyOnceWith({ str: "roll-1" });
    expect(poolTile(0).getAttribute("aria-expanded")).toBeNull();
    expect(poolTile(0).getAttribute("aria-haspopup")).toBeNull();
    expect(poolTile(0).getAttribute("aria-label")).toMatch(
      /, assigned Strength$/,
    );
    await chooseRoll(user, "Endurance", 1);
    expect(assignments).toHaveBeenCalledTimes(2);
    expect(assignments).toHaveBeenLastCalledWith({
      str: "roll-1",
      end: "roll-2",
    });

    await user.click(poolAction(0));
    expect(screen.getByRole("menuitem", { name: "Unassign" })).toBeTruthy();
    expect(screen.getByText("Assign To")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Strength" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Endurance" })).toBeNull();
    expect(assignments).toHaveBeenCalledTimes(2);
    await user.click(menuCharacteristic("Agility"));
    expect(assignments).toHaveBeenCalledTimes(3);
    expect(assignments).toHaveBeenLastCalledWith({
      end: "roll-2",
      ag: "roll-1",
    });
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ end: "roll-2", ag: "roll-1" });
    expect(poolTile(0).getAttribute("aria-label")).toBe(
      "Roll 1, total 10, assigned Agility",
    );
    expect(poolTile(1).getAttribute("aria-label")).toBe(
      "Roll 2, total 10, assigned Endurance",
    );
    await chooseRoll(user, "Strength", 2);
    expect(assignments).toHaveBeenCalledTimes(4);
    expect(assignments).toHaveBeenLastCalledWith({
      end: "roll-2",
      ag: "roll-1",
      str: "roll-3",
    });
    await user.click(poolAction(3));
    expect(screen.queryByRole("menuitem", { name: "Strength" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Endurance" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Agility" })).toBeNull();
    await user.keyboard("{Escape}");
    expect(assignments).toHaveBeenCalledTimes(4);
    await unassignRoll(user, 2);
    expect(assignments).toHaveBeenCalledTimes(5);
    expect(assignments).toHaveBeenLastCalledWith({
      end: "roll-2",
      ag: "roll-1",
    });
    await unassignRoll(user, 1);
    expect(assignments).toHaveBeenCalledTimes(6);
    expect(assignments).toHaveBeenLastCalledWith({ ag: "roll-1" });
    await chooseRoll(user, "Strength", 1);
    expect(assignments).toHaveBeenCalledTimes(7);
    expect(assignments).toHaveBeenLastCalledWith({
      ag: "roll-1",
      str: "roll-2",
    });
    expect(poolTile(2).getAttribute("aria-label")).toBe("Roll 3, total 10");
    await user.click(poolAction(2));
    expect(menuCharacteristic("Endurance")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Strength" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Agility" })).toBeNull();
    await user.keyboard("{Escape}");
    await unassignRoll(user, 0);
    expect(assignments).toHaveBeenCalledTimes(8);
    expect(assignments).toHaveBeenLastCalledWith({ str: "roll-2" });

    await user.click(poolAction(2));
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-2" });
    expect(poolTile(1).getAttribute("aria-label")).toBe(
      "Roll 2, total 10, assigned Strength",
    );
    expect(poolAction(2)).toHaveProperty("ariaExpanded", "false");
    expect(
      screen.getByRole("region", { name: "Character editor" }).textContent,
    ).not.toMatch(/roll-\d/);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("supports keyboard and touch assignment, focus tooltips and Luck disclosure", async () => {
    const random = vi.fn(() => 0.45);
    const { user, snapshot } = await startGeneration(random);
    await user.click(poolRollButton());
    expect(document.activeElement).toBe(poolTile(0));
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "2d10: 5 + 5 = 10",
    );
    await user.tab();
    expect(document.activeElement).toBe(poolAction(0));
    await user.keyboard("{Enter}");
    expect(poolAction(0)).toHaveProperty("ariaExpanded", "true");
    expect(poolAction(0).getAttribute("aria-haspopup")).toBe("menu");
    expect(poolAction(0).getAttribute("aria-controls")).toBe(
      screen.getByRole("menu", { name: "Actions for result: 10" }).id,
    );
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(menuCharacteristic("Reroll"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(menuCharacteristic("Strength"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(menuCharacteristic("Endurance"));
    await user.keyboard("{ArrowUp}{Enter}");
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1" });
    await waitFor(() => expect(document.activeElement).toBe(poolAction(0)));
    expect(poolTile(0).getAttribute("aria-label")).toMatch(
      /, assigned Strength$/,
    );
    expect(poolTile(0).getAttribute("aria-haspopup")).toBeNull();
    await user.keyboard(" {ArrowDown}{ArrowDown}{Enter}");
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(poolAction(0)));
    await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{Enter}");
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1" });
    await waitFor(() => expect(document.activeElement).toBe(poolAction(0)));
    await user.pointer([
      { keys: "[TouchA>]", target: poolAction(1) },
      { keys: "[/TouchA]" },
    ]);
    expect(poolAction(1)).toHaveProperty("ariaExpanded", "true");
    const menu = within(
      screen.getByRole("menu", { name: "Actions for result: 10" }),
    );
    expect(menu.queryByText(/2d10/)).toBeNull();
    expect(
      menu.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([
      "Reroll",
      "Endurance",
      "Agility",
      "Intelligence",
      "Willpower",
      "Perception",
      "Personality",
    ]);
    expect(menu.queryByRole("menuitem", { name: "Strength" })).toBeNull();
    const endurance = menuCharacteristic("Endurance");
    await user.pointer([
      { keys: "[TouchA>]", target: endurance },
      { keys: "[/TouchA]" },
    ]);
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1", end: "roll-2" });
    expect(screen.queryByRole("menu")).toBeNull();
    await user.pointer([
      { keys: "[TouchA>]", target: poolAction(1) },
      { keys: "[/TouchA]" },
    ]);
    await user.pointer([
      { keys: "[TouchA>]", target: menuCharacteristic("Unassign") },
      { keys: "[/TouchA]" },
    ]);
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1" });
    expect(screen.queryByRole("menu")).toBeNull();
    await user.pointer([
      { keys: "[TouchA>]", target: poolAction(1) },
      { keys: "[/TouchA]" },
    ]);
    expect(menuCharacteristic("Endurance")).toBeTruthy();
    await user.pointer([
      { keys: "[TouchA>]", target: menuCharacteristic("Endurance") },
      { keys: "[/TouchA]" },
    ]);
    expect(
      snapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-1", end: "roll-2" });
    await user.click(luckRollButton());
    expect(poolTile(1).getAttribute("aria-expanded")).toBeNull();
    const luck = within(screen.getByRole("group", { name: "Luck roll" }));
    const luckTile = luck.getByRole("button", { name: "Luck roll, total 10" });
    expect(luckTile).toHaveProperty("ariaExpanded", "false");
    await user.pointer([
      { keys: "[TouchB>]", target: luckTile },
      { keys: "[/TouchB]" },
    ]);
    expect(luckTile).toHaveProperty("ariaExpanded", "true");
    expect(
      luck.getByText("2d10: 5 + 5 = 10", { selector: '[role="status"]' }),
    ).toBeTruthy();
    await user.pointer([
      { keys: "[TouchC>]", target: luckTile },
      { keys: "[/TouchC]" },
    ]);
    expect(luckTile).toHaveProperty("ariaExpanded", "false");
    expect(
      luck.queryByText("2d10: 5 + 5 = 10", { selector: '[role="status"]' }),
    ).toBeNull();
    expect(random).toHaveBeenCalledTimes(16);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("dismisses menus with Escape or an outside click without changing answers and returns focus to the integrated action", async () => {
    const assignments = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAssignments",
    );
    const { user, snapshot } = await startGeneration(() => 0.45);
    await user.click(poolRollButton());
    const before = snapshot().characteristicGeneration.drafts;
    await user.click(poolAction(0));
    expect(
      screen.getByRole("menu", { name: "Actions for result: 10" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("menuitem")).toHaveLength(8);
    expect(screen.queryByRole("menuitem", { name: "Unassign" })).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Roll assignment validation" }),
    ).toBeNull();
    expect(
      screen.queryByText(/Assign each roll once|Assign an available roll/),
    ).toBeNull();
    expect(snapshot().characteristicGeneration.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "assignments",
          code: "invalid-assignment",
        }),
        expect.objectContaining({
          field: "assignments",
          code: "invalid-assignment",
          characteristic: "str",
        }),
      ]),
    );
    expect(snapshot().canFinish).toBe(false);
    expect(within(screen.getByRole("menu")).queryByRole("status")).toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(poolAction(0)));
    expect(poolAction(0)).toHaveProperty("ariaExpanded", "false");
    await user.click(poolAction(1));
    await user.click(
      screen.getByRole("heading", { name: "Generate Characteristics" }),
    );
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(poolAction(1)));
    expect(snapshot().characteristicGeneration.drafts).toEqual(before);
    expect(assignments).not.toHaveBeenCalled();
  });

  it("initializes rounded allocation controls and steps whole maps within per-characteristic and budget limits", async () => {
    const allocations = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAllocations",
    );
    const random = vi.fn(() => 0.45);
    const { user, snapshot } = await startGeneration(random);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    const zeros = { str: 0, end: 0, ag: 0, int: 0, wp: 0, prc: 0, prs: 0 };
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations,
    ).toEqual(zeros);
    expect(allocations).toHaveBeenCalledExactlyOnceWith(zeros);
    for (const label of Object.values(characteristicLabels)) {
      const card = within(
        screen.getByRole("group", { name: `${label} allocation` }),
      );
      expect(card.getByLabelText(label)).toBe(
        card.getByRole("textbox", { name: `${label} points` }),
      );
      expect(
        screen.getByRole("button", { name: `Decrease ${label} points` }),
      ).toHaveProperty("disabled", true);
      expect(
        screen.getByRole("button", { name: `Increase ${label} points` }),
      ).toHaveProperty("disabled", false);
    }
    await user.click(
      screen.getByRole("button", { name: "Decrease Strength points" }),
    );
    expect(allocations).toHaveBeenCalledTimes(1);
    const increase = screen.getByRole("button", {
      name: "Increase Strength points",
    });
    await user.click(increase);
    expect(allocations).toHaveBeenCalledTimes(2);
    expect(allocations).toHaveBeenLastCalledWith({ ...zeros, str: 1 });
    await user.keyboard("{Enter}");
    expect(allocations).toHaveBeenLastCalledWith({ ...zeros, str: 2 });
    const decrease = screen.getByRole("button", {
      name: "Decrease Strength points",
    });
    await user.pointer([
      { keys: "[TouchA>]", target: decrease },
      { keys: "[/TouchA]" },
    ]);
    expect(allocations).toHaveBeenLastCalledWith({ ...zeros, str: 1 });
    expect(screen.getByText("Points remaining: 79")).toBeTruthy();
    await enterPoints(user, "Strength", "20");
    expect(increase).toHaveProperty("disabled", true);
    const atCap = allocations.mock.calls.length;
    await user.click(increase);
    expect(allocations).toHaveBeenCalledTimes(atCap);
    await enterPoints(user, "Endurance", "20");
    await enterPoints(user, "Agility", "20");
    await enterPoints(user, "Intelligence", "20");
    expect(screen.getByText("Points remaining: 0")).toBeTruthy();
    for (const label of Object.values(characteristicLabels)) {
      expect(
        screen.getByRole("button", { name: `Increase ${label} points` }),
      ).toHaveProperty("disabled", true);
    }
    const exhausted = allocations.mock.calls.length;
    await user.click(
      screen.getByRole("button", { name: "Increase Willpower points" }),
    );
    expect(allocations).toHaveBeenCalledTimes(exhausted);
    await user.click(decrease);
    expect(screen.getByText("Points remaining: 1")).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Increase Willpower points" }),
    );
    expect(allocations).toHaveBeenLastCalledWith({
      str: 19,
      end: 20,
      ag: 20,
      int: 20,
      wp: 1,
      prc: 0,
      prs: 0,
    });
    expect(screen.getByText("Points remaining: 0")).toBeTruthy();
    expect(
      snapshot().characteristicGeneration.issues.some(
        (issue: { field?: string }) => issue.field === "allocations",
      ),
    ).toBe(false);
    expect(random).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("prevents negative allocations through typing, paste, keyboard arrows and decrement controls", async () => {
    const allocations = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAllocations",
    );
    const { user, snapshot } = await startGeneration(() => 0.45);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    const input = screen.getByRole("textbox", { name: "Strength points" });
    await user.click(input);
    await user.keyboard("{ArrowDown}-");
    expect(input).toHaveProperty("value", "0");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations.str,
    ).toBe(0);
    await user.clear(input);
    await user.type(input, "-5");
    expect(input).toHaveProperty("value", "5");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations.str,
    ).toBe(5);
    await user.paste("-7");
    expect(input).toHaveProperty("value", "0");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations.str,
    ).toBe(0);
    await user.paste("-0.5");
    expect(input).toHaveProperty("value", "0");
    const beforeDecrement = allocations.mock.calls.length;
    await user.click(
      screen.getByRole("button", { name: "Decrease Strength points" }),
    );
    expect(allocations).toHaveBeenCalledTimes(beforeDecrement);
    for (const [allocation] of allocations.mock.calls) {
      for (const value of Object.values(allocation))
        expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(
      screen.queryByRole("dialog", { name: "Something went wrong!" }),
    ).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("accepts a complete point-buy answer and retains Core-invalid numeric edits without clamping", async () => {
    const random = vi.fn(() => 0.45);
    const { user, snapshot } = await startGeneration(random);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    expect(random).not.toHaveBeenCalled();
    expect(screen.getByText("Points remaining: 80")).toBeTruthy();
    for (const label of Object.values(characteristicLabels)) {
      expect(
        screen.getByRole("textbox", { name: `${label} points` }),
      ).toHaveProperty("value", "0");
    }
    expect(
      screen.queryByText(
        /Allocate points to|Enter integers from|Spend exactly 80 points/,
      ),
    ).toBeNull();
    const amounts = ["20", "20", "20", "10", "10", "0", "0"];
    const labels = Object.values(characteristicLabels);
    for (let index = 0; index < labels.length; index += 1) {
      await enterPoints(user, labels[index]!, amounts[index]!);
    }
    await favorStrengthAndEndurance(user);
    await user.click(luckRollButton());
    expect(screen.getByText("Points remaining: 0")).toBeTruthy();
    expect(snapshot().characteristicGeneration.complete).toBe(true);
    expect(snapshot().canFinish).toBe(true);
    expect(screen.queryByText("Spend exactly 80 points.")).toBeNull();
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 20,
      favored: true,
      total: 45,
    });
    expectCharacteristic("Intelligence", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    await user.click(screen.getByRole("checkbox", { name: "Endurance" }));
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 20,
      favored: false,
      total: 45,
    });
    expectCharacteristic("Endurance", {
      baseline: 25,
      generated: 20,
      favored: false,
      total: 45,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    expect(snapshot().canFinish).toBe(false);
    await user.click(screen.getByRole("checkbox", { name: "Endurance" }));
    await enterPoints(user, "Personality", "");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations,
    ).not.toHaveProperty("prs");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations.str,
    ).toBe(20);
    expect(snapshot().characteristicGeneration.complete).toBe(false);
    await enterPoints(user, "Personality", "0");
    expect(snapshot().characteristicGeneration.complete).toBe(true);

    for (const value of ["21", "1.5"]) {
      const input = await enterPoints(user, "Strength", value);
      expect(input).toHaveProperty("value", value);
      expect(
        screen.getByRole("button", { name: "Increase Strength points" }),
      ).toHaveProperty("disabled", true);
      expect(
        screen.getByRole("button", { name: "Decrease Strength points" }),
      ).toHaveProperty("disabled", true);
      expect(
        snapshot().characteristicGeneration.drafts.pointBuy.allocations.str,
      ).toBe(Number(value));
      expect(snapshot().characteristicGeneration.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "invalid-allocation",
            field: "allocations",
            characteristic: "str",
          }),
        ]),
      );
      const strength = within(
        screen.getByRole("group", { name: "Strength allocation" }),
      );
      expect(
        strength.getByText(
          "Allocate an integer from 0 to 20 to this characteristic.",
        ),
      ).toBeTruthy();
      expect(snapshot().canFinish).toBe(false);
      expectCharacteristic("Strength", {
        baseline: 25,
        generated: 0,
        favored: true,
        total: 25,
      });
      expectCharacteristic("Intelligence", {
        baseline: 30,
        generated: 0,
        favored: false,
        total: 30,
      });
      expectCharacteristic("Luck", {
        baseline: 30,
        generated: 10,
        favored: false,
        total: 40,
      });
    }
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      screen.getByRole("textbox", { name: "Strength points" }),
    ).toHaveProperty("value", "1.5");
    await enterPoints(user, "Strength", "19");
    expect(screen.getByText("Points remaining: 1")).toBeTruthy();
    expect(screen.queryByText("Spend exactly 80 points.")).toBeNull();
    expect(snapshot().characteristicGeneration.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "allocations", code: "point-budget" }),
      ]),
    );
    expect(
      screen.queryByText(
        "Allocate an integer from 0 to 20 to this characteristic.",
      ),
    ).toBeNull();
    expect(snapshot().characteristicGeneration.complete).toBe(false);
    await enterPoints(user, "Strength", "20");
    expect(snapshot().characteristicGeneration.complete).toBe(true);
    await enterPoints(user, "Intelligence", "11");
    expect(screen.getByText("Points remaining: -1")).toBeTruthy();
    expect(screen.queryByText("Spend exactly 80 points.")).toBeNull();
    expect(snapshot().characteristicGeneration.complete).toBe(false);
    await enterPoints(user, "Intelligence", "10");
    expect(snapshot().characteristicGeneration.complete).toBe(true);
    for (const label of labels) await enterPoints(user, label, "");
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations,
    ).toEqual({});
    expect(screen.getByText("Points remaining: 80")).toBeTruthy();
    expect(screen.queryByText(/Allocate an integer/)).toBeNull();
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      snapshot().characteristicGeneration.drafts.pointBuy.allocations,
    ).toEqual({});
    for (const label of labels)
      expect(
        screen.getByRole("textbox", { name: `${label} points` }),
      ).toHaveProperty("value", "");
    expect(snapshot().canFinish).toBe(false);
    expect(
      screen.queryByRole("dialog", { name: "Something went wrong!" }),
    ).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
