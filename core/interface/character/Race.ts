import type { Characteristic } from "../../src/enum/Characteristic";
import type { AppliedTrait } from "./Trait";

/** Starting characteristic values supplied by a race. */
export type BaselineCharacteristics = Readonly<Record<Characteristic, number>>;

/** An available choice within a racial bonus group. */
export interface RacialBonusChoice {
  choiceGroup: string;
  choiceKey: string;
}

/** A racial bonus offering a selection of skills. */
export interface RacialBonus {
  bonusType: "skill";
  choices: readonly RacialBonusChoice[];
}

/** A reusable race definition from the content catalog. */
export interface Race {
  label: string;
  description: string;
  baselineCharacteristics: BaselineCharacteristics;
  racialTraits: readonly AppliedTrait[];
  racialBonuses?: readonly RacialBonus[];
}

/** Race definitions indexed by their content keys. */
export type RaceCatalog = Readonly<Record<string, Race>>;
