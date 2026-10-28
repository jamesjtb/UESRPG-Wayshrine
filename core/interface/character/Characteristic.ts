import { type Modifier } from "../common/Modifier";
import { NpcCharacteristic, PcCharacteristic } from "../../src/enum/Characteristic";

export interface PcCharacteristicData {
    baseline: number;
    rolled: number;
    characteristicKey: PcCharacteristic;
    favored: boolean;
    modifiers: Modifier[];
    score: number;
}

export interface NpcCharacteristicData {
    base: number;
    characteristicKey: NpcCharacteristic;
    modifiers: Modifier[];
    score: number;
}
