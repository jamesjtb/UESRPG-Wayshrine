import type { PcCharacteristic } from "../../src/enum/Characteristic";
import type { ChoiceGroup } from "../common/Choice";
import type { AppliedTrait } from "./Trait";

/** Declarative grants, separate from character state and choice answers. */
export type BirthsignEffect =
  | {
      bonusType: "characteristic";
      bonusTargetKey: PcCharacteristic;
      bonusValue: number;
    }
  | {
      bonusType: "attribute";
      bonusTargetKey: "spMaximum" | "speed";
      bonusValue: number;
    }
  | {
      bonusType: "multiplier";
      bonusTargetKey: "naturalHealing";
      bonusValue: number;
    }
  | {
      bonusType: "trait";
      bonusTargetKey: string;
      bonusParams?: AppliedTrait["params"];
    }
  | {
      bonusType: "power";
      bonusTargetKey: string;
    }
  | {
      bonusType: "extraLuckyNumber";
      count: number;
      retainedRegardlessOfLuck: true;
    }
  | {
      /** Replaces the rolled component, not the total characteristic score. */
      bonusType: "replaceRolledCharacteristic";
      bonusTargetKey: PcCharacteristic;
      bonusValue: number;
    };

/** Options grant effects only; choices cannot be nested. */
export interface BirthsignChoiceOption {
  id: string;
  effects: readonly BirthsignEffect[];
}

/** Recurring selections are renewed at each long rest, replacing the old grants. */
export type BirthsignChoiceLifecycle =
  | { selection: "once" }
  | {
      selection: "recurring";
      chooseAt: "longRest";
      expiresAt: "nextLongRest";
    };

export interface BirthsignChoice {
  bonusType: "choice";
  choiceGroup: ChoiceGroup<BirthsignChoiceOption>;
  lifecycle: BirthsignChoiceLifecycle;
}

export type BirthsignBonus = BirthsignEffect | BirthsignChoice;

/** Alternate grants for a star-cursed birthsign. */
export interface StarCursedBirthsign {
  /** True replaces all base bonuses; false adds these bonuses to them. */
  overwriteBaseBonuses: boolean;
  bonuses: readonly BirthsignBonus[];
  /** When present, this variant requires the naturally rolled sign, not a Luck purchase. */
  eligibility?: {
    requiresNaturallyRolledSign: true;
    canSelectBySpendingLuck: false;
  };
}

/** Content references and trait parameter names are not validated by these types. */
export interface Birthsign {
  label: string;
  description: string;
  bonuses: readonly BirthsignBonus[];
  starCursed: StarCursedBirthsign;
}

/** Birthsign definitions indexed by their content keys. */
export type BirthsignCatalog = Readonly<Record<string, Birthsign>>;
