import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { RolledCharacteristics } from "./RolledCharacteristics";
import { useCharacterCreator } from "../../useCharacterCreator";

function renderRolled(random: () => number = () => 0.45) {
  const catalog = fixtureCatalog();
  const rollDice = createCharacteristicRoller(random);
  function Harness() {
    const creator = useCharacterCreator(catalog);
    if (!creator.view) return null;
    const generation = creator.view.snapshot.characteristicGeneration;
    return (
      <RolledCharacteristics
        draft={generation.drafts.rolled}
        issues={generation.issues}
        rollDice={rollDice}
        submitCharacteristicRolls={creator.submitCharacteristicRolls}
        unlimitedRerolls={creator.view.unlimitedRerolls}
        rerollBatchSpent={creator.view.rerollBatchSpent}
        rerollCharacteristics={creator.rerollCharacteristics}
        setCharacteristicAssignments={creator.setCharacteristicAssignments}
      />
    );
  }
  render(
    <MantineProvider env="test">
      <Harness />
    </MantineProvider>,
  );
  return userEvent.setup();
}

it("offers separate keyboard/touch selections capped at three and one final batch, without a whole-pool reroll", async () => {
  const user = renderRolled();
  const initialRoll = screen.getByRole("button", { name: "Roll" });
  const initialPool = screen.getByRole("group", {
    name: "Characteristic rolls",
  });
  expect(
    initialRoll.compareDocumentPosition(initialPool) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(screen.queryByRole("button", { name: "Roll" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Reroll" })).toBeNull();
  const reroll = screen.getByRole("button", { name: "Reroll (0 of 3)" });
  const pool = screen.getByRole("group", { name: "Characteristic rolls" });
  expect(
    pool.compareDocumentPosition(reroll) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(reroll).toHaveProperty("disabled", true);
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText(/Use ACTION/)).toBeNull();
  expect(screen.queryByText(/\d of \d selected/)).toBeNull();
  expect(screen.queryByRole("checkbox")).toBeNull();
  for (let ordinal = 1; ordinal <= 7; ordinal += 1) {
    const pair = within(screen.getByRole("group", { name: `Roll ${ordinal}` }));
    expect(
      pair
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([`Roll ${ordinal}, total 10`, "Actions for result: 10"]);
  }
  const action = (ordinal: number) =>
    within(screen.getByRole("group", { name: `Roll ${ordinal}` })).getByRole(
      "button",
      { name: "Actions for result: 10" },
    );
  action(1).focus();
  await user.keyboard(" {ArrowDown}{Enter}");
  expect(reroll.textContent).toBe("Reroll (1 of 3)");
  await user.pointer([
    { keys: "[TouchA>]", target: action(2) },
    { keys: "[/TouchA]" },
  ]);
  await user.pointer([
    {
      keys: "[TouchA>]",
      target: screen.getByRole("menuitem", { name: "Reroll" }),
    },
    { keys: "[/TouchA]" },
  ]);
  await user.click(action(3));
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  expect(reroll.textContent).toBe("Reroll (3 of 3)");
  expect(
    screen.getByRole("group", { name: "Roll 1" }).hasAttribute("data-selected"),
  ).toBe(true);
  expect(
    screen
      .getByRole("button", { name: "Roll 1, total 10, selected for reroll" })
      .hasAttribute("data-selected"),
  ).toBe(true);
  await user.click(action(4));
  expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.keyboard("{Escape}");
  expect(reroll).toHaveProperty("disabled", false);
  await user.click(action(1));
  await user.click(screen.getByRole("menuitem", { name: "Don't reroll" }));
  expect(reroll.textContent).toBe("Reroll (2 of 3)");
  expect(
    screen.getByRole("group", { name: "Roll 1" }).hasAttribute("data-selected"),
  ).toBe(false);
  // Selection does not perform the tile's assignment action.
  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(action(4));
  expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
    "disabled",
    false,
  );
  expect(screen.queryByRole("menuitem", { name: "Unassign" })).toBeNull();
  await user.click(screen.getByRole("menuitem", { name: "Strength" }));
  await user.click(reroll);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Roll 2, total 10" }),
  );
  expect(
    screen.getByRole("button", {
      name: "Roll 4, total 10, assigned Strength",
    }),
  ).toBeTruthy();
  expect(reroll.textContent).toBe("Reroll Expended");
  await user.click(action(4));
  expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("menuitem", { name: "Unassign" })).toHaveProperty(
    "disabled",
    false,
  );
  await user.keyboard("{Escape}");
  expect(
    within(
      screen.getByRole("group", { name: "Rolled characteristics" }),
    ).getByRole("button", { name: "Reroll Expended" }),
  ).toHaveProperty("disabled", true);
  expect(
    screen.queryByText(
      "Your reroll batch has been used. New results are final.",
    ),
  ).toBeNull();
});

it("integrates total and action without nested buttons, labels actions by value, and prioritizes reroll selection without clearing assignments", async () => {
  let sample = 0;
  const user = renderRolled(() => {
    sample += 1;
    return sample % 2 === 1 ? 0.5 : 0.6;
  });
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(
    screen.getAllByRole("button", { name: "Actions for result: 13" }),
  ).toHaveLength(7);
  expect(screen.queryByText("ACTION")).toBeNull();
  const pair = within(screen.getByRole("group", { name: "Roll 1" }));
  const action = pair.getByRole("button", { name: "Actions for result: 13" });
  expect(action.textContent).toBe("");
  expect(action.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  const total = pair.getByRole("button", { name: "Roll 1, total 13" });
  expect(total.textContent).toBe("13");
  expect(total.getAttribute("aria-description")).toBe("2d10: 6 + 7 = 13");
  for (const button of pair.getAllByRole("button")) {
    expect(button.querySelector("button")).toBeNull();
  }
  await user.click(action);
  await user.click(screen.getByRole("menuitem", { name: "Strength" }));
  expect(action.textContent).toBe("Strength");
  expect(total.textContent).toBe("13");
  await user.click(action);
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  expect(action.textContent).toBe("Rerolling");
  expect(action.getAttribute("aria-description")).toBe(
    "Roll 1, total 13, assigned Strength, selected for reroll",
  );
  await user.click(action);
  await user.click(screen.getByRole("menuitem", { name: "Don't reroll" }));
  expect(action.textContent).toBe("Strength");
  await user.click(action);
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  await user.click(screen.getByRole("button", { name: "Reroll (1 of 3)" }));
  const replacement = within(screen.getByRole("group", { name: "Roll 1" }));
  expect(
    replacement.getByRole("button", { name: "Actions for result: 13" })
      .textContent,
  ).toBe("");
  expect(
    replacement.getByRole("button", { name: "Roll 1, total 13" }),
  ).toBeTruthy();
});

it("still displays count and dice issues for a nonempty invalid roll pool", () => {
  const creator = new CharacterCreator(fixtureCatalog());
  creator.setCharacteristicGenerationMethod("rolled");
  creator.submitCharacteristicRolls([{ id: "one", dice: [0, 11] }]);
  const generation = creator.getSnapshot().characteristicGeneration;
  render(
    <MantineProvider env="test">
      <RolledCharacteristics
        draft={generation.drafts.rolled}
        issues={generation.issues}
        rollDice={createCharacteristicRoller(() => 0.45)}
        unlimitedRerolls={false}
        rerollBatchSpent={false}
        rerollCharacteristics={() => false}
        submitCharacteristicRolls={(rolls) =>
          creator.submitCharacteristicRolls(rolls)
        }
        setCharacteristicAssignments={(assignments) =>
          creator.setCharacteristicAssignments(assignments)
        }
      />
    </MantineProvider>,
  );
  expect(screen.getByText("Submit seven separate 2d10 rolls.")).toBeTruthy();
  expect(
    screen.getByText(
      "Characteristic roll requires exactly two integer d10 faces (1–10).",
    ),
  ).toBeTruthy();
  expect(generation.complete).toBe(false);
  expect(creator.getSnapshot().canFinish).toBe(false);
});
