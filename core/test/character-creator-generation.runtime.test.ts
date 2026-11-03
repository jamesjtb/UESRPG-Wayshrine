import { describe, expect, it } from "vitest";
import {
  Characteristic,
  CharacterCreator,
  validateCharacteristicGeneration,
} from "../src/index";
import type {
  CharacteristicGenerationCommandResult,
  CharacteristicGenerationDrafts,
} from "../src/index";
import { creationCatalogs, deferred } from "./support/ContentCatalog";

function setup() {
  const { catalog } = creationCatalogs();
  const creator = new CharacterCreator(catalog);
  return { creator, catalog };
}

function rolls() {
  return Object.values(Characteristic).map((key) => ({
    id: `roll-${key}`,
    dice: [5, 5],
  }));
}

function assignments() {
  return {
    str: "roll-str",
    end: "roll-end",
    ag: "roll-ag",
    int: "roll-int",
    wp: "roll-wp",
    prc: "roll-prc",
    prs: "roll-prs",
  };
}

function allocations() {
  return { str: 20, end: 20, ag: 20, int: 10, wp: 10, prc: 0, prs: 0 };
}

function populate(creator: CharacterCreator) {
  creator.setFavoredCharacteristics([Characteristic.Str, Characteristic.Int]);
  creator.submitLuckRoll({ id: "luck", dice: [4, 5] });
  creator.submitCharacteristicRolls(rolls());
  creator.setCharacteristicAssignments(assignments());
  creator.setCharacteristicAllocations(allocations());
  creator.setCharacteristicGenerationMethod("rolled");
}

function issues(result: CharacteristicGenerationCommandResult) {
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues;
}

describe("CharacterCreator generation drafts", () => {
  it("accepts synchronous edits before race selection without any content I/O", () => {
    const { creator, catalog } = setup();
    expect(creator.getSnapshot().characteristicGeneration).toMatchObject({
      drafts: {
        method: undefined,
        favored: [],
        luck: undefined,
        rolled: { rolls: [], assignments: {} },
        pointBuy: { allocations: {} },
      },
      answer: { method: undefined, favored: [] },
      complete: false,
    });
    const commands = [
      creator.setFavoredCharacteristics([
        Characteristic.Str,
        Characteristic.Int,
      ]),
      creator.setCharacteristicGenerationMethod("rolled"),
      creator.submitCharacteristicRolls(rolls()),
      creator.setCharacteristicAssignments(assignments()),
      creator.setCharacteristicAllocations(allocations()),
      creator.submitLuckRoll({ id: "luck", dice: [1, 10] }),
    ];
    for (const result of commands)
      expect(result).toEqual({ ok: true, value: undefined });
    const generation = creator.getSnapshot().characteristicGeneration;
    expect(generation.complete).toBe(true);
    expect(generation.issues).toEqual([]);
    expect(generation.answer).toEqual({
      method: "rolled",
      favored: ["str", "int"],
      luck: { id: "luck", dice: [1, 10] },
      rolls: rolls(),
      assignments: assignments(),
    });
    expect(catalog.getCalls).toEqual([]);
    expect(catalog.listCalls).toEqual([]);
    expect(creator.getSnapshot().issues).toEqual([
      { code: "race-required", message: "Choose a race." },
    ]);
  });

  it("reports only submission-relevant issues, while the snapshot validates the full active answer", () => {
    const { creator } = setup();
    expect(creator.setCharacteristicGenerationMethod("rolled").ok).toBe(true);
    expect(creator.submitCharacteristicRolls(rolls()).ok).toBe(true);
    expect(creator.setCharacteristicAssignments(assignments()).ok).toBe(true);
    const favoredIssues = issues(
      creator.setFavoredCharacteristics([Characteristic.Str]),
    );
    expect(favoredIssues.map((issue) => issue.field)).toEqual(["favored"]);
    const luckIssues = issues(
      creator.submitLuckRoll({ id: "luck", dice: [NaN, 10] }),
    );
    expect(luckIssues).toEqual([
      {
        code: "invalid-dice",
        field: "luck",
        rollId: "luck",
        message: expect.any(String),
      },
    ]);
    expect(
      issues(creator.setCharacteristicAllocations({ str: 1 })).every(
        (issue) => issue.field === "allocations",
      ),
    ).toBe(true);
    expect(
      issues(creator.setCharacteristicAssignments({ str: "unknown" })).every(
        (issue) => issue.field === "assignments",
      ),
    ).toBe(true);
    const snapshot = creator.getSnapshot().characteristicGeneration;
    expect(snapshot.issues).toEqual(
      validateCharacteristicGeneration(snapshot.answer),
    );
    expect(snapshot.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["favored", "luck", "assignments"]),
    );
    expect(snapshot.issues.some((issue) => issue.field === "allocations")).toBe(
      false,
    );
  });

  it("targets roll, assignment and allocation errors without requiring message parsing", () => {
    const { creator } = setup();
    const pool = rolls();
    pool[0]!.dice = [0, 10];
    expect(issues(creator.submitCharacteristicRolls(pool))).toEqual([
      {
        code: "invalid-dice",
        field: "rolls",
        rollId: "roll-str",
        message: expect.any(String),
      },
    ]);
    expect(
      issues(
        creator.setCharacteristicAssignments({
          ...assignments(),
          str: "missing",
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-assignment",
          field: "assignments",
          characteristic: "str",
          rollId: "missing",
        }),
      ]),
    );
    expect(
      issues(
        creator.setCharacteristicAllocations({
          ...allocations(),
          str: Infinity,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-allocation",
          field: "allocations",
          characteristic: "str",
        }),
      ]),
    );
  });

  it("targets duplicate roll identities", () => {
    const { creator } = setup();
    const pool = rolls();
    pool[1]!.id = pool[0]!.id;
    expect(issues(creator.submitCharacteristicRolls(pool))).toEqual([
      {
        code: "roll-identity",
        field: "rolls",
        rollId: "roll-str",
        message: expect.any(String),
      },
    ]);
  });

  it("preserves separate inactive drafts and common answers across method switches", () => {
    const { creator } = setup();
    populate(creator);
    const before = creator.getSnapshot().characteristicGeneration.drafts;
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(creator.getSnapshot().characteristicGeneration.answer).toEqual({
      method: "point-buy",
      favored: before.favored,
      luck: before.luck,
      allocations: allocations(),
    });
    creator.setCharacteristicAllocations({ str: 1 });
    const active = creator.getSnapshot().characteristicGeneration.answer;
    creator.submitCharacteristicRolls(rolls());
    expect(creator.getSnapshot().characteristicGeneration.answer).toEqual(
      active,
    );
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    creator.setCharacteristicAssignments({ str: "roll-str" });
    expect(creator.getSnapshot().characteristicGeneration.answer).toEqual(
      active,
    );
    expect(creator.getSnapshot().characteristicGeneration.drafts.method).toBe(
      "point-buy",
    );
    creator.setCharacteristicGenerationMethod("rolled");
    expect(creator.getSnapshot().characteristicGeneration.drafts).toEqual({
      ...before,
      rolled: { rolls: before.rolled.rolls, assignments: { str: "roll-str" } },
      pointBuy: { allocations: { str: 1 } },
    });
    const rolledActive = creator.getSnapshot().characteristicGeneration.answer;
    creator.setCharacteristicAllocations(allocations());
    expect(creator.getSnapshot().characteristicGeneration.answer).toEqual(
      rolledActive,
    );
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(true);
  });

  it("allows editing both drafts without choosing a method", () => {
    const { creator } = setup();
    creator.submitCharacteristicRolls(rolls());
    creator.setCharacteristicAssignments(assignments());
    creator.setCharacteristicAllocations(allocations());
    const generation = creator.getSnapshot().characteristicGeneration;
    expect(generation.drafts.method).toBeUndefined();
    expect(generation.answer).toEqual({ method: undefined, favored: [] });
    expect(generation.issues.some((issue) => issue.field === "method")).toBe(
      true,
    );
  });

  it("replaces assignment and allocation maps rather than merging, and empty maps clear", () => {
    const { creator } = setup();
    populate(creator);
    creator.setCharacteristicAssignments({ str: "roll-str" });
    creator.setCharacteristicAllocations({ str: 0 });
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ str: "roll-str" });
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({ str: 0 });
    creator.setCharacteristicAssignments({});
    creator.setCharacteristicAllocations({});
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({});
  });

  it("replaces the roll pool and always clears assignments, including for reused IDs or invalid pools", () => {
    const { creator } = setup();
    populate(creator);
    const before = creator.getSnapshot().characteristicGeneration.drafts;
    const replacement = rolls();
    replacement[0]!.dice = [1, 1];
    expect(creator.submitCharacteristicRolls(replacement).ok).toBe(true);
    expect(creator.getSnapshot().characteristicGeneration.drafts).toEqual({
      ...before,
      rolled: { rolls: replacement, assignments: {} },
    });
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);
    creator.setCharacteristicAssignments(assignments());
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(true);
    expect(
      issues(creator.submitCharacteristicRolls([])).map((issue) => issue.code),
    ).toEqual(["roll-count"]);
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled,
    ).toEqual({ rolls: [], assignments: {} });
  });

  it("replaces only Luck without clearing shared dice, assignments, allocations or favored selections", () => {
    const { creator } = setup();
    populate(creator);
    const before = creator.getSnapshot().characteristicGeneration.drafts;
    creator.submitLuckRoll({ id: "new-luck", dice: [1, 2] });
    expect(creator.getSnapshot().characteristicGeneration.drafts).toEqual({
      ...before,
      luck: { id: "new-luck", dice: [1, 2] },
    });
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(true);
  });

  it("retains invalid edits visibly and supports correction without speculative effects", () => {
    const { creator } = setup();
    populate(creator);
    creator.setFavoredCharacteristics([Characteristic.Str, Characteristic.Str]);
    creator.submitLuckRoll({ id: "bad-luck", dice: [1.5, 11] });
    creator.setCharacteristicGenerationMethod("point-buy");
    creator.setCharacteristicAllocations({ ...allocations(), str: NaN });
    const invalid = creator.getSnapshot().characteristicGeneration;
    expect(invalid.drafts.favored).toEqual(["str", "str"]);
    expect(invalid.drafts.luck?.dice).toEqual([1.5, 11]);
    expect(invalid.drafts.pointBuy.allocations.str).toBeNaN();
    expect(invalid.complete).toBe(false);
    expect(invalid.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "duplicate-favored",
        "invalid-dice",
        "invalid-allocation",
      ]),
    );
    creator.setFavoredCharacteristics([Characteristic.Str, Characteristic.Int]);
    creator.submitLuckRoll({ id: "corrected-luck", dice: [10, 10] });
    creator.setCharacteristicAllocations(allocations());
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(true);
    expect(creator.getCharacterPreview().characteristics.str).toMatchObject({
      baseline: 0,
      rolled: 0,
      favored: false,
    });
    expect(creator.getCharacterPreview().characteristics.lck).toMatchObject({
      baseline: 30,
      rolled: 0,
    });
  });

  it("keeps invalid runtime methods visible and reports only method validation", () => {
    const { creator } = setup();
    // @ts-expect-error Hosts can still send an unsupported method at runtime.
    const result = creator.setCharacteristicGenerationMethod("other");
    expect(issues(result)).toEqual([
      {
        code: "generation-method",
        field: "method",
        message: expect.any(String),
      },
    ]);
    expect(creator.getSnapshot().characteristicGeneration.drafts.method).toBe(
      "other",
    );
    expect(creator.getSnapshot().characteristicGeneration.answer.method).toBe(
      "other",
    );
    expect(creator.setCharacteristicGenerationMethod("rolled").ok).toBe(true);
  });

  it("detaches submitted arrays, maps, roll objects and nested dice from creator state", () => {
    const { creator } = setup();
    const favored = [Characteristic.Str, Characteristic.Int];
    const pool = rolls();
    const assigned = assignments();
    const points = allocations();
    const luck = { id: "luck", dice: [4, 5] };
    creator.setFavoredCharacteristics(favored);
    creator.submitCharacteristicRolls(pool);
    creator.setCharacteristicAssignments(assigned);
    creator.setCharacteristicAllocations(points);
    creator.submitLuckRoll(luck);
    creator.setCharacteristicGenerationMethod("rolled");
    const before = creator.getSnapshot().characteristicGeneration;
    favored.length = 0;
    pool[0]!.id = "changed";
    pool[0]!.dice[0] = 0;
    pool.push({ id: "extra", dice: [0, 0] });
    assigned.str = "changed";
    points.str = 0;
    luck.id = "changed";
    luck.dice[0] = 0;
    expect(creator.getSnapshot().characteristicGeneration).toEqual(before);
  });

  it("detaches snapshots, active answers, drafts and command issue objects", () => {
    const { creator } = setup();
    populate(creator);
    const submissionIssues = issues(
      creator.submitLuckRoll({ id: "luck", dice: [0, 1] }),
    );
    const snapshot = creator.getSnapshot().characteristicGeneration;
    const before = creator.getSnapshot().characteristicGeneration;
    Object.defineProperty(submissionIssues[0], "field", { value: "changed" });
    Object.defineProperty(snapshot.issues[0], "message", { value: "changed" });
    Object.defineProperty(snapshot.issues[0], "rollId", { value: "changed" });
    Object.defineProperty(snapshot.drafts.favored, "0", { value: "end" });
    Object.defineProperty(snapshot.drafts.rolled.rolls[0], "id", {
      value: "changed",
    });
    Object.defineProperty(snapshot.drafts.rolled.rolls[0]!.dice, "0", {
      value: 0,
    });
    Object.defineProperty(snapshot.drafts.rolled.assignments, "str", {
      value: "changed",
    });
    Object.defineProperty(snapshot.drafts.pointBuy.allocations, "str", {
      value: 0,
    });
    Object.defineProperty(snapshot.drafts.luck!.dice, "0", { value: 10 });
    expect(snapshot.answer.luck?.dice).toEqual([0, 1]);
    Object.defineProperty(snapshot.answer.luck!.dice, "0", { value: 5 });
    if (snapshot.answer.method !== "rolled")
      throw new Error("Expected rolled answer");
    Object.defineProperty(snapshot.answer.rolls![0]!.dice, "0", { value: 0 });
    Object.defineProperty(snapshot.answer.assignments!, "str", {
      value: "changed",
    });
    expect(creator.getSnapshot().characteristicGeneration).toEqual(before);
    creator.setCharacteristicGenerationMethod("point-buy");
    const pointSnapshot = creator.getSnapshot().characteristicGeneration;
    if (pointSnapshot.answer.method !== "point-buy")
      throw new Error("Expected point buy");
    Object.defineProperty(pointSnapshot.answer.allocations!, "str", {
      value: 0,
    });
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual(allocations());
  });

  it("retains drafts across race loading, failures, cancellation, retry and successful changes", async () => {
    const { creator, catalog } = setup();
    populate(creator);
    await creator.chooseRace("argonian");
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseRace("altmer");
    const readCount = catalog.getCalls.length;
    const listCount = catalog.listCalls.length;
    creator.setFavoredCharacteristics([Characteristic.End, Characteristic.Wp]);
    creator.setCharacteristicGenerationMethod("point-buy");
    creator.submitCharacteristicRolls(rolls());
    creator.setCharacteristicAssignments(assignments());
    creator.setCharacteristicAllocations(allocations());
    creator.submitLuckRoll({ id: "during-load", dice: [2, 3] });
    const during = creator.getSnapshot().characteristicGeneration;
    expect(during.complete).toBe(true);
    expect(catalog.getCalls).toHaveLength(readCount);
    expect(catalog.listCalls).toHaveLength(listCount);
    gate.reject(new Error("offline"));
    await pending;
    expect(creator.getSnapshot().contentLoads[0]?.status).toBe("failed");
    expect(creator.getSnapshot().characteristicGeneration).toEqual(during);
    creator.cancelRaceSelection();
    expect(creator.getSnapshot().characteristicGeneration).toEqual(during);
    catalog.beforeGet = undefined;
    await creator.chooseRace("altmer");
    expect(creator.getSnapshot().characteristicGeneration).toEqual(during);
    await creator.chooseRace("argonian");
    expect(creator.getSnapshot().characteristicGeneration).toEqual(during);
    await creator.chooseRace("argonian");
    expect(creator.getSnapshot().characteristicGeneration).toEqual(during);
  });

  it("preserves edits when an in-flight race change is canceled before completion", async () => {
    const { creator, catalog } = setup();
    populate(creator);
    await creator.chooseRace("argonian");
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseRace("altmer");
    creator.setCharacteristicAssignments({ str: "roll-str" });
    creator.submitLuckRoll({ id: "pending-luck", dice: [1, 2] });
    const generation = creator.getSnapshot().characteristicGeneration;
    creator.cancelRaceSelection();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(creator.getSnapshot().answers.raceKey).toBe("argonian");
    expect(creator.getSnapshot().characteristicGeneration).toEqual(generation);
  });

  it("does not register a generation step, block race-only finish, or project generation effects", async () => {
    const { creator } = setup();
    await creator.chooseRace("argonian");
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);
    expect(creator.getSnapshot().steps.map((step) => step.id)).toEqual([
      "race",
    ]);
    expect(creator.getSnapshot().canFinish).toBe(true);
    const before = creator.getCharacterPreview();
    populate(creator);
    expect(creator.getCharacterPreview()).toEqual(before);
    creator.setFavoredCharacteristics([]);
    expect(creator.getSnapshot().characteristicGeneration.complete).toBe(false);
    expect(creator.getSnapshot().issues).toEqual([]);
    expect(creator.next().ok).toBe(false);
    expect(creator.previous().ok).toBe(false);
    const finished = creator.finish();
    expect(finished.ok).toBe(true);
    if (finished.ok) expect(finished.value).toEqual(before);
  });

  it("clears generation on disposal and rejects every generation command without mutation", () => {
    const { creator } = setup();
    populate(creator);
    const previous = creator.getSnapshot().characteristicGeneration;
    creator.dispose();
    const cleared = creator.getSnapshot().characteristicGeneration;
    const expectedDrafts: CharacteristicGenerationDrafts = {
      method: undefined,
      favored: [],
      luck: undefined,
      rolled: { rolls: [], assignments: {} },
      pointBuy: { allocations: {} },
    };
    expect(cleared.drafts).toEqual(expectedDrafts);
    const commands = [
      () =>
        creator.setFavoredCharacteristics([
          Characteristic.End,
          Characteristic.Wp,
        ]),
      () => creator.setCharacteristicGenerationMethod("point-buy"),
      () => creator.submitCharacteristicRolls(rolls()),
      () => creator.setCharacteristicAssignments(assignments()),
      () => creator.setCharacteristicAllocations(allocations()),
      () => creator.submitLuckRoll({ id: "late", dice: [10, 10] }),
    ];
    for (const command of commands) {
      expect(command()).toMatchObject({
        ok: false,
        issues: [{ code: "disposed" }],
      });
      expect(creator.getSnapshot().characteristicGeneration).toEqual(cleared);
    }
    expect(previous.complete).toBe(true);
    expect(previous.drafts.rolled.rolls).toHaveLength(7);
  });
});
