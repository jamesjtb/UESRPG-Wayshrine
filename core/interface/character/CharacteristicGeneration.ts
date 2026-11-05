import type {
  Characteristic,
  PcCharacteristic,
} from "../../src/enum/Characteristic";
import type { WizardIssue } from "../common/Wizard";
import type { PcCharacteristicData } from "./Characteristic";

/** The host supplies identified dice results; Core never acquires dice. */
export interface CharacteristicRoll {
  id: string;
  dice: readonly number[];
}

interface CommonGenerationAnswer {
  favored?: readonly Characteristic[];
  luck?: CharacteristicRoll;
}

export type CharacteristicGenerationMethod = "rolled" | "point-buy";
export type CharacteristicAssignments = Readonly<
  Partial<Record<Characteristic, string>>
>;
export type CharacteristicAllocations = Readonly<
  Partial<Record<Characteristic, number>>
>;

export interface CharacteristicGenerationDrafts {
  method: CharacteristicGenerationMethod | undefined;
  favored: readonly Characteristic[];
  luck: CharacteristicRoll | undefined;
  rolled: {
    rolls: readonly CharacteristicRoll[];
    assignments: CharacteristicAssignments;
  };
  pointBuy: { allocations: CharacteristicAllocations };
}

export interface CharacteristicGenerationSnapshot {
  drafts: CharacteristicGenerationDrafts;
  rerolls: CharacteristicRerollSnapshot;
  answer: CharacteristicGenerationAnswer;
  issues: readonly CharacteristicGenerationIssue[];
  complete: boolean;
}

export interface CharacteristicRerollReplacement {
  targetRollId: string;
  replacement: CharacteristicRoll;
}

/** Session policy only; never part of a generation answer or calculated data. */
export interface CharacteristicRerollSnapshot {
  unlimited: boolean;
  batchSpent: boolean;
  initialized: boolean;
  available: boolean;
  /** Zero when unavailable; otherwise three normally or seven with unlimited enabled. */
  maxBatchSize: number;
}

export type CharacteristicGenerationField =
  "method" | "favored" | "luck" | "rolls" | "assignments" | "allocations";

export type CharacteristicGenerationCommandResult =
  | { ok: true; value: void }
  | { ok: false; issues: readonly CharacteristicGenerationIssue[] };

/** Optional fields allow an incomplete answer to be validated without inventing values. */
export type CharacteristicGenerationAnswer = CommonGenerationAnswer &
  (
    | { method?: undefined }
    | {
        method: "rolled";
        rolls?: readonly CharacteristicRoll[];
        assignments?: CharacteristicAssignments;
      }
    | {
        method: "point-buy";
        allocations?: CharacteristicAllocations;
      }
  );

export interface CharacteristicGenerationIssue extends WizardIssue {
  field?: CharacteristicGenerationField;
  rollId?: string;
  characteristic?: Characteristic;
  code:
    | "disposed"
    | "pool-initialized"
    | "pool-uninitialized"
    | "reroll-unavailable"
    | "reroll-count"
    | "reroll-target"
    | "generation-method"
    | "favored-count"
    | "duplicate-favored"
    | "invalid-favored"
    | "roll-count"
    | "roll-identity"
    | "invalid-dice"
    | "invalid-assignment"
    | "invalid-allocation"
    | "point-budget";
}

/** Both generation methods populate rolled, never the independently supplied baseline. */
export type CharacteristicGenerationContributions = Record<
  PcCharacteristic,
  Pick<PcCharacteristicData, "rolled" | "favored">
>;
