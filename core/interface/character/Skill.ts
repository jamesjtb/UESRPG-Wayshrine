import type { Characteristic } from "../../src/enum/Characteristic";
import type { SkillRank } from "../../src/enum/SkillRank";

interface SkillDefinition {
  skillKey: string;
  label?: string;
  description?: string;
  hasCustomName?: boolean;
}

/** A definition either lists its governing characteristics or lets the player choose. */
type Skill = SkillDefinition &
  (
    | {
        chooseGoverningCharacteristic: true;
        governingCharacteristics?: never;
      }
    | {
        chooseGoverningCharacteristic?: false;
        governingCharacteristics: readonly Characteristic[];
      }
  );

export type { Skill as default };

export interface SkillTraining {
  skill: Skill;
  skillRank: SkillRank;
  /** Character-specific answers, never properties of the shared definition. */
  customName?: string;
  governingCharacteristic?: Characteristic;
}
