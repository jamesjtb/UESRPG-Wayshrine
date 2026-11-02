export const Characteristic = {
    Str: 'str',
    End: 'end',
    Ag: 'ag',
    Int: 'int',
    Wp: 'wp',
    Prc: 'prc',
    Prs: 'prs',
} as const;

export type Characteristic =
    (typeof Characteristic)[keyof typeof Characteristic];

export const PcCharacteristic = {
    ...Characteristic,
    Lck: 'lck',
} as const;

export type PcCharacteristic =
    (typeof PcCharacteristic)[keyof typeof PcCharacteristic];

export const NpcCharacteristic = {
    ...Characteristic,
    Mrl: 'mrl',
} as const;

export type NpcCharacteristic =
    (typeof NpcCharacteristic)[keyof typeof NpcCharacteristic];
