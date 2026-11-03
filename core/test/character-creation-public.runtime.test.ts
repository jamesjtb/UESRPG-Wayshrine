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
    skill: {},
    trait: {},
  };
  return {
    version: { schemaVersion: 1, revision: "host-test" },
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
