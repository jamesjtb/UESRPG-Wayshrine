import type { Size } from "../../src/enum/Size";

export default interface Attributes {
    hp: Attribute<number>;
    wt: Attribute<number>;
    sp: Attribute<number>;
    mp: Attribute<number>;
    ir: Attribute<number>;
    size: Attribute<Size>;
    speed: Attribute<number>;
    cr: Attribute<number>;
    ap: Attribute<number>;
    lp: Attribute<number>;
    luckyNumbers: Attribute<number[]>;
    unluckyNumbers: Attribute<number[]>;
    xp: Attribute<number>;
}

interface Attribute<T> {
    value: T;
}

