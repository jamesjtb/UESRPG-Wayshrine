import type { Characteristic } from "../../src/enum/Characteristic";
import type { AppliedTrait } from "./Trait";
import type { ChoiceGroup } from "../common/Choice";

/** Starting characteristic values supplied by a race. */
export type BaselineCharacteristics = Readonly<Record<Characteristic, number>>;

/** Each selected skill is granted at Novice rank. Group IDs are unique within a race. */
export interface RacialBonus {
  bonusType: "skill";
  choiceGroups: readonly ChoiceGroup<string>[];
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
