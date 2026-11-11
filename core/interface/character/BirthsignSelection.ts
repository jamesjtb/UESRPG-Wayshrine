import type { Birthsign, BirthsignChargeTable } from "./Birthsign";
import type { ContentErrorCode } from "../common/ContentCatalog";
import type { ChoiceAnswer, ChoiceIssue } from "../common/Choice";
import type { BirthsignChoiceState } from "./BirthsignPackage";

export interface BirthsignSelection {
  signKey: string;
  variant: "normal" | "starCursed";
}

/** One complete host-acquired sequence: zero or more fives, then one face 1–4. */
export interface BirthsignRoll {
  id: string;
  charge: BirthsignChargeTable["guardian"];
  dice: readonly number[];
}

export interface BirthsignOriginalResult {
  roll: BirthsignRoll;
  selection: BirthsignSelection;
}

export interface BirthsignSelectionIssue {
  code:
    | ContentErrorCode
    | "disposed"
    | "superseded"
    | "invalid-roll"
    | "roll-locked"
    | "original-required"
    | "invalid-selection"
    | "ineligible-selection"
    | "birthsign-required"
    | "birthsign-pending"
    | "affordability-pending"
    | "unaffordable-selection"
    | "unknown-choice"
    | ChoiceIssue["code"]
    | "unknown-birthsign";
  message: string;
  choiceId?: string;
}

export type BirthsignSelectionResult =
  | { ok: true; value: undefined }
  | { ok: false; issues: readonly BirthsignSelectionIssue[] };

export interface BirthsignSelectionSnapshot {
  freeChoice: boolean;
  original: BirthsignOriginalResult | undefined;
  selected: BirthsignSelection | undefined;
  /** Only the committed definition; browsing uses the host's catalog directly. */
  definition: Birthsign | undefined;
  provenance: "original" | "upgrade" | "purchase" | "freeChoice" | undefined;
  /** Undefined for an ineligible selection. Never deducted from statistics here. */
  purchaseCost: number | undefined;
  eligibilityIssues: readonly BirthsignSelectionIssue[];
  answers: readonly ChoiceAnswer<string>[];
  choices: readonly BirthsignChoiceState[];
  issues: readonly BirthsignSelectionIssue[];
  complete: boolean;
  load:
    | {
        selection: BirthsignSelection;
        status: "loading" | "failed";
        issues: readonly BirthsignSelectionIssue[];
      }
    | undefined;
}
