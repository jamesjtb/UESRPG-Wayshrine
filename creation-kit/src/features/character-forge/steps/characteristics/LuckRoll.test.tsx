import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { LuckRoll } from "./LuckRoll";

it("retains invalid Luck feedback until Core accepts a valid replacement", () => {
  const creator = new CharacterCreator(fixtureCatalog());
  creator.submitLuckRoll({ id: "", dice: [0, 11] });
  function editor() {
    const generation = creator.getSnapshot().characteristicGeneration;
    return (
      <MantineProvider env="test">
        <LuckRoll
          roll={generation.drafts.luck}
          issues={generation.issues}
          rollDice={createCharacteristicRoller(() => 0.45)}
          submitLuckRoll={(roll) => creator.submitLuckRoll(roll)}
          unlimited={generation.rerolls.unlimited}
          selected={false}
          onToggleReroll={() => {}}
        />
      </MantineProvider>
    );
  }
  const view = render(editor());
  expect(screen.getByText("Luck requires a non-empty roll ID.")).toBeTruthy();
  expect(
    screen.getByText("Luck requires exactly two integer d10 faces (1–10)."),
  ).toBeTruthy();
  creator.setUnlimitedCharacteristicRerolls(true);
  expect(
    creator.rerollCharacteristics([], { id: "fixed", dice: [5, 5] }).ok,
  ).toBe(true);
  view.rerender(editor());
  expect(screen.queryByText(/Luck requires/)).toBeNull();
});

it("uses the pool tile presentation with a locked Luck assignment and a gated selection menu", async () => {
  const user = userEvent.setup();
  const creator = new CharacterCreator(fixtureCatalog());
  creator.submitLuckRoll({ id: "luck", dice: [5, 5] });
  const toggle = vi.fn();
  function editor(unlimited: boolean, selected = false) {
    const generation = creator.getSnapshot().characteristicGeneration;
    return (
      <MantineProvider env="test">
        <LuckRoll
          roll={generation.drafts.luck}
          issues={generation.issues}
          rollDice={createCharacteristicRoller(() => 0.45)}
          submitLuckRoll={(roll) => creator.submitLuckRoll(roll)}
          unlimited={unlimited}
          selected={selected}
          onToggleReroll={toggle}
        />
      </MantineProvider>
    );
  }
  const view = render(editor(false));
  expect(screen.queryByRole("heading", { name: "Luck" })).toBeNull();
  const tile = screen.getByRole("button", {
    name: "Luck roll, total 10, assigned Luck",
  });
  expect(tile.getAttribute("aria-expanded")).toBeNull();
  await user.click(tile);
  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Actions for Luck" }));
  expect(screen.getByRole("menuitem", { name: "Reroll" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(
    within(screen.getByRole("menu")).getAllByRole("menuitem"),
  ).toHaveLength(1);
  expect(screen.queryByText("Assign To")).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Unassign" })).toBeNull();
  await user.keyboard("{Escape}");
  view.rerender(editor(true));
  await user.click(screen.getByRole("button", { name: "Actions for Luck" }));
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  expect(toggle).toHaveBeenCalledOnce();
  view.rerender(editor(true, true));
  expect(
    screen.getByRole("button", { name: "Actions for Luck" }).textContent,
  ).toBe("Rerolling");
});
