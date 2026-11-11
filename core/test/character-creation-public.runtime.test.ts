import { describe, expect, it } from "vitest";
import {
  calculateCharacteristicGeneration,
  Characteristic,
  CharacterCreator,
  validateCharacteristicGeneration,
} from "@wayshrine/core";
import type {
  CharacterCreationSnapshot,
  CharacterCreationStep,
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationCommandResult,
  CharacteristicGenerationField,
  CharacteristicGenerationMethod,
  CharacteristicRerollReplacement,
  CharacteristicRoll,
  ContentCatalog,
  ContentDefinitions,
  ContentKind,
} from "@wayshrine/core";

function hostCatalog(): ContentCatalog {
  const definitions: {
    [K in ContentKind]: Readonly<Record<string, ContentDefinitions[K]>>;
  } = {
    race: {
      human: {
        label: "Human",
        description: "Host fixture",
        baselineCharacteristics: {
          str: 20,
          end: 20,
          ag: 20,
          int: 20,
          wp: 20,
          prc: 20,
          prs: 20,
        },
        racialTraits: [],
      },
    },
    birthsign: {},
    power: {},
    skill: {},
    trait: {},
  };
  return {
    version: { schemaVersion: 2, revision: "host-test" },
    async get<K extends ContentKind>(kind: K, key: string) {
      const entries: Readonly<Record<string, ContentDefinitions[K]>> =
        definitions[kind];
      return entries[key];
    },
    async list() {
      return [];
    },
  };
}

function expectConsistent(
  creator: CharacterCreator,
): CharacterCreationSnapshot {
  const snapshot = creator.getSnapshot();
  const generation = snapshot.characteristicGeneration;
  const id: CharacterCreationStep = "characteristics";
  const step = snapshot.steps.find((candidate) => candidate.id === id)!;
  expect(generation.issues).toEqual(
    validateCharacteristicGeneration(generation.answer),
  );
  expect(step.issues).toEqual(generation.issues);
  expect(step.complete).toBe(generation.complete);
  expect(step.pendingChoices).toEqual([]);
  expect(snapshot.canFinish).toBe(
    snapshot.steps.every((candidate) => candidate.complete),
  );
  if (snapshot.currentStep === id)
    expect(snapshot.issues).toEqual(generation.issues);
  return snapshot;
}

function expectSubmissionIssues(
  creator: CharacterCreator,
  result: CharacteristicGenerationCommandResult,
  field: CharacteristicGenerationField,
): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected invalid submission");
  const snapshot = expectConsistent(creator);
  expect(result.issues).toEqual(
    snapshot.characteristicGeneration.issues.filter(
      (issue) => issue.field === field,
    ),
  );
  expect(creator.finish().ok).toBe(false);
}

describe("public character creation host contract", () => {
  it("runs the complete reroll workflow headlessly through the package entry point without putting policy in answers or finished data", async () => {
    const creator = new CharacterCreator(hostCatalog());
    await creator.chooseRace("human");
    creator.setCharacteristicGenerationMethod("rolled");
    creator.setFavoredCharacteristics(["str", "int"]);
    creator.submitLuckRoll({ id: "luck", dice: [6, 8] });
    const keys = Object.values(Characteristic);
    const initialPool: CharacteristicRoll[] = keys.map((key) => ({
      id: key,
      dice: [10, 10],
    }));
    const initialAssignments: CharacteristicAssignments = {
      str: "str",
      end: "end",
      ag: "ag",
      int: "int",
      wp: "wp",
      prc: "prc",
      prs: "prs",
    };
    expect(creator.submitCharacteristicRolls(initialPool).ok).toBe(true);
    expect(creator.setCharacteristicAssignments(initialAssignments).ok).toBe(
      true,
    );
    expect(expectConsistent(creator).characteristicGeneration.rerolls).toEqual({
      initialized: true,
      unlimited: false,
      batchSpent: false,
      available: true,
      maxBatchSize: 3,
    });

    const replacements: CharacteristicRerollReplacement[] = [
      { targetRollId: "str", replacement: { id: "lower-str", dice: [1, 1] } },
      { targetRollId: "ag", replacement: { id: "lower-ag", dice: [3, 4] } },
    ];
    expect(creator.rerollCharacteristics(replacements).ok).toBe(true);
    const rerolled = expectConsistent(creator).characteristicGeneration;
    expect(rerolled.drafts.rolled).toEqual({
      rolls: [
        replacements[0]!.replacement,
        initialPool[1],
        replacements[1]!.replacement,
        ...initialPool.slice(3),
      ],
      assignments: { end: "end", int: "int", wp: "wp", prc: "prc", prs: "prs" },
    });
    expect(rerolled.drafts.luck).toEqual({ id: "luck", dice: [6, 8] });
    expect(rerolled.rerolls).toEqual({
      initialized: true,
      unlimited: false,
      batchSpent: true,
      available: false,
      maxBatchSize: 0,
    });
    creator.setCharacteristicAssignments({
      ...initialAssignments,
      str: "lower-str",
      ag: "lower-ag",
    });
    const accepted = expectConsistent(creator);
    expect(accepted.canFinish).toBe(true);
    expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(2);
    expect(
      creator.rerollCharacteristics([
        {
          targetRollId: "end",
          replacement: { id: "second-normal", dice: [2, 2] },
        },
      ]),
    ).toMatchObject({
      ok: false,
      issues: [{ code: "reroll-unavailable", field: "rolls" }],
    });
    expect(creator.submitCharacteristicRolls(initialPool)).toMatchObject({
      ok: false,
      issues: [{ code: "pool-initialized", field: "rolls" }],
    });
    expect(expectConsistent(creator)).toEqual(accepted);

    const detached = creator.getSnapshot().characteristicGeneration;
    detached.rerolls.unlimited = true;
    detached.rerolls.batchSpent = false;
    detached.rerolls.initialized = false;
    detached.rerolls.available = true;
    detached.rerolls.maxBatchSize = 100;
    expect(expectConsistent(creator)).toEqual(accepted);
    // Standalone validation/calculation needs only the answer, not a creator or policy.
    const standaloneAnswer = structuredClone(
      accepted.characteristicGeneration.answer,
    );
    expect(Object.keys(standaloneAnswer).sort()).toEqual([
      "assignments",
      "favored",
      "luck",
      "method",
      "rolls",
    ]);
    expect(validateCharacteristicGeneration(standaloneAnswer)).toEqual([]);
    const standaloneCalculation =
      calculateCharacteristicGeneration(standaloneAnswer);
    expect(standaloneCalculation.ok).toBe(true);
    expect(creator.setUnlimitedCharacteristicRerolls(true).ok).toBe(true);
    expect(
      calculateCharacteristicGeneration(
        creator.getSnapshot().characteristicGeneration.answer,
      ),
    ).toEqual(standaloneCalculation);

    for (const prefix of ["unlimited-first", "unlimited-second"]) {
      const pool =
        creator.getSnapshot().characteristicGeneration.drafts.rolled.rolls;
      const batch: CharacteristicRerollReplacement[] = pool.map(
        (roll, index) => ({
          targetRollId: roll.id,
          replacement: { id: `${prefix}-${index}`, dice: [2, 3] },
        }),
      );
      expect(creator.rerollCharacteristics(batch).ok).toBe(true);
      const unlimited = expectConsistent(creator).characteristicGeneration;
      expect(unlimited.drafts.rolled.rolls).toEqual(
        batch.map((pair) => pair.replacement),
      );
      expect(unlimited.drafts.rolled.assignments).toEqual({});
      expect(unlimited.rerolls).toEqual({
        initialized: true,
        unlimited: true,
        batchSpent: true,
        available: true,
        maxBatchSize: 7,
      });
    }
    creator.setCharacteristicAssignments(
      Object.fromEntries(
        keys.map((key, index) => [key, `unlimited-second-${index}`]),
      ),
    );
    const unlimitedAnswer = structuredClone(
      expectConsistent(creator).characteristicGeneration.answer,
    );
    const unlimitedCalculation =
      calculateCharacteristicGeneration(unlimitedAnswer);
    expect(creator.setUnlimitedCharacteristicRerolls(false).ok).toBe(true);
    const switchedOff = expectConsistent(creator);
    expect(switchedOff.characteristicGeneration.rerolls).toEqual({
      initialized: true,
      unlimited: false,
      batchSpent: true,
      available: false,
      maxBatchSize: 0,
    });
    expect(switchedOff.characteristicGeneration.answer).toEqual(
      unlimitedAnswer,
    );
    expect(validateCharacteristicGeneration(unlimitedAnswer)).toEqual([]);
    expect(
      calculateCharacteristicGeneration(
        switchedOff.characteristicGeneration.answer,
      ),
    ).toEqual(unlimitedCalculation);
    expect(
      creator.rerollCharacteristics([
        {
          targetRollId: "unlimited-second-0",
          replacement: { id: "after-switch-off", dice: [1, 1] },
        },
      ]),
    ).toMatchObject({ ok: false, issues: [{ code: "reroll-unavailable" }] });
    expect(expectConsistent(creator)).toEqual(switchedOff);

    const finished = creator.finish();
    if (!finished.ok || !unlimitedCalculation.ok)
      throw new Error("Expected complete headless character");
    expect(finished.value).not.toHaveProperty("rerolls");
    expect(finished.value).not.toHaveProperty("characteristicGeneration");
    for (const data of Object.values(finished.value.characteristics)) {
      expect(Object.keys(data).sort()).toEqual([
        "baseline",
        "characteristicKey",
        "favored",
        "modifiers",
        "rolled",
      ]);
    }
    for (const contribution of Object.values(unlimitedCalculation.value)) {
      expect(Object.keys(contribution).sort()).toEqual(["favored", "rolled"]);
    }
    expect(finished.value.characteristics.str.rolled).toBe(5);
    expect(finished.value.characteristics.lck).toMatchObject({
      baseline: 30,
      rolled: 14,
    });
  });

  it.each(["rolled", "point-buy"] satisfies CharacteristicGenerationMethod[])(
    "corrects invalid %s submissions through navigation and finish using only public exports",
    async (method) => {
      const creator = new CharacterCreator(hostCatalog());
      await creator.chooseRace("human");
      creator.setName("Host character");
      expectConsistent(creator);
      expect(creator.next().ok).toBe(true);
      creator.setCharacteristicGenerationMethod(method);
      expectSubmissionIssues(
        creator,
        creator.setFavoredCharacteristics(["str", "str"]),
        "favored",
      );
      creator.setFavoredCharacteristics(["str", "int"]);
      expectConsistent(creator);
      expectSubmissionIssues(
        creator,
        creator.submitLuckRoll({ id: "luck", dice: [0, 10] }),
        "luck",
      );
      creator.submitLuckRoll({ id: "luck", dice: [10, 10] });
      const keys = Object.values(Characteristic);
      // Separate identified submissions with different faces but equal totals.
      const pool: CharacteristicRoll[] = keys.map((key, index) => ({
        id: `roll-${key}`,
        dice: [index + 1, 9 - index],
      }));
      const assignments: CharacteristicAssignments = {
        str: "roll-prs",
        end: "roll-prc",
        ag: "roll-wp",
        int: "roll-int",
        wp: "roll-ag",
        prc: "roll-end",
        prs: "roll-str",
      };
      const allocations: CharacteristicAllocations = {
        str: 20,
        end: 20,
        ag: 20,
        int: 10,
        wp: 10,
        prc: 0,
        prs: 0,
      };
      if (method === "rolled") {
        expectSubmissionIssues(
          creator,
          creator.submitCharacteristicRolls(pool.slice(1)),
          "rolls",
        );
        expect(creator.submitCharacteristicRolls(pool).ok).toBe(true);
        const unassigned = expectConsistent(creator);
        expect(unassigned.characteristicGeneration.complete).toBe(false);
        expectSubmissionIssues(
          creator,
          creator.setCharacteristicAssignments({ str: "missing" }),
          "assignments",
        );
        expect(creator.setCharacteristicAssignments(assignments).ok).toBe(true);
      } else {
        expectSubmissionIssues(
          creator,
          creator.setCharacteristicAllocations({ ...allocations, str: 19 }),
          "allocations",
        );
        expect(creator.setCharacteristicAllocations(allocations).ok).toBe(true);
      }
      const complete = expectConsistent(creator);
      expect(complete.canFinish).toBe(true);
      const calculated = calculateCharacteristicGeneration(
        complete.characteristicGeneration.answer,
      );
      if (!calculated.ok) throw new Error("Expected complete calculation");
      const finished = creator.finish();
      if (!finished.ok) throw new Error("Expected complete character");
      expect(finished.value.name).toBe("Host character");
      for (const key of keys) {
        expect(finished.value.characteristics[key]).toMatchObject(
          calculated.value[key],
        );
        expect(finished.value.characteristics[key].rolled).toBe(
          method === "rolled" ? 10 : allocations[key],
        );
      }
      expect(finished.value.characteristics.lck).toMatchObject({
        baseline: 30,
        rolled: 20,
      });
      expect(creator.previous().ok).toBe(true);
      expect(expectConsistent(creator).characteristicGeneration).toEqual(
        complete.characteristicGeneration,
      );
      expect(creator.finish().ok).toBe(true);
    },
  );
});
