import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { LuckRoll } from "./LuckRoll";

it("keeps validation for an invalid supplied Luck roll and clears feedback after a valid reroll", async () => {
  const user = userEvent.setup();
  const creator = new CharacterCreator(fixtureCatalog());
  await creator.chooseRace("argonian");
  creator.submitLuckRoll({ id: "", dice: [0, 11] });
  const rollDice = createCharacteristicRoller(() => 0.45);

  function editor() {
    const generation = creator.getSnapshot().characteristicGeneration;
    return (
      <MantineProvider env="test">
        <LuckRoll
          roll={generation.drafts.luck}
          issues={generation.issues}
          rollDice={rollDice}
          submitLuckRoll={(roll) => creator.submitLuckRoll(roll)}
        />
      </MantineProvider>
    );
  }

  const view = render(editor());
  expect(screen.getByText("Luck requires a non-empty roll ID.")).toBeTruthy();
  expect(
    screen.getByText("Luck requires exactly two integer d10 faces (1–10)."),
  ).toBeTruthy();
  expect(creator.getCharacterPreview().characteristics.lck).toMatchObject({
    baseline: 30,
    rolled: 0,
  });
  await user.click(
    within(screen.getByRole("group", { name: "Luck roll" })).getByRole(
      "button",
      { name: "Reroll" },
    ),
  );
  view.rerender(editor());
  expect(screen.queryByText(/Luck requires/)).toBeNull();
  expect(screen.queryByText(/Luck uses a separate|Luck baseline:/)).toBeNull();
  const tile = screen.getByRole("button", { name: "Luck roll, total 10" });
  await user.click(tile);
  expect(
    screen.getByText("2d10: 5 + 5 = 10", { selector: '[role="status"]' }),
  ).toBeTruthy();
  expect(creator.getCharacterPreview().characteristics.lck).toMatchObject({
    baseline: 30,
    rolled: 10,
  });
  expect(
    creator
      .getSnapshot()
      .characteristicGeneration.issues.some((issue) => issue.field === "luck"),
  ).toBe(false);
});
