import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import { CharacterCreator, SkillRank } from "@wayshrine/core";
import { describe, expect, it } from "vitest";
import { CharacterSheet } from "./CharacterSheet";
import { fixtureCatalog } from "../test/testCatalog";

function characteristicCells(label: string) {
  const header = screen.getByRole("rowheader", { name: label });
  return within(header.closest("tr")!).getAllByRole("cell");
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
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Race" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Characteristics" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(screen.getByText("No race selected.")).toBeTruthy();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Characteristic", "Baseline", "Generated", "Favored", "Total"]);
    expect(characteristicCells("Luck").map((cell) => cell.textContent)).toEqual(
      ["30", "0", "", "30"],
    );
    expect(screen.queryByText("No characteristics.")).toBeNull();
    expect(screen.getByText("No traits.")).toBeTruthy();
    expect(screen.getByText("No skills.")).toBeTruthy();
    expect(screen.queryByRole("rowheader", { name: "Strength" })).toBeNull();
    expect(screen.getAllByRole("rowheader")).toHaveLength(1);
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
    expect(strength[0]).toHaveProperty("textContent", "27");
    expect(strength[1]).toHaveProperty("textContent", "5");
    expect(
      within(strength[2]!).getByRole("img", { name: "Favored" }),
    ).toBeTruthy();
    expect(strength[3]).toHaveProperty("textContent", "32");
    expect(
      characteristicCells("Agility").map((cell) => cell.textContent),
    ).toEqual(["0", "7", "", "7"]);
    expect(
      within(characteristicCells("Intelligence")[2]!).getByRole("img", {
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
