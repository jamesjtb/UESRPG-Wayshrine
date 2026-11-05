import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator, SkillRank } from "@wayshrine/core";
import { describe, expect, it } from "vitest";
import { CharacterSheet } from "./CharacterSheet";
import { fixtureCatalog } from "../test/testCatalog";

function characteristicCells(label: string) {
  const index =
    screen
      .getAllByRole("columnheader")
      .findIndex((header) => header.textContent === label) - 1;
  return ["Total", "Bonus"].map((row) => {
    const header = screen.getByRole("rowheader", { name: row });
    return within(header.closest("tr")!).getAllByRole("cell")[index]!;
  });
}

describe("CharacterSheet", () => {
  it("shows independent empty sections and Core's default Luck baseline", () => {
    const creator = new CharacterCreator(fixtureCatalog());
    render(
      <MantineProvider env="test">
        <CharacterSheet
          preview={creator.getCharacterPreview()}
          onNameChange={() => {}}
        />
      </MantineProvider>,
    );
    expect(
      screen.getByRole("textbox", { name: "Character name" }),
    ).toHaveProperty("value", "");
    expect(screen.getByPlaceholderText("Unnamed Character")).toBeTruthy();
    expect(screen.queryByText("In progress")).toBeNull();
    expect(screen.getByRole("heading", { name: "Race" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Characteristics" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(screen.getByText("No race selected.")).toBeTruthy();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Characteristic",
      "Strength",
      "Endurance",
      "Agility",
      "Intelligence",
      "Willpower",
      "Perception",
      "Personality",
      "Luck",
    ]);
    expect(characteristicCells("Luck").map((cell) => cell.textContent)).toEqual(
      ["30", "3"],
    );
    expect(screen.queryByText("No characteristics.")).toBeNull();
    expect(screen.getByText("No traits.")).toBeTruthy();
    expect(screen.getByText("No skills.")).toBeTruthy();
    expect(
      characteristicCells("Strength").map((cell) => cell.textContent),
    ).toEqual(["0", "0"]);
    expect(
      screen.getAllByRole("rowheader").map((header) => header.textContent),
    ).toEqual(["Total", "Bonus"]);
    expect(screen.queryByRole("img", { name: "Favored" })).toBeNull();
    expect(
      screen.getByLabelText("Characteristic table scrolling").tabIndex,
    ).toBe(0);
    expect(screen.getAllByRole("cell")).toHaveLength(16);
  });

  it("renders current characteristics, traits and skills even without a race", () => {
    const creator = new CharacterCreator(fixtureCatalog());
    const preview = creator.getCharacterPreview();
    preview.updateCharacteristic("str", {
      baseline: 27,
      rolled: 5,
      favored: true,
      modifiers: [{ sourceId: "bonus", sourceText: "A modifier", value: 9 }],
    });
    preview.updateCharacteristic("ag", { rolled: 7 });
    preview.updateCharacteristic("int", { favored: true });
    preview.traits = [{ traitKey: "magicResistance", params: { X: 10 } }];
    preview.skills = [
      {
        skill: { skillKey: "customSkill", governingCharacteristics: ["int"] },
        skillRank: SkillRank.Apprentice,
      },
    ];
    render(
      <MantineProvider env="test">
        <CharacterSheet preview={preview} onNameChange={() => {}} />
      </MantineProvider>,
    );
    expect(screen.getByText("No race selected.")).toBeTruthy();
    const strength = characteristicCells("Strength");
    expect(strength[0]).toHaveProperty("textContent", "32");
    expect(strength[1]).toHaveProperty("textContent", "3");
    expect(
      within(
        screen.getByRole("columnheader", { name: "Strength, Favored" }),
      ).getByRole("img", { name: "Favored" }),
    ).toBeTruthy();
    expect(
      characteristicCells("Agility").map((cell) => cell.textContent),
    ).toEqual(["7", "0"]);
    expect(
      within(screen.getByRole("columnheader", { name: "Agility" })).queryByRole(
        "img",
        { name: "Favored" },
      ),
    ).toBeNull();
    expect(
      within(
        screen.getByRole("columnheader", { name: "Intelligence, Favored" }),
      ).getByRole("img", {
        name: "Favored",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByText("Totals are baseline + generated, before modifiers."),
    ).toBeNull();
    expect(
      screen.getByRole("table", { name: "Sheet characteristics" }),
    ).toBeTruthy();
    expect(screen.getByText("Magic Resistance (X: 10)")).toBeTruthy();
    expect(screen.getByText("Custom Skill (Apprentice)")).toBeTruthy();
    expect(screen.queryByText("No traits.")).toBeNull();
    expect(screen.queryByText("No skills.")).toBeNull();
  });

  it.each(["hover", "keyboard", "touch"])(
    "shows score calculation through %s interaction",
    async (interaction) => {
      const user = userEvent.setup();
      const preview = new CharacterCreator(
        fixtureCatalog(),
      ).getCharacterPreview();
      preview.updateCharacteristic("str", {
        baseline: 27,
        rolled: 5,
        favored: true,
      });
      render(
        <MantineProvider env="test">
          <CharacterSheet preview={preview} onNameChange={() => {}} />
        </MantineProvider>,
      );
      const [total] = characteristicCells("Strength");
      expect(total!.getAttribute("aria-description")).toBe(
        "Strength: 27 + 5 = 32 (baseline + generated)",
      );
      if (interaction === "keyboard") {
        await user.tab(); // Character name
        await user.tab(); // Scroll container
        await user.tab(); // First Total score
        expect(document.activeElement).toBe(total);
      } else if (interaction === "touch") {
        // Mantine/Floating UI enables touch compatibility mouse events.
        fireEvent.pointerDown(total!, { pointerType: "touch" });
        fireEvent.mouseEnter(total!);
      } else {
        await user.hover(total!);
      }
      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip.textContent).toBe(
        "Strength: 27 + 5 = 32 (baseline + generated)",
      );
      if (interaction === "keyboard")
        expect(total!.getAttribute("aria-describedby")).toBe(tooltip.id);
      expect(screen.queryByRole("checkbox")).toBeNull();
    },
  );

  it("does not disclose calculations from headings, favored stars, or Bonus cells", async () => {
    const user = userEvent.setup();
    const preview = new CharacterCreator(
      fixtureCatalog(),
    ).getCharacterPreview();
    preview.updateCharacteristic("str", { favored: true });
    render(
      <MantineProvider env="test">
        <CharacterSheet preview={preview} onNameChange={() => {}} />
      </MantineProvider>,
    );
    const header = screen.getByRole("columnheader", {
      name: "Strength, Favored",
    });
    const star = within(header).getByRole("img", { name: "Favored" });
    const [total, bonus] = characteristicCells("Strength");
    // First establish that Total's tooltip works, then leaves cleanly.
    await user.hover(total!);
    await screen.findByRole("tooltip");
    await user.unhover(total!);
    for (const target of [header, star, bonus!]) {
      await user.hover(target);
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(target.tabIndex).toBe(-1);
      expect(target.getAttribute("aria-description")).toBeNull();
      expect(target.getAttribute("aria-describedby")).toBeNull();
      await user.unhover(target);
    }
    const totals = within(
      screen.getByRole("rowheader", { name: "Total" }).closest("tr")!,
    ).getAllByRole("cell");
    expect(totals.every((cell) => cell.tabIndex === 0)).toBe(true);
  });

  it("updates from fresh Core previews without holding race-step state", async () => {
    const creator = new CharacterCreator(fixtureCatalog());
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    const view = render(
      <MantineProvider env="test">
        <CharacterSheet
          preview={creator.getCharacterPreview()}
          raceLabel="Altmer"
          onNameChange={() => {}}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("Altmer")).toBeTruthy();
    expect(screen.getByText("Alchemy (Novice)")).toBeTruthy();
    await creator.chooseRace("argonian");
    view.rerender(
      <MantineProvider env="test">
        <CharacterSheet
          preview={creator.getCharacterPreview()}
          onNameChange={() => {}}
        />
      </MantineProvider>,
    );
    expect(screen.getByText("Argonian")).toBeTruthy();
    expect(screen.getByText("No skills.")).toBeTruthy();
    expect(screen.queryByText("Alchemy (Novice)")).toBeNull();
    expect(screen.queryByText(/Magic Weakness/)).toBeNull();
  });
});
