import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it } from "vitest";
import { fixtureCatalog } from "../../test/testCatalog";
import {
  assignDraftResult,
  controlledReads,
} from "../../test/forgeTestHelpers";
import { CharacteristicDraftPreview } from "./CharacteristicDraftPreview";

async function setup() {
  const catalog = fixtureCatalog();
  const creator = new CharacterCreator(catalog);
  await creator.chooseRace("argonian");
  creator.setCharacteristicGenerationMethod("rolled");
  function view() {
    const preview = creator.getCharacterPreview();
    return (
      <MantineProvider env="test">
        <CharacteristicDraftPreview
          characteristics={preview.characteristics}
          raceUsable={preview.race !== undefined}
          generation={creator.getSnapshot().characteristicGeneration}
          setCharacteristicAllocations={(allocations) => {
            creator.setCharacteristicAllocations(allocations);
            refresh();
          }}
          setCharacteristicAssignments={(assignments) => {
            creator.setCharacteristicAssignments(assignments);
            refresh();
          }}
          rerollLuck={() => {
            creator.rerollCharacteristics([], {
              id: "luck-replacement",
              dice: [2, 3],
            });
            refresh();
          }}
          setFavoredCharacteristics={(favored) => {
            creator.setFavoredCharacteristics(favored);
            refresh();
          }}
        />
      </MantineProvider>
    );
  }
  const rendered = render(view());
  function refresh() {
    rendered.rerender(view());
  }
  return { creator, catalog, refresh };
}

function cell(row: string, label: string) {
  const table = within(
    screen.getByRole("table", { name: "Characteristic draft preview" }),
  );
  const header = table.getByRole("rowheader", { name: label });
  const index = ["Baseline", "Generated", "Total"].indexOf(row);
  const target = within(header.closest("tr")!).getAllByRole("cell")[index]!;
  const input = target.querySelector("input");
  return input ? input.value : target.textContent;
}

function expectEmptyRolledCell(label: string) {
  const trigger = screen.getByRole("button", {
    name: `Rolled result for ${label}`,
  });
  expect(trigger.textContent).toBe("");
  expect(
    trigger
      .querySelector(".tabler-icon-chevron-down")
      ?.getAttribute("aria-hidden"),
  ).toBe("true");
  expect(trigger.querySelector(".tabler-icon-chevron-left")).toBeNull();
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
}

const rolls = Array.from({ length: 7 }, (_, index) => ({
  id: `r${index}`,
  dice: [index + 1, 5],
}));

it("keeps generation-only totals independent of projected modifiers, costs and rolled replacements", async () => {
  const creator = new CharacterCreator(fixtureCatalog());
  await creator.chooseRace("argonian");
  creator.setCharacteristicGenerationMethod("rolled");
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  const preview = creator.getCharacterPreview();
  preview.updateCharacteristic("lck", {
    rolled: 50,
    modifiers: [
      { sourceId: "birthsign/effect", sourceText: "Effect", value: -5 },
    ],
    purchaseCost: {
      sourceId: "birthsign/purchase",
      sourceText: "Purchase",
      value: 10,
    },
  });
  render(
    <MantineProvider env="test">
      <CharacteristicDraftPreview
        characteristics={preview.characteristics}
        raceUsable={true}
        generation={creator.getSnapshot().characteristicGeneration}
        setCharacteristicAllocations={() => {}}
        setCharacteristicAssignments={() => {}}
        setFavoredCharacteristics={() => {}}
      />
    </MantineProvider>,
  );
  expect(cell("Generated", "Luck")).toBe("9");
  expect(cell("Total", "Luck")).toBe("39");
});

it("shows partial assignments immediately without changing Core's atomic sheet preview", async () => {
  const { creator, refresh } = await setup();
  creator.submitCharacteristicRolls(rolls);
  creator.setCharacteristicAssignments({ str: "r0", int: "r1" });
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  refresh();
  expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  expect(
    screen.getByRole("rowheader", { name: "Strength" }).querySelector("abbr")
      ?.title,
  ).toBe("Strength");
  expect(screen.getByRole("rowheader", { name: "Luck" }).textContent).toBe(
    "Lck",
  );
  expect(
    screen.getAllByRole("rowheader").map((row) => row.textContent),
  ).toEqual(["Str", "End", "Ag", "Int", "Wp", "Prc", "Prs", "Lck"]);
  const table = screen.getByRole("table", {
    name: "Characteristic draft preview",
  });
  expect(table.querySelector("caption")).toBeNull();
  expect(table.style.getPropertyValue("--table-layout")).toBe("fixed");
  expect(table.style.width).toBe("100%");
  expect(
    screen.queryByLabelText("Characteristic draft table scrolling"),
  ).toBeNull();
  expect(cell("Baseline", "Strength")).toBe("25");
  expect(cell("Generated", "Strength")).toBe("6");
  expect(cell("Total", "Strength")).toBe("31");
  expect(cell("Generated", "Intelligence")).toBe("7");
  expectEmptyRolledCell("Endurance");
  expect(cell("Total", "Endurance")).toBe("25");
  expect(cell("Baseline", "Luck")).toBe("30");
  expect(cell("Generated", "Luck")).toBe("9");
  expect(cell("Total", "Luck")).toBe("39");
  expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(0);
  expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);

  creator.setCharacteristicAssignments({
    str: "r0",
    end: "r1",
    ag: "r2",
    int: "r3",
    wp: "r4",
    prc: "r5",
    prs: "r6",
  });
  refresh();
  expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(6);
  expect(cell("Baseline", "Strength")).toBe("25");
  expect(cell("Total", "Strength")).toBe("31");

  creator.setCharacteristicAssignments({
    str: "r0",
    end: "r0",
    int: "unknown",
  });
  refresh();
  expect(cell("Generated", "Strength")).toBe("Invalid");
  expect(cell("Generated", "Endurance")).toBe("Invalid");
  expect(cell("Generated", "Intelligence")).toBe("Invalid");
  expect(cell("Total", "Strength")).toBe("25");
});

it("renders a single transposed table with full accessible names and seven unique star controls", async () => {
  const { creator, refresh } = await setup();
  creator.submitCharacteristicRolls(rolls);
  creator.setCharacteristicAssignments({ str: "r0", int: "r1" });
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  refresh();
  expect(screen.getAllByRole("table")).toHaveLength(1);
  expect(
    document.querySelectorAll(
      'table[aria-label="Characteristic draft preview"]',
    ),
  ).toHaveLength(1);
  expect(
    document.querySelectorAll('button[aria-label^="Favor "]'),
  ).toHaveLength(7);
  expect(
    screen
      .getAllByRole("columnheader")
      .map((header) => header.getAttribute("aria-label") ?? header.textContent),
  ).toEqual(["Characteristic", "Baseline", "Rolled", "Total", "Favored"]);
  expect(
    screen.getByRole("columnheader", { name: "Characteristic" }),
  ).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Rolled" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "Favored" })).toBeTruthy();
  const headingVariants: readonly [string, string][] = [
    ["Characteristic", "Char."],
    ["Favored", "Fav."],
  ];
  for (const [full, compact] of headingVariants) {
    const header = screen.getByRole("columnheader", { name: full });
    expect(within(header).getByText(full).getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(within(header).getByText(compact).getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(within(header).getByText(compact).getAttribute("title")).toBe(full);
  }
  expect(
    screen.getAllByRole("rowheader").map((header) => header.textContent),
  ).toEqual(["Str", "End", "Ag", "Int", "Wp", "Prc", "Prs", "Lck"]);
  expect(screen.getAllByRole("button", { name: /^Favor / })).toHaveLength(7);
  expect(screen.queryByRole("rowheader", { name: "Bonus" })).toBeNull();
  expect(screen.getByRole("table").querySelector("caption")).toBeNull();
  expect(cell("Baseline", "Strength")).toBe("25");
  expect(cell("Generated", "Strength")).toBe("6");
  expect(cell("Total", "Strength")).toBe("31");
  expect(cell("Generated", "Intelligence")).toBe("7");
  expectEmptyRolledCell("Endurance");
  expect(cell("Total", "Endurance")).toBe("25");
  expect(cell("Generated", "Luck")).toBe("9");
  expect(cell("Total", "Luck")).toBe("39");
  expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(0);
  expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);
});

it("distinguishes missing, zero and invalid allocations", async () => {
  const { creator, refresh } = await setup();
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({
    str: 0,
    int: 12,
    ag: 21,
    wp: 1.5,
    prs: 22,
  });
  creator.submitLuckRoll({ id: "bad", dice: [0, 10] });
  refresh();
  expect(cell("Generated", "Strength")).toBe("0");
  expect(cell("Generated", "Endurance")).toBe("");
  expect(cell("Generated", "Intelligence")).toBe("12");
  expect(cell("Total", "Intelligence")).toBe("42");
  for (const [label, value] of [
    ["Agility", "21"],
    ["Willpower", "1.5"],
    ["Personality", "22"],
  ]) {
    expect(cell("Generated", label!)).toBe(value);
    expect(
      within(
        screen.getByRole("group", { name: `${label} allocation` }),
      ).getByRole("status"),
    ).toBeTruthy();
  }
  expect(cell("Generated", "Luck")).toBe("Invalid");
  expect(cell("Total", "Luck")).toBe("30");
  expect(creator.getCharacterPreview().characteristics.int.rolled).toBe(0);
  expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);
});

it("keeps favored stars characteristic-keyed across reassignment, rerolls and methods", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  await user.click(screen.getByRole("button", { name: "Favor Intelligence" }));
  expect(screen.getByRole("button", { name: "Favor Agility" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(screen.getByRole("button", { name: "Favor Agility" }));
  expect(creator.getSnapshot().characteristicGeneration.drafts.favored).toEqual(
    ["str", "int"],
  );
  expect(screen.queryByRole("button", { name: "Favor Luck" })).toBeNull();
  creator.submitCharacteristicRolls(rolls);
  creator.setCharacteristicAssignments({ str: "r0", int: "r1" });
  creator.setCharacteristicAssignments({ str: "r1", int: "r0" });
  refresh();
  expect(cell("Generated", "Strength")).toBe("7");
  creator.rerollCharacteristics([
    { targetRollId: "r1", replacement: { id: "new", dice: [1, 1] } },
  ]);
  refresh();
  expectEmptyRolledCell("Strength");
  expect(cell("Generated", "Intelligence")).toBe("6");
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({ str: 10 });
  refresh();
  expect(cell("Generated", "Strength")).toBe("10");
  creator.setCharacteristicGenerationMethod("rolled");
  refresh();
  expectEmptyRolledCell("Strength");
  expect(cell("Generated", "Intelligence")).toBe("6");
  for (const label of ["Strength", "Intelligence"]) {
    expect(
      screen
        .getByRole("button", { name: `Favor ${label}` })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  }
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  expect(screen.getByRole("button", { name: "Favor Agility" })).toHaveProperty(
    "disabled",
    false,
  );
  expect(creator.getSnapshot().characteristicGeneration.drafts.favored).toEqual(
    ["int"],
  );
  creator.setFavoredCharacteristics(["str", "end", "int"]);
  refresh();
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  expect(creator.getSnapshot().characteristicGeneration.drafts.favored).toEqual(
    ["end", "int"],
  );
});

it("excludes an invalid initial dice pool", async () => {
  const { creator, refresh } = await setup();
  creator.submitCharacteristicRolls([{ id: "bad", dice: [0, 11] }]);
  creator.setCharacteristicAssignments({ str: "bad" });
  refresh();
  expect(cell("Generated", "Strength")).toBe("Invalid");
  expect(cell("Total", "Strength")).toBe("25");
});

it("uses Core's race suppression and cancellation", async () => {
  const { creator, catalog, refresh } = await setup();
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({ int: 10 });
  const reads = controlledReads(catalog);
  const gate = reads.hold("race", "altmer");
  const pending = creator.chooseRace("altmer");
  refresh();
  expect(cell("Baseline", "Intelligence")).toBe("0");
  expect(cell("Generated", "Intelligence")).toBe("10");
  expect(cell("Total", "Intelligence")).toBe("0");
  creator.cancelRaceSelection();
  refresh();
  expect(cell("Baseline", "Intelligence")).toBe("30");
  expect(cell("Total", "Intelligence")).toBe("40");
  gate.resolve();
  await pending;
});

it("filters assigned results by ID even for equal totals and restores them only after explicit unassign", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  const equalRolls = [...rolls];
  equalRolls[0] = { id: "first", dice: [1, 10] };
  equalRolls[1] = { id: "second", dice: [5, 6] };
  creator.submitCharacteristicRolls(equalRolls);
  creator.submitLuckRoll({ id: "luck", dice: [2, 8] });
  refresh();
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Strength" }),
  );
  expect(
    screen.getByRole("menuitem", {
      name: "Result 1: 11 (1 + 10) — Unassigned",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("menuitem", { name: "Result 1: 11 (1 + 10) — Unassigned" })
      .textContent,
  ).toBe("(1 + 10) 11");
  expect(
    screen.getByRole("menuitem", { name: "Result 2: 11 (5 + 6) — Unassigned" })
      .textContent,
  ).toBe("(5 + 6) 11");
  await user.click(
    screen.getByRole("menuitem", { name: "Result 2: 11 (5 + 6) — Unassigned" }),
  );
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Endurance" }),
  );
  expect(screen.queryByRole("menuitem", { name: /^Result 2:/ })).toBeNull();
  expect(
    screen.getByRole("menuitem", { name: "Result 1: 11 (1 + 10) — Unassigned" })
      .textContent,
  ).toBe("(1 + 10) 11");
  await user.click(screen.getByRole("menuitem", { name: /^Result 1:/ }));
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ str: "second", end: "first" });
  expect(cell("Generated", "Strength")).toBe("11");
  expect(cell("Total", "Strength")).toBe("36");
  expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(0);
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Intelligence" }),
  );
  expect(screen.queryByRole("menuitem", { name: /^Result [12]:/ })).toBeNull();
  expect(screen.getAllByRole("menuitem")).toHaveLength(5);
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ str: "second", end: "first" });
  await user.keyboard("{Escape}");
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Strength" }),
  );
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Unassign"]);
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  await assignDraftResult(user, "Intelligence", 1);
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ end: "first", int: "second" });
  expectEmptyRolledCell("Strength");
  expect(cell("Total", "Strength")).toBe("25");
  expect(cell("Generated", "Intelligence")).toBe("11");
  expect(cell("Total", "Intelligence")).toBe("41");
  expect(cell("Generated", "Luck")).toBe("10");
  const intelligence = screen.getByRole("button", {
    name: "Rolled result for Intelligence",
  });
  await user.click(intelligence);
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Unassign"]);
  expect(screen.queryByRole("menuitem", { name: /^Result / })).toBeNull();
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ end: "first", int: "second" });
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  await waitFor(() => expect(document.activeElement).toBe(intelligence));
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ end: "first" });
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Endurance" }),
  );
  await user.click(screen.getByRole("menuitem", { name: "Unassign" }));
  await assignDraftResult(user, "Intelligence", 0);
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({ int: "first" });
});

it("updates pickers and partial previews after selective rerolls without changing favored or Luck", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  creator.submitCharacteristicRolls(rolls);
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  creator.setFavoredCharacteristics(["str", "end"]);
  refresh();
  await assignDraftResult(user, "Strength", 0);
  await assignDraftResult(user, "Endurance", 1);
  const before = creator.getSnapshot().characteristicGeneration.drafts;
  creator.rerollCharacteristics([
    { targetRollId: "r0", replacement: { id: "replacement", dice: [1, 1] } },
  ]);
  refresh();
  expectEmptyRolledCell("Strength");
  expect(cell("Generated", "Endurance")).toBe("7");
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Strength" }),
  );
  expect(screen.queryByRole("menuitem", { name: /Result 1: 6/ })).toBeNull();
  await user.click(
    screen.getByRole("menuitem", { name: "Result 1: 2 (1 + 1) — Unassigned" }),
  );
  expect(cell("Generated", "Strength")).toBe("2");
  expect(cell("Total", "Strength")).toBe("27");
  const after = creator.getSnapshot().characteristicGeneration.drafts;
  expect(after.rolled.assignments).toEqual({ end: "r1", str: "replacement" });
  expect(after.favored).toEqual(before.favored);
  expect(after.luck).toEqual(before.luck);
});

it("limits result pickers to rolled non-Luck cells and dismisses without changing answers", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  expect(
    screen.getAllByRole("button", { name: /^Rolled result for / }),
  ).toHaveLength(7);
  expect(
    screen.queryByRole("button", { name: "Rolled result for Luck" }),
  ).toBeNull();
  const strength = screen.getByRole("button", {
    name: "Rolled result for Strength",
  });
  strength.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByText("Make characteristic roll first")).toBeTruthy();
  expect(screen.queryByRole("menuitem")).toBeNull();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(strength));
  expect(
    creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
  ).toEqual({});
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({ str: 10 });
  refresh();
  expect(
    screen.queryByRole("button", { name: /^Rolled result for / }),
  ).toBeNull();
  expect(cell("Generated", "Strength")).toBe("10");
});

it("only enables the independent Luck cell menu for a valid existing roll with unlimited enabled", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  creator.setUnlimitedCharacteristicRerolls(true);
  refresh();
  expect(
    screen.queryByRole("button", { name: "Rolled result for Luck" }),
  ).toBeNull();
  creator.submitLuckRoll({ id: "invalid", dice: [0, 11] });
  refresh();
  expect(cell("Generated", "Luck")).toBe("Invalid");
  expect(
    screen.queryByRole("button", { name: "Rolled result for Luck" }),
  ).toBeNull();
  creator.submitLuckRoll({ id: "valid", dice: [5, 5] });
  refresh();
  const before = creator.getSnapshot().characteristicGeneration;
  await user.click(
    screen.getByRole("button", { name: "Rolled result for Luck" }),
  );
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Reroll"]);
  await user.click(screen.getByRole("menuitem", { name: "Reroll" }));
  expect(cell("Generated", "Luck")).toBe("5");
  expect(cell("Total", "Luck")).toBe("35");
  expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual(
    before.rerolls,
  );
  creator.setUnlimitedCharacteristicRerolls(false);
  refresh();
  const locked = screen.getByRole("button", { name: "Rolled result for Luck" });
  expect(locked).toHaveProperty("disabled", true);
  expect(locked.getAttribute("aria-haspopup")).toBeNull();
  expect(locked.getAttribute("aria-description")).toBe("2d10: 2 + 3 = 5");
  await user.click(locked);
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Reroll" })).toBeNull();
});

it("keeps down chevrons only on empty menu triggers and plain values on assigned or locked cells", async () => {
  const user = userEvent.setup();
  const { creator, refresh } = await setup();
  function rolledCell(label: string) {
    const header = screen.getByRole("rowheader", { name: label });
    return within(header.closest("tr")!).getAllByRole("cell")[1]!;
  }
  expectEmptyRolledCell("Strength");
  expect(rolledCell("Luck").textContent).toBe("—");
  expect(rolledCell("Luck").querySelector("svg")).toBeNull();
  creator.submitCharacteristicRolls(rolls);
  creator.setCharacteristicAssignments({ str: "r0" });
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  refresh();
  const strength = screen.getByRole("button", {
    name: "Rolled result for Strength",
  });
  expect(strength.textContent).toBe("6");
  expect(strength.querySelector("svg")).toBeNull();
  expect(strength.querySelector(".tabler-icon-chevron-down")).toBeNull();
  expect(strength.getAttribute("aria-expanded")).toBe("false");
  await user.click(strength);
  expect(strength.getAttribute("aria-expanded")).toBe("true");
  expect(
    screen.getAllByRole("menuitem").map((item) => item.textContent),
  ).toEqual(["Unassign"]);
  await user.keyboard("{Escape}");
  expect(strength.getAttribute("aria-expanded")).toBe("false");
  expect(rolledCell("Luck").textContent).toBe("9");
  expect(rolledCell("Luck").querySelector("svg")).toBeNull();
  expect(rolledCell("Luck").querySelector("button")).toHaveProperty(
    "disabled",
    true,
  );
  creator.setUnlimitedCharacteristicRerolls(true);
  refresh();
  const luck = screen.getByRole("button", { name: "Rolled result for Luck" });
  expect(luck.textContent).toBe("9");
  expect(luck.querySelector("svg")).toBeNull();
  expect(luck.getAttribute("aria-haspopup")).toBe("menu");
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({ str: 0 });
  refresh();
  expect(
    within(rolledCell("Strength")).getByRole("textbox", {
      name: "Strength points",
    }),
  ).toHaveProperty("value", "0");
  expect(
    within(rolledCell("Endurance")).getByRole("textbox", {
      name: "Endurance points",
    }),
  ).toHaveProperty("value", "");
  expect(
    rolledCell("Strength").querySelector(".tabler-icon-chevron-down"),
  ).toBeNull();
  expect(
    rolledCell("Endurance").querySelector(".tabler-icon-chevron-down"),
  ).toBeNull();
  expect(
    screen
      .getByRole("button", { name: "Rolled result for Luck" })
      .querySelector(".tabler-icon-chevron-left"),
  ).toBeNull();
  creator.setUnlimitedCharacteristicRerolls(false);
  refresh();
  expect(rolledCell("Luck").textContent).toBe("9");
  expect(rolledCell("Luck").querySelector("svg")).toBeNull();
  expect(rolledCell("Luck").querySelector("button")).toHaveProperty(
    "disabled",
    true,
  );
});
