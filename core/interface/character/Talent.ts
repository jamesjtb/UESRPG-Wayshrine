import type { Characteristic } from "../../src/enum/Characteristic";
import type { TalentLevel } from "../../src/enum/TalentLevel";

export interface Talent {
    label: string;
    description: string;
    level: TalentLevel;
    requires?: readonly string[]; // talent keys
    /** The single talent key this talent replaces when acquired. */
    replaces?: string;
    governingCharacteristic: Characteristic;
}
