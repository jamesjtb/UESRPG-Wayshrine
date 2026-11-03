import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { CharacterCreator, SkillRank } from "@wayshrine/core";
import { describe, expect, it } from "vitest";
import { CharacterPreview } from "./CharacterPreview";
import { fixtureCatalog } from "../testCatalog";

describe("CharacterPreview", () => {
  it("shows independent empty sections without Core's default zero characteristics", () => {
    const creator = new CharacterCreator(fixtureCatalog());
    render(
      <MantineProvider env="test">
        <CharacterPreview preview={creator.getCharacterPreview()} />
      </MantineProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Unnamed Character (Draft)" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Race" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Characteristics" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(screen.getByText("No race selected.")).toBeTruthy();
    expect(screen.getByText("No characteristics.")).toBeTruthy();
    expect(screen.getByText("No traits.")).toBeTruthy();
    expect(screen.getByText("No skills.")).toBeTruthy();
    expect(screen.queryByText(/Str: 0|Lck: 0/)).toBeNull();
  });

  it("renders current characteristics, traits and skills even without a race", () => {
    const creator = new CharacterCreator(fixtureCatalog());
    const preview = creator.getCharacterPreview();
    preview.updateCharacteristic("str", { baseline: 27 });
    preview.traits = [{ traitKey: "magicResistance", params: { X: 10 } }];
    preview.skills = [
      {
        skill: { skillKey: "customSkill", governingCharacteristics: ["int"] },
        skillRank: SkillRank.Apprentice,
      },
    ];
    render(
      <MantineProvider env="test">
        <CharacterPreview preview={preview} />
      </MantineProvider>,
    );
    expect(screen.getByText("No race selected.")).toBeTruthy();
    expect(screen.getByText("Str: 27")).toBeTruthy();
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
        <CharacterPreview
          preview={creator.getCharacterPreview()}
          raceLabel="Altmer"
        />
      </MantineProvider>,
    );
    expect(screen.getByText("Altmer")).toBeTruthy();
    expect(screen.getByText("Alchemy (Novice)")).toBeTruthy();
    await creator.chooseRace("argonian");
    view.rerender(
      <MantineProvider env="test">
        <CharacterPreview preview={creator.getCharacterPreview()} />
      </MantineProvider>,
    );
    expect(screen.getByText("Argonian")).toBeTruthy();
    expect(screen.getByText("No skills.")).toBeTruthy();
    expect(screen.queryByText("Alchemy (Novice)")).toBeNull();
    expect(screen.queryByText(/Magic Weakness/)).toBeNull();
  });
});
