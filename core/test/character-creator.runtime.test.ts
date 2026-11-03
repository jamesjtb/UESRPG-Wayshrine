import { describe, expect, it } from "vitest";
import CharacterCreator from "../src/wizards/CharacterCreator";
import { ContentError } from "../src/content/ContentError";
import { SkillRank } from "../src/enum/SkillRank";
import {
  creationCatalogs,
  deferred,
  TestContentCatalog,
} from "./support/ContentCatalog";

describe("CharacterCreator", () => {
  it("requires a race and does not load anything during construction", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    expect(catalog.getCalls).toEqual([]);
    expect(catalog.listCalls).toEqual([]);
    expect(creator.getSnapshot()).toMatchObject({
      pendingChoices: [],
      canFinish: false,
      issues: [{ code: "race-required" }],
    });
    expect(creator.finish().ok).toBe(false);
    expect((await creator.chooseRace("unknown")).ok).toBe(false);
    expect((await creator.chooseRace("toString")).ok).toBe(false);
  });

  it("applies baseline, traits, and exactly one Novice skill", async () => {
    const { catalog, skills } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    expect(creator.getSnapshot().pendingChoices[0]).toMatchObject({
      id: "altmer/magic",
      choose: 1,
    });
    expect(creator.finish().ok).toBe(false);
    expect(
      (await creator.chooseRacialBonus("altmer/magic", ["alchemy"])).ok,
    ).toBe(true);
    expect(creator.getSnapshot().pendingChoices).toEqual([]);
    expect(creator.getSnapshot().racialBonusChoices[0]?.selections).toEqual([
      "alchemy",
    ]);
    const result = creator.finish();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.characteristics.int.baseline).toBe(30);
    expect(result.value.characteristics.lck.baseline).toBe(0);
    expect(result.value.traits).toEqual([
      { traitKey: "weakness", params: { type: "magic", X: 2 }, origin: "race" },
    ]);
    expect(result.value.skills).toEqual([
      { skill: skills.alchemy, skillRank: SkillRank.Novice },
    ]);
  });

  it("retains invalid selections for correction without applying their effects", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(
      (
        await creator.chooseRacialBonus("altmer/magic", [
          "alchemy",
          "alteration",
        ])
      ).ok,
    ).toBe(false);
    expect(creator.getSnapshot().pendingChoices[0]?.selections).toEqual([
      "alchemy",
      "alteration",
    ]);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.finish().ok).toBe(false);
    await creator.chooseRacialBonus("altmer/magic", ["alteration"]);
    expect(creator.finish().ok).toBe(true);
    expect(
      (await creator.chooseRacialBonus("other/magic", ["alchemy"])).ok,
    ).toBe(false);
  });

  it("replaces racial effects and clears race-owned answers only on race changes", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    await creator.chooseRace("altmer");
    expect(creator.finish().ok).toBe(true);
    await creator.chooseRace("argonian");
    expect(creator.getSnapshot().canFinish).toBe(true);
    const preview = creator.getCharacterPreview();
    expect(preview.characteristics.str.baseline).toBe(25);
    expect(preview.traits).toEqual([
      { traitKey: "amphibious", origin: "race" },
    ]);
    expect(preview.skills).toEqual([]);
    await creator.chooseRace("altmer");
    expect(creator.getSnapshot().pendingChoices[0]?.selections).toEqual([]);
  });

  it("supports per-group choose requirements and deduplicates overlapping grants", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "one", choose: 1, options: ["alchemy"] },
          { id: "two", choose: 2, options: ["alchemy", "alteration"] },
        ],
      },
    ];
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/one", ["alchemy"]);
    expect(creator.finish().ok).toBe(false);
    await creator.chooseRacialBonus("altmer/two", ["alchemy", "alteration"]);
    expect(creator.finish().ok).toBe(true);
    expect(creator.getCharacterPreview().skills).toHaveLength(2);
  });

  it("rejects unknown skill references and duplicate group IDs", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "duplicate", choose: 1, options: ["alchemy", "missing"] },
          { id: "duplicate", choose: 1, options: ["alchemy"] },
        ],
      },
    ];
    const creator = new CharacterCreator(catalog);
    expect((await creator.chooseRace("altmer")).ok).toBe(false);
    expect(
      (await creator.chooseRacialBonus("altmer/duplicate", ["alchemy"])).ok,
    ).toBe(false);
    expect(creator.finish().ok).toBe(false);
    expect(creator.getCharacterPreview().skills).toEqual([]);
  });

  it("does not grant from a group even if only an unselected option is missing", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "magic", choose: 1, options: ["alchemy", "missing"] },
        ],
      },
    ];
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    expect(
      (await creator.chooseRacialBonus("altmer/magic", ["alchemy"])).ok,
    ).toBe(false);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.getSnapshot().issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid-choice-definition" }),
      ]),
    );
    expect(catalog.getCalls.some((call) => call.kind === "skill")).toBe(false);
  });

  it("scopes similarly named choices to their source race", async () => {
    const { catalog, races, skills, traits, altmer } = creationCatalogs();
    const withOtherRace = new TestContentCatalog({
      race: { ...races, other: { ...altmer } },
      skill: skills,
      trait: traits,
    });
    const creator = new CharacterCreator(withOtherRace);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    await creator.chooseRace("other");
    expect(creator.getSnapshot().pendingChoices[0]).toMatchObject({
      id: "other/magic",
      selections: [],
    });
    expect(
      (await creator.chooseRacialBonus("altmer/magic", ["alchemy"])).ok,
    ).toBe(false);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    await creator.chooseRacialBonus("other/magic", ["alteration"]);
    expect(creator.finish().ok).toBe(true);
    expect(catalog.getCalls).toEqual([]);
  });

  it("isolates loaded inputs, snapshots, previews, and finished results", async () => {
    const { catalog, skills, altmer } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    altmer.baselineCharacteristics = {
      ...altmer.baselineCharacteristics,
      int: 1,
    };
    const selections = ["alchemy"];
    await creator.chooseRacialBonus("altmer/magic", selections);
    selections.push("alteration");
    Object.defineProperty(skills.alchemy, "governingCharacteristics", {
      value: [],
    });
    const snapshot = creator.getSnapshot();
    Object.defineProperty(snapshot.answers.racialBonuses[0], "selections", {
      value: [],
    });
    Object.defineProperty(snapshot.racialBonusChoices[0], "options", {
      value: [],
    });
    Object.defineProperty(snapshot.racialSkillOptions[0], "key", {
      value: "changed",
    });
    Object.defineProperty(snapshot.contentVersion, "revision", {
      value: "changed",
    });
    const preview = creator.getCharacterPreview();
    preview.characteristics.int.baseline = 1;
    preview.skills.length = 0;
    const result = creator.finish();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.value.traits.length = 0;
    expect(creator.getCharacterPreview().traits).toHaveLength(1);
    expect(
      creator.getCharacterPreview().skills[0]?.skill.governingCharacteristics,
    ).toEqual(["int"]);
    expect(creator.getCharacterPreview().characteristics.int.baseline).toBe(30);
    expect(creator.getSnapshot().racialSkillOptions[0]?.key).toBe("alchemy");
    expect(creator.getSnapshot().contentVersion.revision).toBe("test-revision");
  });

  it("loads full definitions only for the active race, its traits, and selected skills", async () => {
    const { catalog, skills } = creationCatalogs();
    skills.unrelated = {
      skillKey: "unrelated",
      governingCharacteristics: ["ag"],
    };
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    expect(catalog.listCalls).toEqual(["skill"]);
    expect(catalog.getCalls).toEqual([
      { kind: "race", key: "altmer" },
      { kind: "trait", key: "weakness" },
    ]);
    expect(
      creator.getSnapshot().racialSkillOptions.map((entry) => entry.key),
    ).toEqual(["alchemy", "alteration"]);
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(catalog.getCalls.at(-1)).toEqual({ kind: "skill", key: "alchemy" });
    // Emulate adapter eviction. Re-evaluation uses the selected session definitions.
    delete skills.alchemy;
    catalog.getCalls.length = 0;
    catalog.listCalls.length = 0;
    for (let count = 0; count < 3; count++) {
      expect(creator.getSnapshot().canFinish).toBe(true);
      expect(creator.getCharacterPreview().skills).toHaveLength(1);
      expect(creator.finish().ok).toBe(true);
      creator.next();
      creator.previous();
    }
    expect(catalog.getCalls).toEqual([]);
    expect(catalog.listCalls).toEqual([]);
  });

  it("blocks finish and hides the old preview while a race change is loading", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("argonian");
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseRace("altmer");
    expect(creator.getSnapshot()).toMatchObject({
      canFinish: false,
      contentLoads: [
        { status: "loading", operation: { kind: "race", raceKey: "altmer" } },
      ],
    });
    expect(creator.getCharacterPreview().race).toBeUndefined();
    expect(creator.finish().ok).toBe(false);
    gate.resolve();
    await pending;
    expect(creator.getCharacterPreview().race?.label).toBe("Altmer");
  });

  it("lets the latest race selection win when responses arrive out of order", async () => {
    const { catalog } = creationCatalogs();
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "race" && key === "altmer") await gate.promise;
    };
    const creator = new CharacterCreator(catalog);
    const old = creator.chooseRace("altmer");
    await creator.chooseRace("argonian");
    gate.resolve();
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot().answers.raceKey).toBe("argonian");
    expect(creator.getSnapshot().contentLoads).toEqual([]);
  });

  it("lets the latest bonus answer win and applies no effects while it loads", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "skill" && key === "alchemy") await gate.promise;
    };
    const old = creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.finish().ok).toBe(false);
    await creator.chooseRacialBonus("altmer/magic", ["alteration"]);
    gate.resolve();
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot().answers.racialBonuses[0]?.selections).toEqual([
      "alteration",
    ]);
    expect(creator.getCharacterPreview().skills[0]?.skill.skillKey).toBe(
      "alteration",
    );
  });

  it("does not let an invalid edit be replaced by an older successful load", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const old = creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    await creator.chooseRacialBonus("altmer/magic", ["alchemy", "alteration"]);
    gate.resolve();
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(
      creator.getSnapshot().answers.racialBonuses[0]?.selections,
    ).toHaveLength(2);
  });

  it("invalidates pending bonus loads when changing race", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = deferred();
    catalog.beforeGet = async (kind) => {
      if (kind === "skill") await gate.promise;
    };
    const old = creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    await creator.chooseRace("argonian");
    gate.resolve();
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot().answers.racialBonuses).toEqual([]);
    expect(creator.getCharacterPreview().skills).toEqual([]);
  });

  it("allows independent groups to load concurrently and preserves other valid answers", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "one", choose: 1, options: ["alchemy"] },
          { id: "two", choose: 1, options: ["alteration"] },
        ],
      },
    ];
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "skill" && key === "alchemy") await gate.promise;
    };
    const first = creator.chooseRacialBonus("altmer/one", ["alchemy"]);
    await creator.chooseRacialBonus("altmer/two", ["alteration"]);
    expect(
      creator
        .getCharacterPreview()
        .skills.map((training) => training.skill.skillKey),
    ).toEqual(["alteration"]);
    gate.resolve();
    expect((await first).ok).toBe(true);
    expect(creator.finish().ok).toBe(true);
    await creator.chooseRacialBonus("altmer/one", []);
    expect(
      creator
        .getCharacterPreview()
        .skills.map((training) => training.skill.skillKey),
    ).toEqual(["alteration"]);
    expect(
      creator
        .getSnapshot()
        .answers.racialBonuses.find(
          (answer) => answer.choiceId === "altmer/two",
        )?.selections,
    ).toEqual(["alteration"]);
  });

  it("retains failed skill answers for retry without applying effects", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    catalog.beforeGet = async () => {
      throw new Error("offline");
    };
    expect(
      await creator.chooseRacialBonus("altmer/magic", ["alchemy"]),
    ).toMatchObject({ ok: false, issues: [{ code: "content-unavailable" }] });
    expect(creator.getSnapshot()).toMatchObject({
      canFinish: false,
      contentLoads: [{ status: "failed" }],
    });
    expect(creator.getSnapshot().answers.racialBonuses[0]?.selections).toEqual([
      "alchemy",
    ]);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    catalog.beforeGet = undefined;
    expect(
      (await creator.chooseRacialBonus("altmer/magic", ["alchemy"])).ok,
    ).toBe(true);
    expect(creator.finish().ok).toBe(true);
  });

  it("preserves committed answers after a failed race change and supports cancel/retry", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    catalog.beforeGet = async () => {
      throw new ContentError("content-access-denied", "Pack unavailable.");
    };
    expect(await creator.chooseRace("argonian")).toMatchObject({
      ok: false,
      issues: [{ code: "content-access-denied" }],
    });
    expect(creator.getSnapshot().answers.raceKey).toBe("altmer");
    expect(creator.finish().ok).toBe(false);
    expect(creator.getCharacterPreview().race).toBeUndefined();
    creator.cancelRaceSelection();
    expect(creator.finish().ok).toBe(true);
    expect(creator.getCharacterPreview().skills).toHaveLength(1);
    catalog.beforeGet = undefined;
    expect((await creator.chooseRace("argonian")).ok).toBe(true);
  });

  it("keeps valid answers when an unknown race or choice is requested", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    await creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    const answers = creator.getSnapshot().answers;
    await creator.chooseRace("unknown");
    await creator.chooseRacialBonus("unknown", []);
    expect(creator.getSnapshot().answers).toEqual(answers);
    expect(creator.finish().ok).toBe(true);
  });

  it("does not apply effects when a listed skill definition is actually missing", async () => {
    const { catalog, skills } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    delete skills.alchemy;
    expect(
      await creator.chooseRacialBonus("altmer/magic", ["alchemy"]),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-content" }] });
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.finish().ok).toBe(false);
  });

  it("rejects a mid-session content revision change", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    catalog.version.revision = "new-revision";
    expect(
      await creator.chooseRacialBonus("altmer/magic", ["alchemy"]),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "content-version-mismatch" }],
    });
    expect(creator.getCharacterPreview().skills).toEqual([]);
  });

  it("disposes active state and ignores pending completions", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseRace("altmer");
    creator.dispose();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot()).toMatchObject({
      answers: { raceKey: undefined, racialBonuses: [] },
      racialSkillOptions: [],
      contentLoads: [],
      canFinish: false,
    });
    expect(creator.getCharacterPreview().race).toBeUndefined();
    expect(await creator.chooseRace("argonian")).toMatchObject({
      ok: false,
      issues: [{ code: "disposed" }],
    });
  });

  it("stops further race reads after a canceled index request settles", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("argonian");
    const started = deferred();
    const gate = deferred();
    catalog.beforeList = async () => {
      started.resolve();
      await gate.promise;
    };
    const pending = creator.chooseRace("altmer");
    await started.promise;
    creator.cancelRaceSelection();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(
      catalog.getCalls.some(
        (call) => call.kind === "trait" && call.key === "weakness",
      ),
    ).toBe(false);
    expect(creator.getCharacterPreview().race?.label).toBe("Argonian");
    expect(creator.finish().ok).toBe(true);
  });

  it("reports skill-index loading failures as failures, not missing content", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    catalog.beforeList = async () => {
      throw new Error("offline");
    };
    expect(await creator.chooseRace("altmer")).toMatchObject({
      ok: false,
      issues: [{ code: "content-unavailable" }],
    });
    expect(creator.getSnapshot().answers.raceKey).toBeUndefined();
    catalog.beforeList = undefined;
    expect((await creator.chooseRace("altmer")).ok).toBe(true);
  });

  it("ignores an obsolete rejection after a newer selection succeeds", async () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    const gate = deferred();
    catalog.beforeGet = async (kind, key) => {
      if (kind === "skill" && key === "alchemy") await gate.promise;
    };
    const old = creator.chooseRacialBonus("altmer/magic", ["alchemy"]);
    await creator.chooseRacialBonus("altmer/magic", ["alteration"]);
    gate.reject(new Error("late failure"));
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot().contentLoads).toEqual([]);
    expect(creator.finish().ok).toBe(true);
    expect(creator.getCharacterPreview().skills[0]?.skill.skillKey).toBe(
      "alteration",
    );
  });

  it("never applies partial grants when one of a group's selected skills fails", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "magic", choose: 2, options: ["alchemy", "alteration"] },
        ],
      },
    ];
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    catalog.beforeGet = async (kind, key) => {
      if (kind === "skill" && key === "alteration") throw new Error("offline");
    };
    expect(
      (
        await creator.chooseRacialBonus("altmer/magic", [
          "alchemy",
          "alteration",
        ])
      ).ok,
    ).toBe(false);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.finish().ok).toBe(false);
  });

  it("supports zero-choice groups without loading full skills", async () => {
    const { catalog, altmer } = creationCatalogs();
    altmer.racialBonuses = [
      {
        bonusType: "skill",
        choiceGroups: [{ id: "none", choose: 0, options: [] }],
      },
    ];
    const creator = new CharacterCreator(catalog);
    await creator.chooseRace("altmer");
    expect(creator.finish().ok).toBe(true);
    expect((await creator.chooseRacialBonus("altmer/none", [])).ok).toBe(true);
    expect(catalog.listCalls).toEqual([]);
    expect(catalog.getCalls.some((call) => call.kind === "skill")).toBe(false);
  });

  it("shares one catalog between creators without sharing answers or lifecycle", async () => {
    const { catalog } = creationCatalogs();
    const first = new CharacterCreator(catalog);
    const second = new CharacterCreator(catalog);
    await first.chooseRace("altmer");
    await second.chooseRace("argonian");
    await first.chooseRacialBonus("altmer/magic", ["alchemy"]);
    first.dispose();
    expect(second.getSnapshot().answers.raceKey).toBe("argonian");
    expect(second.finish().ok).toBe(true);
    expect((await second.chooseRace("altmer")).ok).toBe(true);
    expect(second.getSnapshot().answers.racialBonuses).toEqual([]);
  });
});
