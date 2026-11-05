import type {
  CharacteristicGenerationAnswer,
  CharacteristicGenerationContributions,
  CharacteristicGenerationIssue,
  CharacteristicRoll,
} from "../../interface/character/CharacteristicGeneration";
import type { WizardResult } from "../../interface/common/Wizard";
import { Characteristic, PcCharacteristic } from "../enum/Characteristic";

const characteristics = Object.values(Characteristic);

export function validateCharacteristicGeneration(
  answer?: CharacteristicGenerationAnswer,
): CharacteristicGenerationIssue[] {
  const issues: CharacteristicGenerationIssue[] = [];
  const favored = answer?.favored ?? [];
  if (favored.length !== 2) {
    issues.push({
      code: "favored-count",
      field: "favored",
      message: "Choose exactly two favored characteristics.",
    });
  }
  if (new Set(favored).size !== favored.length) {
    issues.push({
      code: "duplicate-favored",
      field: "favored",
      message: "Favored characteristics must be distinct.",
    });
  }
  if (favored.some((key) => !characteristics.includes(key))) {
    issues.push({
      code: "invalid-favored",
      field: "favored",
      message: "Only shared, non-Luck characteristics can be favored.",
    });
  }
  issues.push(...validateRoll(answer?.luck, "luck"));
  switch (answer?.method) {
    case "rolled":
      issues.push(...validateRolled(answer));
      break;
    case "point-buy":
      issues.push(...validatePointBuy(answer));
      break;
    default:
      issues.push({
        code: "generation-method",
        field: "method",
        message: "Choose rolled or point-buy generation.",
      });
  }
  return issues;
}

export function validateRoll(
  roll: CharacteristicRoll | undefined,
  field: "luck" | "rolls",
): CharacteristicGenerationIssue[] {
  const issues: CharacteristicGenerationIssue[] = [];
  const label = field === "luck" ? "Luck" : "Characteristic roll";
  const target = {
    field,
    ...(typeof roll?.id === "string" ? { rollId: roll.id } : {}),
  };
  if (typeof roll?.id !== "string" || roll.id.trim() === "") {
    issues.push({
      code: "roll-identity",
      ...target,
      message: `${label} requires a non-empty roll ID.`,
    });
  }
  if (
    !Array.isArray(roll?.dice) ||
    roll.dice.length !== 2 ||
    !isD10Face(roll.dice[0]) ||
    !isD10Face(roll.dice[1])
  ) {
    issues.push({
      code: "invalid-dice",
      ...target,
      message: `${label} requires exactly two integer d10 faces (1–10).`,
    });
  }
  return issues;
}

function isD10Face(face: number | undefined): boolean {
  return (
    face !== undefined && Number.isInteger(face) && face >= 1 && face <= 10
  );
}

function validateRolled(
  answer: Extract<CharacteristicGenerationAnswer, { method: "rolled" }>,
): CharacteristicGenerationIssue[] {
  const issues: CharacteristicGenerationIssue[] = [];
  const rolls = answer.rolls ?? [];
  if (rolls.length !== characteristics.length) {
    issues.push({
      code: "roll-count",
      field: "rolls",
      message: "Submit seven separate 2d10 rolls.",
    });
  }
  for (const roll of rolls) {
    issues.push(...validateRoll(roll, "rolls"));
  }
  const rollIds = rolls.map((roll) => roll.id);
  for (const id of new Set(rollIds)) {
    if (rollIds.filter((candidate) => candidate === id).length < 2) continue;
    issues.push({
      code: "roll-identity",
      field: "rolls",
      rollId: id,
      message: "Characteristic roll IDs must be distinct.",
    });
  }
  const assignments = answer.assignments ?? {};
  const assignedIds = characteristics.map((key) => assignments[key]);
  if (
    Object.keys(assignments).length !== characteristics.length ||
    assignedIds.some((id) => id === undefined || !rollIds.includes(id)) ||
    new Set(assignedIds).size !== characteristics.length
  ) {
    issues.push({
      code: "invalid-assignment",
      field: "assignments",
      message: "Assign each roll once to exactly one shared characteristic.",
    });
  }
  for (const key of characteristics) {
    const id = assignments[key];
    if (
      id === undefined ||
      !rollIds.includes(id) ||
      assignedIds.filter((candidate) => candidate === id).length > 1
    ) {
      issues.push({
        code: "invalid-assignment",
        field: "assignments",
        characteristic: key,
        ...(id === undefined ? {} : { rollId: id }),
        message: "Assign an available roll not used by another characteristic.",
      });
    }
  }
  return issues;
}

function validatePointBuy(
  answer: Extract<CharacteristicGenerationAnswer, { method: "point-buy" }>,
): CharacteristicGenerationIssue[] {
  const issues: CharacteristicGenerationIssue[] = [];
  const allocations = answer.allocations ?? {};
  const values = characteristics.map((key) => allocations[key]);
  if (
    Object.keys(allocations).length !== characteristics.length ||
    values.some((value) => !isAllocation(value))
  ) {
    issues.push({
      code: "invalid-allocation",
      field: "allocations",
      message:
        "Allocate an integer from 0 to 20 to each shared characteristic only.",
    });
  }
  for (const key of characteristics) {
    if (!isAllocation(allocations[key])) {
      issues.push({
        code: "invalid-allocation",
        field: "allocations",
        characteristic: key,
        message: "Allocate an integer from 0 to 20 to this characteristic.",
      });
    }
  }
  const total = values.reduce<number>(
    (sum, value) => sum + (isAllocation(value) ? value : 0),
    0,
  );
  if (total !== 80) {
    issues.push({
      code: "point-budget",
      field: "allocations",
      message: "Spend exactly 80 points.",
    });
  }
  return issues;
}

function isAllocation(value: number | undefined): value is number {
  return (
    value !== undefined && Number.isInteger(value) && value >= 0 && value <= 20
  );
}

/** No randomness, mutation, racial baselines, or permission checks are involved. */
export function calculateCharacteristicGeneration(
  answer?: CharacteristicGenerationAnswer,
): WizardResult<CharacteristicGenerationContributions> {
  const issues = validateCharacteristicGeneration(answer);
  if (issues.length > 0 || !answer || !answer.method)
    return { ok: false, issues };

  return { ok: true, value: generationContributions(answer, issues) };
}

/** Internal preview projection: invalid groups contribute nothing, independently. */
export function projectCharacteristicGeneration(
  answer?: CharacteristicGenerationAnswer,
): CharacteristicGenerationContributions {
  return generationContributions(
    answer,
    validateCharacteristicGeneration(answer),
  );
}

function generationContributions(
  answer: CharacteristicGenerationAnswer | undefined,
  issues: readonly CharacteristicGenerationIssue[],
): CharacteristicGenerationContributions {
  const favoredValid = !issues.some((issue) => issue.field === "favored");
  const luckValid = !issues.some((issue) => issue.field === "luck");
  const methodValid = !issues.some(
    (issue) =>
      issue.field === "method" ||
      issue.field === "rolls" ||
      issue.field === "assignments" ||
      issue.field === "allocations",
  );
  const value = {} as CharacteristicGenerationContributions;
  for (const key of characteristics) {
    value[key] = {
      rolled: methodValid ? characteristicContribution(answer!, key) : 0,
      favored: favoredValid && answer!.favored!.includes(key),
    };
  }
  value[PcCharacteristic.Lck] = {
    rolled: luckValid ? diceTotal(answer!.luck!) : 0,
    favored: false,
  };
  return value;
}

/** Only called after validating the complete active method group. */
function characteristicContribution(
  answer: CharacteristicGenerationAnswer,
  key: Characteristic,
): number {
  if (answer.method === "rolled") {
    const roll = answer.rolls!.find(
      (candidate) => candidate.id === answer.assignments![key],
    )!;
    return diceTotal(roll);
  }
  if (answer.method === "point-buy") return answer.allocations![key]!;
  return 0;
}

function diceTotal(roll: CharacteristicRoll): number {
  return roll.dice[0]! + roll.dice[1]!;
}
