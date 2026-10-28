import { Characteristic } from "../../src/enum/Characteristic";
import type { SkillRank } from "../../src/enum/SkillRank";

export default interface Skill {
    skillKey: string;
    governingCharacteristics: typeof Characteristic[];
}

export interface SkillTraining {
    skill: Skill;
    skillRank: SkillRank;
}
