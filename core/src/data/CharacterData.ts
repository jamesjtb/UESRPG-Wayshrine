import type Attributes from "../../interface/character/Attributes";
import type { CharacterData } from "../../interface/character/Character";
import type {
  CharacteristicUpdate,
  PcCharacteristicData,
  PcCharacteristics,
} from "../../interface/character/Characteristic";
import type { Race } from "../../interface/character/Race";
import type { SkillTraining } from "../../interface/character/Skill";
import type { AppliedTrait } from "../../interface/character/Trait";
import { PcCharacteristic } from "../enum/Characteristic";
import { Size } from "../enum/Size";
import type { BirthsignSelection } from "../../interface/character/BirthsignSelection";
import type {
  BirthsignAdjustments,
  PowerGrant,
} from "../../interface/character/BirthsignPackage";

export default class PcCharacterData implements CharacterData {
  name: string;
  attributes: Attributes;
  characteristics: PcCharacteristics;
  race?: Race;
  birthsign?: BirthsignSelection;
  birthsignAdjustments: BirthsignAdjustments;
  powers: PowerGrant[];
  rituals: object[];
  skills: SkillTraining[];
  spells: object[];
  talents: object[];
  traits: AppliedTrait[];

  constructor() {
    this.name = "";
    this.birthsignAdjustments = {
      spMaximum: [],
      speed: [],
      naturalHealingMultiplier: 1,
      extraLuckyNumbers: [],
    };
    this.powers = [];
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
      baseline: characteristicKey === PcCharacteristic.Lck ? 30 : 0,
      rolled: 0,
      characteristicKey,
      favored: false,
      modifiers: [],
    };
  }
}
