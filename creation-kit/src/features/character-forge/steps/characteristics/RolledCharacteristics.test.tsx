import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { RolledCharacteristics } from "./RolledCharacteristics";

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
