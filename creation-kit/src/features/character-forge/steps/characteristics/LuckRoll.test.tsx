import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { LuckRoll } from "./LuckRoll";

it("repairs an invalid initial Luck draft and removes acquisition controls once accepted", async () => {
  const user = userEvent.setup();
  const creator = new CharacterCreator(fixtureCatalog());
  creator.submitLuckRoll({ id: "", dice: [0, 11] });
  function editor() {
    const generation = creator.getSnapshot().characteristicGeneration;
    return (
      <MantineProvider env="test">
        <LuckRoll
          roll={generation.drafts.luck}
          issues={generation.issues}
          showInitialAction
          onDiceAcquisitionError={vi.fn()}
          rollDice={createCharacteristicRoller(() => 0.45)}
          submitLuckRoll={(roll) => {
            creator.submitLuckRoll(roll);
            view.rerender(editor());
          }}
        />
      </MantineProvider>
    );
  }
  const view = render(editor());
  expect(screen.getByText("Luck requires a non-empty roll ID.")).toBeTruthy();
  expect(
    screen.getByText("Luck requires exactly two integer d10 faces (1–10)."),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Roll" }));
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.luck?.dice,
  ).toEqual([5, 5]);
  expect(screen.queryByRole("group", { name: "Luck roll" })).toBeNull();
  expect(screen.queryByText(/Luck requires/)).toBeNull();
});
