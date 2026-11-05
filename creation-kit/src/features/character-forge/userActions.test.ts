import { CharacterCreator } from "@wayshrine/core";
import { describe, expect, it } from "vitest";
import { fixtureCatalog } from "./test/testCatalog";
import { controlledReads } from "./test/forgeTestHelpers";
import { characteristicUserActions, raceUserActions } from "./userActions";

function generationLabels(creator: CharacterCreator) {
  const snapshot = creator.getSnapshot();
  const raceComplete = snapshot.steps.some(
    (step) => step.id === "race" && step.complete,
  );
  return characteristicUserActions(
    snapshot.characteristicGeneration,
    raceComplete,
  ).map((action) => action.label);
}

function completePointBuy(creator: CharacterCreator) {
  creator.setFavoredCharacteristics(["str", "end"]);
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({
    str: 20,
    end: 20,
    ag: 20,
    int: 10,
    wp: 10,
    prc: 0,
    prs: 0,
  });
  creator.submitLuckRoll({ id: "luck", dice: [5, 6] });
}

describe("step user actions from Core snapshots", () => {
  it("uses race browsing state only when race selection is outstanding", async () => {
    const creator = new CharacterCreator(fixtureCatalog());
    for (const [status, label] of [
      ["loading", "Loading available races"],
      ["error", "Retry loading races"],
      ["empty", "Resolve unavailable race content"],
      ["ready", "Choose a race"],
    ] as const) {
      expect(raceUserActions(creator.getSnapshot(), status)).toEqual([
        {
          id: "race",
          label,
          ...(status === "loading" ? { loading: true } : {}),
        },
      ]);
    }
    await creator.chooseRace("argonian");
    expect(raceUserActions(creator.getSnapshot(), "error")).toEqual([]);
  });

  it("keeps only Core's pending racial groups, in order, including invalid answers", async () => {
    const creator = new CharacterCreator(fixtureCatalog());
    await creator.chooseRace("manyChoices");
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "manyChoices/pair", label: "Choose 2 racial skills" },
      { id: "manyChoices/overlap", label: "Choose 1 racial skill" },
    ]);
    await creator.chooseRacialBonus("manyChoices/pair", [
      "alchemy",
      "alteration",
    ]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toHaveLength(1);
    await creator.chooseRacialBonus("manyChoices/overlap", ["alchemy"]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([]);
    await creator.chooseRacialBonus("manyChoices/pair", ["alchemy", "alchemy"]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "manyChoices/pair", label: "Review racial skill selection" },
    ]);
  });

  it("replaces race tasks during pending/failed loads and restores retained choices on cancel", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = reads.hold("race", "argonian");
    const request = creator.chooseRace("argonian");
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "race-content", label: "Loading race selection", loading: true },
    ]);
    gate.reject(new Error("offline"));
    await request;
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "race-content", label: "Retry or cancel race selection" },
    ]);
    creator.cancelRaceSelection();
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "altmer/magic", label: "Choose 1 racial skill" },
    ]);
  });

  it("shows pending and failed skill loads and unresolved selections without duplicating tasks", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = reads.hold("skill", "alchemy");
    const request = creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "altmer/magic", label: "Loading racial skills", loading: true },
    ]);
    gate.reject(new Error("offline"));
    await request;
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "altmer/magic", label: "Retry racial skill selection" },
    ]);
    const raceGate = reads.hold("race", "argonian");
    const raceRequest = creator.chooseRace("argonian");
    creator.cancelRaceSelection();
    raceGate.resolve();
    await raceRequest;
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      { id: "altmer/magic", label: "Retry racial skill selection" },
    ]);
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([]);
  });

  it("does not hide invalid race references behind otherwise complete choices", async () => {
    const creator = new CharacterCreator(
      fixtureCatalog((definitions) => {
        delete definitions.trait.magicWeakness;
      }),
    );
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(raceUserActions(creator.getSnapshot(), "ready")).toEqual([
      {
        id: "race-content",
        label: "Review race selection or choose another race",
      },
    ]);
  });

  it("groups rolled issues by field and restores assignments after a selective reroll", async () => {
    const creator = new CharacterCreator(fixtureCatalog());
    await creator.chooseRace("argonian");
    creator.setCharacteristicGenerationMethod("rolled");
    expect(generationLabels(creator)).toEqual([
      "Choose two favored characteristics",
      "Roll characteristic results",
      "Assign all characteristic results",
      "Roll Luck",
    ]);
    creator.setFavoredCharacteristics(["str", "end"]);
    const rolls = Array.from({ length: 7 }, (_, index) => ({
      id: `r${index}`,
      dice: [5, 6],
    }));
    creator.submitCharacteristicRolls(rolls);
    expect(generationLabels(creator)).toEqual([
      "Assign all characteristic results",
      "Roll Luck",
    ]);
    creator.setCharacteristicAssignments({
      str: "r0",
      end: "r1",
      ag: "r2",
      int: "r3",
      wp: "r4",
      prc: "r5",
      prs: "r6",
    });
    creator.submitLuckRoll({ id: "luck", dice: [4, 7] });
    expect(generationLabels(creator)).toEqual([]);
    creator.rerollCharacteristics([
      { targetRollId: "r0", replacement: { id: "new", dice: [3, 4] } },
    ]);
    expect(generationLabels(creator)).toEqual([
      "Assign all characteristic results",
    ]);
    // Rejected reroll commands do not create outstanding answer tasks.
    creator.rerollCharacteristics([]);
    expect(generationLabels(creator)).toEqual([
      "Assign all characteristic results",
    ]);
  });

  it("groups point-buy budget/missing/invalid values, ignores inactive drafts, and retains Luck", async () => {
    const creator = new CharacterCreator(fixtureCatalog());
    await creator.chooseRace("argonian");
    completePointBuy(creator);
    expect(generationLabels(creator)).toEqual([]);
    creator.setCharacteristicAllocations({ str: 21 });
    expect(generationLabels(creator)).toEqual([
      "Allocate characteristic points",
    ]);
    creator.setCharacteristicGenerationMethod("rolled");
    expect(generationLabels(creator)).toEqual([
      "Roll characteristic results",
      "Assign all characteristic results",
    ]);
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(generationLabels(creator)).toEqual([
      "Allocate characteristic points",
    ]);
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.submitLuckRoll({ id: "bad", dice: [0, 2] });
    expect(generationLabels(creator)).toEqual([
      "Allocate characteristic points",
      "Roll Luck",
    ]);
  });

  it("keeps prior race/content blockers when generation itself is complete on the later step", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("argonian");
    creator.next();
    completePointBuy(creator);
    expect(creator.getSnapshot().canFinish).toBe(true);
    const gate = reads.hold("race", "altmer");
    const request = creator.chooseRace("altmer");
    expect(generationLabels(creator)).toEqual([
      "Return to Select Race to resolve outstanding actions",
    ]);
    gate.reject(new Error("offline"));
    await request;
    expect(generationLabels(creator)).toEqual([
      "Return to Select Race to resolve outstanding actions",
    ]);
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(true);
    expect(creator.getSnapshot().canFinish).toBe(false);
    creator.cancelRaceSelection();
    expect(generationLabels(creator)).toEqual([]);
    await creator.chooseRace("altmer");
    expect(generationLabels(creator)).toEqual([
      "Return to Select Race to resolve outstanding actions",
    ]);
  });
});
