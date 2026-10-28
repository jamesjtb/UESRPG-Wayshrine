import type Attributes from "./Attributes";
import type { PcCharacteristicData, NpcCharacteristicData } from "./Characteristic";
import type { Race } from "./Race";
import type { SkillTraining } from "./Skill";
import type { AppliedTrait } from "./Trait";

export interface CharacterData {
    attributes: Attributes;
    characteristics: PcCharacteristicData[] | NpcCharacteristicData[];
    race?: Race;
    rituals: object[];
    skills: SkillTraining[];
    spells: object[];
    talents: object[];
    traits: AppliedTrait[];
}
