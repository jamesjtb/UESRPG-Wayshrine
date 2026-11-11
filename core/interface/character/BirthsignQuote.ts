import type { Birthsign } from "./Birthsign";
import type { ChoiceAnswer } from "../common/Choice";
import type {
  BirthsignChoiceState,
  EffectiveBirthsignPackage,
} from "./BirthsignPackage";
import type {
  BirthsignSelection,
  BirthsignSelectionIssue,
  BirthsignSelectionSnapshot,
} from "./BirthsignSelection";

/** A detached observation, never a reservation or authorization to select. */
export interface BirthsignQuote {
  selection: BirthsignSelection;
  definition: Birthsign;
  eligible: boolean;
  eligibilityIssues: readonly BirthsignSelectionIssue[];
  purchaseCost: number | undefined;
  acquisitionMethod: BirthsignSelectionSnapshot["acquisitionMethod"];
  /** Empty unless explicitly supplied; retained creator answers are never used. */
  answers: readonly ChoiceAnswer<string>[];
  choices: readonly BirthsignChoiceState[];
  effectivePackage: EffectiveBirthsignPackage | undefined;
  /** Includes candidate inherent effects/replacements, but excludes purchase cost. */
  luckBeforePurchase: number | undefined;
  finalLuck: number | undefined;
  affordability: "affordable" | "unaffordable" | "pending";
  missingInputs: readonly ("race" | "luck" | "choices" | "eligibility")[];
  issues: readonly BirthsignSelectionIssue[];
}

export type BirthsignQuoteResult =
  | { ok: true; value: BirthsignQuote }
  | { ok: false; issues: readonly BirthsignSelectionIssue[] };
