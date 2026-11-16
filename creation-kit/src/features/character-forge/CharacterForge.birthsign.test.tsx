import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BIRTHSIGN_CHARGE_TABLES } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import {
  characteristicCell,
  controlledReads,
  fillPointBuy,
  renderForge,
  selectRace,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";

it("bolds effect labels and signs only additive values in offered, quoted and selected packages", async () => {
  const catalog = fixtureCatalog((definitions) => {
    definitions.power.blessing = {
      label: "Blessing",
      description: "A granted power.",
    };
    definitions.birthsign.theMage = {
      label: "theMage",
      description: "Mage lore",
      bonuses: [
        { bonusType: "attribute", bonusTargetKey: "spMaximum", bonusValue: 1 },
        { bonusType: "attribute", bonusTargetKey: "speed", bonusValue: -2 },
        { bonusType: "characteristic", bonusTargetKey: "str", bonusValue: 3 },
        { bonusType: "characteristic", bonusTargetKey: "str", bonusValue: -2 },
        {
          bonusType: "replaceRolledCharacteristic",
          bonusTargetKey: "lck",
          bonusValue: 50,
        },
        {
          bonusType: "multiplier",
          bonusTargetKey: "naturalHealing",
          bonusValue: 2,
        },
        {
          bonusType: "extraLuckyNumber",
          count: 1,
          retainedRegardlessOfLuck: true,
        },
        {
          bonusType: "trait",
          bonusTargetKey: "magicWeakness",
          bonusParams: { type: "magic", X: 2 },
        },
        { bonusType: "power", bonusTargetKey: "blessing" },
        {
          bonusType: "choice",
          lifecycle: { selection: "once" },
          choiceGroup: {
            id: "gift",
            prompt: "Choose a gift",
            choose: 1,
            options: [
              {
                id: "wp",
                effects: [
                  {
                    bonusType: "characteristic",
                    bonusTargetKey: "wp",
                    bonusValue: 1,
                  },
                ],
              },
            ],
          },
        },
      ],
      starCursed: { overwriteBaseBonuses: false, bonuses: [] },
    };
  });
  function expectEffect(scope: HTMLElement, label: string, values: string[]) {
    const labels = within(scope).getAllByText(`${label}:`, {
      selector: "strong",
    });
    expect(labels.map((element) => element.parentElement?.textContent)).toEqual(
      values.map((value) => `${label}: ${value}`),
    );
  }
  function expectPackageEffects(scope: HTMLElement) {
    expectEffect(scope, "SP Maximum", ["+1"]);
    expectEffect(scope, "Speed", ["-2"]);
    expectEffect(scope, "Strength", ["+3, -2"]);
    expectEffect(scope, "Willpower", ["+1"]);
    expectEffect(scope, "Luck rolled value", ["50"]);
    expectEffect(scope, "Natural healing multiplier", ["2"]);
    expectEffect(scope, "Extra lucky numbers", [
      "1, retained regardless of Luck",
    ]);
    expectEffect(scope, "Trait", ['Weakness {"type":"magic","X":2} — ']);
    expectEffect(scope, "Power", ["Blessing — A granted power."]);
  }
  const user = userEvent.setup();
  renderForge(catalog);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(await screen.findByRole("button", { name: "theMage" }));
  const offered = await screen.findByLabelText("Available birthsign effects");
  expectEffect(offered, "SP Maximum", ["+1"]);
  expectEffect(offered, "Speed", ["-2"]);
  expectEffect(offered, "Strength", ["+3", "-2"]);
  expectEffect(offered, "Luck rolled value", ["50"]);
  expectEffect(offered, "Natural healing multiplier", ["2"]);
  expectEffect(offered, "Extra lucky numbers", [
    "1, retained regardless of Luck",
  ]);
  await waitFor(() => {
    expectEffect(offered, "Trait", ['Weakness {"type":"magic","X":2} — ']);
    expectEffect(offered, "Power", ["Blessing — A granted power."]);
  });
  const choice = screen.getByRole("group", { name: "Choose a gift" });
  expectEffect(choice, "Willpower", ["+1"]);
  await user.click(within(choice).getByRole("checkbox", { name: /Willpower/ }));
  const quoted = await screen.findByLabelText("Birthsign effects");
  await waitFor(() => expectPackageEffects(quoted));
  await user.click(
    screen.getByRole("button", { name: "Use this Birthsign (burn 5 luck)" }),
  );
  await screen.findByRole("heading", { name: "theMage" });
  const selected = await screen.findByLabelText("Birthsign effects");
  await waitFor(() => expectPackageEffects(selected));
});

it("rolls one complete d5 sequence and preserves it while browsing and navigating", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label:
            key === "theLady" || key === "theSteed" ? `Localized ${key}` : key,
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
  await screen.findByRole("heading", { name: "Determine Birthsign" });
  expect(
    within(screen.getByRole("navigation", { name: "Character creation steps" }))
      .getByRole("button", { name: "Determine Birthsign" })
      .getAttribute("aria-current"),
  ).toBe("step");
  expect(roll).not.toHaveBeenCalled();
  const warrior = await screen.findByRole("radio", { name: "Warrior" });
  await screen.findByText("Localized theLady");
  const mage = screen.getByRole("radio", { name: "Mage" });
  const thief = screen.getByRole("radio", { name: "Thief" });
  expect(screen.getByRole("group", { name: "Charge" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Roll Birthsign" })).toHaveProperty(
    "disabled",
    true,
  );
  const warriorCard = warrior.closest("label")!;
  expect(
    within(warriorCard)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "theWarrior",
    "Localized theLady",
    "Localized theSteed",
    "theLord",
  ]);
  expect(within(warriorCard).queryByRole("button")).toBeNull();
  await user.click(within(warriorCard).getByText("Localized theLady"));
  expect(warrior).toHaveProperty("checked", true);
  expect(mage).toHaveProperty("checked", false);
  await user.keyboard("{ArrowRight}");
  expect(mage).toHaveProperty("checked", true);
  expect(thief).toHaveProperty("checked", false);
  await user.click(warrior);
  expect(
    screen.getAllByText(
      "On a 5, the result is rerolled for a star-cursed birthsign.",
    ),
  ).toHaveLength(1);
  expect(
    screen.getByText(
      "On a 5, the result is rerolled for a star-cursed birthsign.",
    ).style.fontStyle,
  ).toBe("italic");
  await user.click(screen.getByRole("button", { name: "Roll Birthsign" }));
  await screen.findByRole("heading", { name: "Localized theSteed" });
  await screen.findByText("Description for theSteed");
  const burnSummary = await screen.findByText("Burning 0 Luck");
  expect(burnSummary.style.fontWeight).toBe("700");
  expect(burnSummary.style.textAlign).toBe("right");
  expect(burnSummary.parentElement?.lastElementChild).toBe(burnSummary);
  expect(burnSummary.querySelector("svg")).toBeNull();
  expect(screen.queryByText(/Purchase cost:/)).toBeNull();
  expect(screen.queryByText(/Luck before purchase:/)).toBeNull();
  expect(screen.queryByText(/Original Roll:/)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "restore rolled birthsign" }),
  ).toBeNull();
  expect(roll).toHaveBeenCalledTimes(3);
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  expect(
    screen.getByText("Original Roll: Localized theSteed (5 → 5 → 3)"),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Localized theSteed" }),
  ).toBeNull();
  expect(screen.queryByText("Description for theSteed")).toBeNull();
  expect(screen.queryByText(/^Burning /)).toBeNull();
  expect(screen.queryByText("Star-Cursed", { exact: true })).toBeNull();
  expect(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Close chooser" })).toBeNull();
  await user.click(
    screen.getByRole("button", {
      name: BIRTHSIGN_CHARGE_TABLES[1]!.entries[0],
    }),
  );
  const use = await screen.findByRole("button", {
    name: "Use this Birthsign (burn 5 luck)",
  });
  await waitFor(() => expect(use).toHaveProperty("disabled", false));
  expect(screen.getByText("Burning 5 Luck")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Localized theSteed" }),
  ).toBeNull();
  await user.click(use);
  await screen.findByRole("heading", { name: "theMage" });
  expect(
    screen.getByText("Original Roll: Localized theSteed (5 → 5 → 3)"),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  expect(
    screen.getByText("Original Roll: Localized theSteed (5 → 5 → 3)"),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "theLord" }));
  await screen.findByRole("heading", { name: "Inspecting theLord" });
  await user.click(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  );
  await screen.findByRole("heading", { name: "Localized theSteed" });
  expect(
    screen.queryByRole("heading", { name: "Choose a Birthsign" }),
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Inspecting theLord" }),
  ).toBeNull();
  expect(screen.queryByText(/Original Roll:/)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "restore rolled birthsign" }),
  ).toBeNull();
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  expect(screen.queryByRole("heading", { name: /Inspecting/ })).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  );
  expect(roll).toHaveBeenCalledTimes(3);
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(
    await screen.findByRole("heading", { name: "Localized theSteed" }),
  ).toBeTruthy();
  expect(screen.queryByText(/Original Roll:/)).toBeNull();
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
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  await waitFor(() =>
    expect(reads.get).toHaveBeenCalledWith("birthsign", "theMage"),
  );
  expect(screen.getByText("Burning — Luck")).toBeTruthy();
  expect(screen.queryByText("Burning 0 Luck")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Use this Birthsign/ }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await screen.findByText("Lore theThief");
  await screen.findByText("Burning 5 Luck");
  expect(
    await screen.findByRole("button", {
      name: "Use this Birthsign (burn 5 luck)",
    }),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Options" }));
  await user.click(
    await screen.findByRole("switch", { name: /Use Player-Chosen Birthsigns/ }),
  );
  await user.click(screen.getByRole("button", { name: "theThief" }));
  expect(
    await screen.findByRole("button", { name: "Use this Birthsign" }),
  ).toBeTruthy();
  await act(async () => {
    held.resolve();
    await held.promise;
  });
  expect(screen.getByText("Lore theThief")).toBeTruthy();
  expect(screen.queryByText("Lore theMage")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Use this Birthsign" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /Use this Birthsign \(burn/ }),
  ).toBeNull();
  expect(screen.getByText("Burning 0 Luck")).toBeTruthy();
});

it("labels upgrade and candidate prices from Core without combining innate Luck penalties", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label: key,
          description: `Lore ${key}`,
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        };
    definitions.birthsign.theRitual!.starCursed.bonuses = [
      { bonusType: "characteristic", bonusTargetKey: "lck", bonusValue: -5 },
    ];
  });
  const user = userEvent.setup();
  renderForge(catalog, undefined, "test", () => 1);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("radio", { name: "Warrior" }));
  await user.click(screen.getByRole("button", { name: "Roll Birthsign" }));
  await screen.findByRole("heading", { name: "theWarrior" });
  await user.click(screen.getByRole("button", { name: "Options" }));
  const freeChoice = await screen.findByRole("switch", {
    name: /Use Player-Chosen Birthsigns/,
  });
  await user.click(freeChoice);
  expect(screen.queryByText(/Original Roll:/)).toBeNull();
  expect(screen.queryByRole("heading", { name: "theWarrior" })).toBeNull();
  expect(screen.queryByText("Lore theWarrior")).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Take Star-Cursed version/ }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "restore rolled birthsign" }),
  ).toBeNull();
  await user.click(freeChoice);
  const upgrade = await screen.findByRole("button", {
    name: "Take Star-Cursed version (burn 5 luck)",
  });
  await user.click(upgrade);
  await screen.findByText("Star-Cursed", { exact: true });
  expect(screen.getByText("Original Roll: theWarrior (1)")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "theWarrior" })).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Choose a Birthsign" }),
  ).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Variant" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Take Star-Cursed version/ }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: /Use this Birthsign/ }),
  ).toBeNull();
  await screen.findByText("Burning 5 Luck");
  expect(screen.getAllByText("Lore theWarrior")).toHaveLength(1);
  expect(screen.getAllByText("Burning 5 Luck")).toHaveLength(1);
  expect(
    characteristicCell("Luck", "Total").getAttribute("aria-description"),
  ).toMatch(/ - 5 = /);
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  const boughtNormal = await screen.findByRole("button", {
    name: "Use this Birthsign (burn 5 luck)",
  });
  await user.click(boughtNormal);
  await screen.findByRole("heading", { name: "theMage" });
  expect(
    screen.queryByRole("button", { name: /Take Star-Cursed version/ }),
  ).toBeNull();
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  await screen.findByRole("button", {
    name: "Use this Birthsign (burn 10 luck)",
  });
  expect(screen.getByText("Burning 10 Luck")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "theRitual" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  const ritual = await screen.findByRole("button", {
    name: "Use this Birthsign (burn 10 luck)",
  });
  await waitFor(() => expect(ritual).toHaveProperty("disabled", false));
  await user.click(ritual);
  await screen.findByRole("heading", { name: "theRitual" });
  await screen.findByText("Burning 10 Luck");
  expect(screen.queryByText(/Purchase cost:|Luck before purchase:/)).toBeNull();
  expect(
    characteristicCell("Luck", "Total").getAttribute("aria-description"),
  ).toMatch(/ - 5 - 10 = /);
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theWarrior" }));
  const original = await screen.findByRole("button", {
    name: "Use this Birthsign",
  });
  expect(original).toHaveProperty("disabled", false);
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
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theMage" }));
  const choice = await screen.findByRole("checkbox", { name: /Luck/ });
  expect(
    screen.getByRole("button", { name: "Use this Birthsign (burn 5 luck)" }),
  ).toHaveProperty("disabled", true);
  await user.click(choice);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use this Birthsign (burn 5 luck)" }),
    ).toHaveProperty("disabled", false),
  );
  expect(screen.queryByRole("heading", { name: "theMage" })).toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Use this Birthsign (burn 5 luck)" }),
  );
  await screen.findByRole("heading", { name: "theMage" });
  expect(screen.getByRole("checkbox", { name: /Luck/ })).toHaveProperty(
    "checked",
    true,
  );
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  expect(screen.queryByRole("heading", { name: "theMage" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: /Luck/ })).toBeNull();
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  await screen.findByText(/requires its naturally rolled sign/);
  expect(screen.getByText("Burning — Luck")).toBeTruthy();
  expect(screen.queryByText("Burning 0 Luck")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Use this Birthsign" }),
  ).toHaveProperty("disabled", true);
  await user.click(screen.getByRole("button", { name: "Options" }));
  await user.click(
    await screen.findByRole("switch", { name: /Use Player-Chosen Birthsigns/ }),
  );
  expect(
    screen.getByRole("heading", { name: "Choose a birthsign" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  ).toBeNull();
  await user.click(screen.getByRole("button", { name: "theThief" }));
  await user.click(screen.getByRole("combobox", { name: "Variant" }));
  await user.click(screen.getByRole("option", { name: "Star-Cursed" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Use this Birthsign" }),
    ).toHaveProperty("disabled", false),
  );
  expect(screen.getByText("Burning 0 Luck")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Use this Birthsign" }));
  await user.click(
    screen.getByRole("switch", { name: /Use Player-Chosen Birthsigns/ }),
  );
  await screen.findByRole("heading", { name: "theThief" });
});

it("keeps the original selected when Core rejects an unaffordable immediate upgrade", async () => {
  const catalog = fixtureCatalog((definitions) => {
    definitions.birthsign.theWarrior = {
      label: "theWarrior",
      description: "Warrior lore",
      bonuses: [],
      starCursed: {
        overwriteBaseBonuses: false,
        bonuses: [
          {
            bonusType: "characteristic",
            bonusTargetKey: "lck",
            bonusValue: -100,
          },
        ],
      },
    };
  });
  const user = userEvent.setup();
  renderForge(catalog, undefined, "test", () => 1);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("radio", { name: "Warrior" }));
  await user.click(screen.getByRole("button", { name: "Roll Birthsign" }));
  await screen.findByRole("heading", { name: "theWarrior" });
  const originalLuck = characteristicCell("Luck", "Total").textContent;
  const upgrade = await screen.findByRole("button", {
    name: "Take Star-Cursed version (burn 5 luck)",
  });
  await waitFor(() => expect(upgrade).toHaveProperty("disabled", false));
  await user.click(upgrade);
  await screen.findByText(
    "A birthsign purchase cannot leave final Luck below zero.",
  );
  expect(screen.getByText("Normal", { exact: true })).toBeTruthy();
  expect(characteristicCell("Luck", "Total").textContent).toBe(originalLuck);
  expect(
    screen.queryByRole("heading", { name: "Choose a Birthsign" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "restore rolled birthsign" }),
  ).toBeNull();
  expect(screen.queryByText(/Original Roll:/)).toBeNull();
});

it("edits Star-Cursed required choices in the main display and restores retained original answers", async () => {
  const catalog = fixtureCatalog((definitions) => {
    for (const table of BIRTHSIGN_CHARGE_TABLES)
      for (const key of table.entries)
        definitions.birthsign[key] = {
          label: key,
          description: `Lore ${key}`,
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        };
    definitions.birthsign.theMage!.bonuses = [
      {
        bonusType: "choice",
        lifecycle: { selection: "once" },
        choiceGroup: {
          id: "original-gift",
          prompt: "Original gift",
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
    definitions.birthsign.theMage!.starCursed = {
      overwriteBaseBonuses: true,
      bonuses: [
        {
          bonusType: "choice",
          lifecycle: { selection: "once" },
          choiceGroup: {
            id: "cursed-gift",
            prompt: "Cursed gift",
            choose: 1,
            options: [
              {
                id: "lck",
                effects: [
                  {
                    bonusType: "characteristic",
                    bonusTargetKey: "lck",
                    bonusValue: 7,
                  },
                ],
              },
            ],
          },
        },
      ],
    };
  });
  const user = userEvent.setup();
  renderForge(catalog, undefined, "test", () => 1);
  await selectRace("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("radio", { name: "Mage" }));
  await user.click(screen.getByRole("button", { name: "Roll Birthsign" }));
  await user.click(await screen.findByRole("checkbox", { name: /Luck/ }));
  const originalLuck = characteristicCell("Luck", "Total").textContent;
  const upgrade = await screen.findByRole("button", {
    name: "Take Star-Cursed version (burn 5 luck)",
  });
  await waitFor(() => expect(upgrade).toHaveProperty("disabled", false));
  await user.click(upgrade);
  await screen.findByRole("group", { name: "Cursed gift" });
  expect(screen.getByRole("heading", { name: "theMage" })).toBeTruthy();
  expect(screen.getByText("Star-Cursed", { exact: true })).toBeTruthy();
  expect(screen.getByText("Original Roll: theMage (1)")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "Choose a Birthsign" }),
  ).toBeNull();
  expect(screen.queryByRole("group", { name: "Original gift" })).toBeNull();
  expect(screen.getByRole("checkbox", { name: /Luck/ })).toHaveProperty(
    "checked",
    false,
  );
  expect(
    characteristicCell("Luck", "Total").getAttribute("aria-description"),
  ).not.toContain(" - 5 = ");
  await user.click(screen.getByRole("checkbox", { name: /Luck/ }));
  await waitFor(() =>
    expect(
      characteristicCell("Luck", "Total").getAttribute("aria-description"),
    ).toMatch(/ \+ 7 - 5 = /),
  );
  await user.click(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  );
  await screen.findByRole("group", { name: "Original gift" });
  expect(screen.getByRole("checkbox", { name: /Luck/ })).toHaveProperty(
    "checked",
    true,
  );
  expect(characteristicCell("Luck", "Total").textContent).toBe(originalLuck);
  expect(
    screen.queryByRole("button", { name: "restore rolled birthsign" }),
  ).toBeNull();
  expect(screen.queryByText(/Original Roll:/)).toBeNull();

  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  await user.click(screen.getByRole("button", { name: "theWarrior" }));
  const purchase = await screen.findByRole("button", {
    name: "Use this Birthsign (burn 5 luck)",
  });
  await waitFor(() => expect(purchase).toHaveProperty("disabled", false));
  await user.click(purchase);
  await screen.findByRole("heading", { name: "theWarrior" });
  expect(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  ).toBeTruthy();
  await user.click(
    screen.getByRole("button", {
      name: "Burn luck to choose a birthsign instead",
    }),
  );
  expect(screen.queryByRole("group", { name: "Original gift" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "theMage" }));
  const provisional = await screen.findByRole("checkbox", { name: /Luck/ });
  expect(provisional).toHaveProperty("checked", false);
  await user.click(provisional);
  await user.click(
    screen.getByRole("button", { name: "restore rolled birthsign" }),
  );
  await screen.findByRole("group", { name: "Original gift" });
  expect(screen.getByRole("checkbox", { name: /Luck/ })).toHaveProperty(
    "checked",
    true,
  );
  expect(characteristicCell("Luck", "Total").textContent).toBe(originalLuck);
  expect(screen.queryByRole("heading", { name: /Inspecting/ })).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Choose a Birthsign" }),
  ).toBeNull();
});
