import { Button, MantineProvider, Switch } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import { createCharacteristicRoller } from "./dice";
import { RolledCharacteristics } from "./RolledCharacteristics";
import { useCharacterCreator } from "../../useCharacterCreator";
import { CharacteristicDraftPreview } from "./CharacteristicDraftPreview";
import { assignDraftResult } from "../../test/forgeTestHelpers";

function renderRolled(random: () => number = () => 0.45) {
  const catalog = fixtureCatalog();
  const rollDice = vi.fn(createCharacteristicRoller(random));
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  function Harness() {
    const creator = useCharacterCreator(catalog);
    if (!creator.view) return null;
    const generation = creator.view.snapshot.characteristicGeneration;
    return (
      <>
        <CharacteristicDraftPreview
          characteristics={creator.view.preview.characteristics}
          raceUsable={creator.view.preview.race !== undefined}
          generation={generation}
          setFavoredCharacteristics={creator.setFavoredCharacteristics}
          setCharacteristicAssignments={creator.setCharacteristicAssignments}
          setCharacteristicAllocations={creator.setCharacteristicAllocations}
        />
        <RolledCharacteristics
          draft={generation.drafts.rolled}
          issues={generation.issues}
          rollDice={rollDice}
          submitCharacteristicRolls={creator.submitCharacteristicRolls}
          rerolls={generation.rerolls}
          rerollCharacteristics={creator.rerollCharacteristics}
          onDiceAcquisitionError={creator.reportDiceAcquisitionFailure}
        />
        <Switch
          label="Unlimited Rerolls"
          checked={generation.rerolls.unlimited}
          onChange={(event) =>
            creator.setUnlimitedCharacteristicRerolls(
              event.currentTarget.checked,
            )
          }
        />
        <Button
          onClick={() =>
            creator.rerollCharacteristics(
              [generation.drafts.rolled.rolls[6]!.id],
              rollDice,
            )
          }
        >
          Spend batch externally
        </Button>
      </>
    );
  }
  render(
    <MantineProvider env="test">
      <Harness />
    </MantineProvider>,
  );
  return {
    user: userEvent.setup(),
    rollDice,
    generation: () =>
      snapshots.mock.results.at(-1)!.value.characteristicGeneration,
  };
}

function tile(ordinal: number) {
  return within(
    screen.getByRole("group", { name: `Roll ${ordinal}` }),
  ).getByRole("button");
}

it("directly toggles by mouse, keyboard and touch, caps selection, and acquires dice only from the batch button", async () => {
  const { user, rollDice, generation } = renderRolled();
  const initial = screen.getByRole("button", {
    name: "Make Characteristic Roll",
  });
  expect(initial.hasAttribute("data-block")).toBe(true);
  await user.click(initial);
  expect(rollDice).toHaveBeenCalledTimes(7);
  expect(document.activeElement).toBe(tile(1));
  const before = generation();
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  expect(tile(1).getAttribute("aria-haspopup")).toBeNull();
  await user.click(tile(1));
  expect(tile(1).getAttribute("aria-pressed")).toBe("true");
  await user.click(tile(1));
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  tile(1).focus();
  await user.keyboard(" ");
  await user.pointer([
    { keys: "[TouchA>]", target: tile(2) },
    { keys: "[/TouchA]" },
  ]);
  tile(3).focus();
  await user.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Reroll (3 of 3)" }),
  ).toHaveProperty("disabled", false);
  expect(tile(4).getAttribute("aria-disabled")).toBe("true");
  expect(tile(1).getAttribute("aria-disabled")).toBe("false");
  await user.click(tile(4));
  expect(tile(4).getAttribute("aria-pressed")).toBe("false");
  await user.click(tile(1));
  expect(tile(4).getAttribute("aria-disabled")).toBe("false");
  expect(rollDice).toHaveBeenCalledTimes(7);
  expect(generation()).toEqual(before);
  expect(screen.queryByRole("menu")).toBeNull();
  await assignDraftResult(user, "Strength", 3);
  expect(screen.queryByRole("group", { name: "Roll 4" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Reroll (2 of 3)" }));
  expect(rollDice).toHaveBeenCalledTimes(9);
  expect(document.activeElement).toBe(tile(2));
  expect(generation().drafts.rolled.assignments).toEqual({
    str: before.drafts.rolled.rolls[3]!.id,
  });
  expect(generation().drafts.rolled.rolls[0]).toEqual(
    before.drafts.rolled.rolls[0],
  );
  expect(generation().rerolls.batchSpent).toBe(true);
  expect(screen.getByRole("button", { name: "Reroll Used" })).toHaveProperty(
    "disabled",
    true,
  );
  for (const button of within(
    screen.getByRole("group", { name: "Characteristic rolls" }),
  ).getAllByRole("button")) {
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-pressed")).toBe("false");
  }
  await user.click(tile(1));
  tile(1).focus();
  await user.keyboard("{Enter} ");
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  expect(rollDice).toHaveBeenCalledTimes(9);
});

it("clears selection when assignment hides a result and does not restore it when unassigned", async () => {
  const { user, rollDice, generation } = renderRolled();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  await user.click(tile(1));
  await assignDraftResult(user, "Strength", 0);
  expect(screen.queryByRole("group", { name: "Roll 1" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Reroll (0 of 3)" }),
  ).toHaveProperty("disabled", true);
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Strength" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  expect(generation().rerolls.batchSpent).toBe(false);
  expect(rollDice).toHaveBeenCalledTimes(7);
});

it("keeps selected results deselectable when unlimited is disabled above the cap and obeys spent Core policy", async () => {
  const { user, generation } = renderRolled();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
  await user.click(unlimited);
  for (let i = 1; i <= 7; i++) await user.click(tile(i));
  await user.click(unlimited);
  expect(
    screen.getByRole("button", { name: "Reroll (7 of 3)" }),
  ).toHaveProperty("disabled", true);
  for (let i = 1; i <= 7; i++)
    expect(tile(i).getAttribute("aria-disabled")).toBe("false");
  for (let i = 4; i <= 7; i++) await user.click(tile(i));
  expect(tile(4).getAttribute("aria-disabled")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Reroll (3 of 3)" }));
  expect(generation().rerolls.batchSpent).toBe(true);
  expect(tile(1).getAttribute("aria-disabled")).toBe("true");
  await user.click(unlimited);
  await user.click(tile(1));
  await user.click(screen.getByRole("button", { name: "Reroll" }));
  await user.click(unlimited);
  expect(generation().rerolls.batchSpent).toBe(true);
  expect(tile(1).getAttribute("aria-disabled")).toBe("true");
});

it("keeps a selected result deselectable even if another command spends the Core allowance", async () => {
  const { user, generation } = renderRolled();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  await user.click(tile(1));
  await user.click(
    screen.getByRole("button", { name: "Spend batch externally" }),
  );
  expect(generation().rerolls.available).toBe(false);
  expect(tile(1).getAttribute("aria-pressed")).toBe("true");
  expect(tile(1).getAttribute("aria-disabled")).toBe("false");
  expect(tile(2).getAttribute("aria-disabled")).toBe("true");
  await user.click(tile(1));
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  expect(tile(1).getAttribute("aria-disabled")).toBe("true");
});

it("retains selection and accepted dice on a Core rejection and focuses the replacement after retry", async () => {
  const { user, rollDice, generation } = renderRolled();
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  const before = generation();
  await user.click(tile(1));
  rollDice.mockReturnValueOnce({ id: "invalid", dice: [0, 11] });
  await user.click(screen.getByRole("button", { name: "Reroll (1 of 3)" }));
  expect(screen.getByRole("status").textContent).toContain(
    "two integer d10 faces",
  );
  expect(tile(1).getAttribute("aria-pressed")).toBe("true");
  expect(generation()).toEqual(before);
  await user.click(screen.getByRole("button", { name: "Reroll (1 of 3)" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(tile(1).getAttribute("aria-pressed")).toBe("false");
  expect(document.activeElement).toBe(tile(1));
  expect(rollDice).toHaveBeenCalledTimes(9);
});

it("keeps equal totals accessible by ordinal with dice tooltips and no nested controls", async () => {
  const { user } = renderRolled(() => 0.6);
  await user.click(
    screen.getByRole("button", { name: "Make Characteristic Roll" }),
  );
  for (let i = 1; i <= 7; i++)
    expect(screen.getByRole("button", { name: `Roll ${i}, total 14` })).toBe(
      tile(i),
    );
  expect(tile(1).getAttribute("aria-description")).toContain(
    "2d10: 7 + 7 = 14",
  );
  await user.hover(tile(1));
  expect((await screen.findByRole("tooltip")).textContent).toBe(
    "2d10: 7 + 7 = 14",
  );
  expect(tile(1).querySelector("button")).toBeNull();
  await user.click(tile(1));
  expect(tile(1).textContent).toBe("14Rerolling");
  expect(tile(1).getAttribute("aria-description")).toContain(
    "Selected for reroll",
  );
  expect(screen.queryByRole("menu")).toBeNull();
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
        rerolls={generation.rerolls}
        rerollCharacteristics={() => undefined}
        onDiceAcquisitionError={vi.fn()}
        submitCharacteristicRolls={(rolls) =>
          creator.submitCharacteristicRolls(rolls)
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
