import type { PcCharacteristic } from "../../src/enum/Characteristic";
import type { Modifier } from "../common/Modifier";
import type { ChoiceAnswer, ChoiceIssue } from "../common/Choice";
import type {
  Birthsign,
  BirthsignBonus,
  BirthsignChoice,
  BirthsignEffect,
} from "./Birthsign";
import type { BirthsignSelection } from "./BirthsignSelection";
import type { AppliedTrait } from "./Trait";

export interface BirthsignChoiceState extends BirthsignChoice {
  selections: readonly string[];
}

export interface SourcedBirthsignBonus {
  bonus: BirthsignBonus;
  sourceId: string;
}

export interface SourcedBirthsignEffect {
  effect: BirthsignEffect;
  sourceId: string;
}

export interface PowerGrant {
  powerKey: string;
  origin: "birthsign";
  sourceId: string;
}

/** An entitlement only: actual lucky numbers are generated elsewhere. */
export interface LuckyNumberEntitlement {
  count: number;
  retainedRegardlessOfLuck: true;
  sourceId: string;
}

/** Aggregated inputs, not calculated base attributes or stored generated values. */
export interface BirthsignAdjustments {
  spMaximum: Modifier[];
  speed: Modifier[];
  naturalHealingMultiplier: number;
  extraLuckyNumbers: LuckyNumberEntitlement[];
}

export interface EffectiveBirthsignPackage extends BirthsignAdjustments {
  characteristicModifiers: Partial<Record<PcCharacteristic, Modifier[]>>;
  rolledReplacements: Partial<Record<PcCharacteristic, number>>;
  traits: AppliedTrait[];
  powers: PowerGrant[];
}

export interface BirthsignPackageInput {
  selection: BirthsignSelection;
  definition: Birthsign;
  answers: readonly ChoiceAnswer<string>[];
}

export type BirthsignPackageResult =
  | { ok: true; value: EffectiveBirthsignPackage }
  | { ok: false; issues: readonly ChoiceIssue[] };
