import type Attributes from "./Attributes";
import type { PcCharacteristics, NpcCharacteristics } from "./Characteristic";
import type { Race } from "./Race";
import type { SkillTraining } from "./Skill";
import type { AppliedTrait } from "./Trait";

export interface CharacterData {
    name: string;
    attributes: Attributes;
    characteristics: PcCharacteristics | NpcCharacteristics;
    race?: Race;
    rituals: object[];
    skills: SkillTraining[];
    spells: object[];
    talents: object[];
    traits: AppliedTrait[];
}
