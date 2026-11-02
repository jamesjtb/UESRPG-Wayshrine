import type Attributes from "../../interface/character/Attributes";
import type { CharacterData } from "../../interface/character/Character";
import type { CharacteristicUpdate, PcCharacteristicData, PcCharacteristics } from "../../interface/character/Characteristic";
import type { Race } from "../../interface/character/Race";
import type { SkillTraining } from "../../interface/character/Skill";
import type { AppliedTrait } from "../../interface/character/Trait";
import { PcCharacteristic } from "../enum/Characteristic";
import { Size } from "../enum/Size";

export default class PcCharacterData implements CharacterData {
    attributes: Attributes;
    characteristics: PcCharacteristics;
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

        this.characteristics = Object.fromEntries(
            Object.values(PcCharacteristic).map((key) => [
                key,
                this.createDefaultCharacteristic(key),
            ]),
        ) as PcCharacteristics;

        this.rituals = [];
        this.skills = [];
        this.spells = [];
        this.talents = [];
        this.traits = [];
    }

    updateCharacteristic(
        key: PcCharacteristic,
        changes: CharacteristicUpdate,
    ): void {
        Object.assign(this.characteristics[key], changes);
    }

    private createDefaultCharacteristic(
        characteristicKey: PcCharacteristic,
    ): PcCharacteristicData {
        return {
            baseline: 0,
            rolled: 0,
            characteristicKey,
            favored: false,
            modifiers: [],
        };
    }
}
