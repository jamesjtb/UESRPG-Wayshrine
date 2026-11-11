import type Attributes from "./Attributes";
import type { PcCharacteristics, NpcCharacteristics } from "./Characteristic";
import type { Race } from "./Race";
import type { SkillTraining } from "./Skill";
import type { AppliedTrait } from "./Trait";
import type { BirthsignSelection } from "./BirthsignSelection";
import type { BirthsignAdjustments, PowerGrant } from "./BirthsignPackage";

export interface CharacterData {
  name: string;
  attributes: Attributes;
  characteristics: PcCharacteristics | NpcCharacteristics;
  race?: Race;
  birthsign?: BirthsignSelection;
  birthsignAdjustments: BirthsignAdjustments;
  powers: PowerGrant[];
  rituals: object[];
  skills: SkillTraining[];
  spells: object[];
  talents: object[];
  traits: AppliedTrait[];
}
