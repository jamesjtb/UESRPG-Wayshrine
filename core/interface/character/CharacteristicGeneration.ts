import type {
  Characteristic,
  PcCharacteristic,
} from "../../src/enum/Characteristic";
import type { WizardIssue } from "../common/Wizard";
import type { PcCharacteristicData } from "./Characteristic";

/** The host supplies faces; replacing a submission is sufficient for a reroll. */
export interface CharacteristicRoll {
  id: string;
  dice: readonly number[];
}

interface CommonGenerationAnswer {
  favored?: readonly Characteristic[];
  luck?: CharacteristicRoll;
}

/** Optional fields allow an incomplete answer to be validated without inventing values. */
export type CharacteristicGenerationAnswer = CommonGenerationAnswer &
  (
    | { method?: undefined }
    | {
        method: "rolled";
        rolls?: readonly CharacteristicRoll[];
        assignments?: Readonly<Partial<Record<Characteristic, string>>>;
      }
    | {
        method: "point-buy";
        allocations?: Readonly<Partial<Record<Characteristic, number>>>;
      }
  );

export interface CharacteristicGenerationIssue extends WizardIssue {
  code:
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
