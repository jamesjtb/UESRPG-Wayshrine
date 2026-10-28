import type Attributes from "../../interface/character/Attributes";
import type { CharacterData } from "../../interface/character/Character";
import type { PcCharacteristicData } from "../../interface/character/Characteristic";
import type { Race } from "../../interface/character/Race";
import type { SkillTraining } from "../../interface/character/Skill";
import type { AppliedTrait } from "../../interface/character/Trait";
import { PcCharacteristic } from "../enum/Characteristic";
import { Size } from "../enum/Size";

export default class PcCharacterData implements CharacterData {
    attributes: Attributes;
    characteristics: PcCharacteristicData[];
    race?: Race;
    rituals: object[];
    skills: SkillTraining[];
    spells: object[];
    talents: object[];
    traits: AppliedTrait[];

    constructor() {
        this.attributes = {
            hp: { value: 0 },
            wt: { value: 0 },
            sp: { value: 0 },
            mp: { value: 0 },
            ir: { value: 0 },
            size: { value: Size.Standard },
            speed: { value: 0 },
            cr: { value: 0 },
            ap: { value: 0 },
            lp: { value: 0 },
            luckyNumbers: { value: [] },
            unluckyNumbers: { value: [] },
            xp: { value: 0 },
        };

        this.characteristics = [];
        this.rituals = [];
        this.skills = [];
        this.spells = [];
        this.talents = [];
        this.traits = [];
    }
}
