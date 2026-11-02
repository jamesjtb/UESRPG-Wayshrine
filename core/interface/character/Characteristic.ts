import { type Modifier } from "../common/Modifier";
import { NpcCharacteristic, PcCharacteristic } from "../../src/enum/Characteristic";

export type PcCharacteristics = Record<PcCharacteristic, PcCharacteristicData>;
export type NpcCharacteristics = Record<NpcCharacteristic, NpcCharacteristicData>;

export interface PcCharacteristicData {
    baseline: number;
    rolled: number;
    characteristicKey: PcCharacteristic;
    favored: boolean;
    modifiers: Modifier[];
}

export type CharacteristicUpdate = Partial<Omit<PcCharacteristicData, "characteristicKey">>;

export interface NpcCharacteristicData {
    base: number;
    characteristicKey: NpcCharacteristic;
    modifiers: Modifier[];
    score: number;
}
