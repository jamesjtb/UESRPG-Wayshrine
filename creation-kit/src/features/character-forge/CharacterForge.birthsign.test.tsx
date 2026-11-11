import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BIRTHSIGN_CHARGE_TABLES } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import {
  controlledReads,
  fillPointBuy,
  renderForge,
  selectRace,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";

it("rolls one complete d5 sequence and preserves it while browsing and navigating", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label: key,
          description: `Description for ${key}`,
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        };
  });
  const roll = vi
    .fn()
    .mockReturnValueOnce(5)
    .mockReturnValueOnce(5)
    .mockReturnValue(3);
  const user = userEvent.setup();
  renderForge(catalog, undefined, "test", roll);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Birthsign" });
  expect(roll).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Warrior" }));
  await user.click(screen.getByRole("button", { name: "Roll birthsign" }));
  await screen.findByText("Roll: 5 → 5 → 3 (Warrior)");
  expect(roll).toHaveBeenCalledTimes(3);
  await user.click(
    screen.getByRole("button", { name: "Choose a Birthsign instead…" }),
  );
  await user.click(
    screen.getByRole("button", {
      name: BIRTHSIGN_CHARGE_TABLES[1]!.entries[0],
    }),
  );
  const use = await screen.findByRole("button", { name: "Use this Birthsign" });
  await waitFor(() => expect(use).toHaveProperty("disabled", false));
  expect(screen.getByRole("heading", { name: "theSteed" })).toBeTruthy();
  await user.click(use);
  await screen.findByRole("heading", { name: "theMage" });
  await user.click(
    screen.getByRole("button", { name: "Restore original birthsign" }),
  );
  await screen.findByRole("heading", { name: "theSteed" });
  expect(roll).toHaveBeenCalledTimes(3);
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Roll: 5 → 5 → 3 (Warrior)")).toBeTruthy();
  expect(roll).toHaveBeenCalledTimes(3);
});

it("ignores a late quote for a candidate that is no longer being inspected", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label: key,
          description: `Lore ${key}`,
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        };
  });
  const reads = controlledReads(catalog);
  const held = reads.hold("birthsign", "theMage");
  const user = userEvent.setup();
  renderForge(catalog);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", { name: "Choose a Birthsign instead…" }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  await waitFor(() =>
    expect(reads.get).toHaveBeenCalledWith("birthsign", "theMage"),
  );
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await screen.findByText("Lore theThief");
  await act(async () => {
    held.resolve();
    await held.promise;
  });
  expect(screen.getByText("Lore theThief")).toBeTruthy();
  expect(screen.queryByText("Lore theMage")).toBeNull();
});

it("keeps choice answers provisional and applies the restricted Thief free-choice override", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label: key,
          description: key,
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        };
    definitions.birthsign.theMage!.bonuses = [
      {
        bonusType: "choice",
        lifecycle: { selection: "once" },
        choiceGroup: {
          id: "gift",
          prompt: "Choose a gift",
          choose: 1,
          options: [
            {
              id: "lck",
              effects: [
                {
                  bonusType: "characteristic",
                  bonusTargetKey: "lck",
                  bonusValue: 3,
                },
              ],
            },
          ],
        },
      },
    ];
    definitions.birthsign.theThief!.starCursed.eligibility = {
      requiresNaturallyRolledSign: true,
      canSelectBySpendingLuck: false,
    };
  });
  const user = userEvent.setup();
  renderForge(catalog);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", { name: "Choose a Birthsign instead…" }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  const choice = await screen.findByRole("checkbox", { name: /Luck/ });
  expect(
    screen.getByRole("button", { name: "Use this Birthsign" }),
  ).toHaveProperty("disabled", true);
  await user.click(choice);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use this Birthsign" }),
    ).toHaveProperty("disabled", false),
  );
  expect(screen.queryByRole("heading", { name: "theMage" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Use this Birthsign" }));
  await screen.findByRole("heading", { name: "theMage" });
  await user.click(
    screen.getByRole("button", { name: "Choose a Birthsign instead…" }),
  );
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  await screen.findByText(/requires its naturally rolled sign/);
  expect(
    screen.getByRole("button", { name: "Use this Birthsign" }),
  ).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("button", { name: "Options" }));
  await user.click(
    await screen.findByRole("switch", { name: /Use Player-Chosen Birthsigns/ }),
  );
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use this Birthsign" }),
    ).toHaveProperty("disabled", false),
  );
  await user.click(screen.getByRole("button", { name: "Use this Birthsign" }));
  await screen.findByRole("heading", { name: "theThief" });
});
