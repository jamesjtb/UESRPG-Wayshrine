import type {
  Birthsign,
  BirthsignBonus,
  BirthsignCatalog,
  BirthsignChoice,
  BirthsignChoiceOption,
  BirthsignEffect,
  StarCursedBirthsign,
} from "../interface/character/Birthsign";
import type {
  Birthsign as PublicBirthsign,
  BirthsignBonus as PublicBirthsignBonus,
  BirthsignCatalog as PublicBirthsignCatalog,
  BirthsignChoice as PublicBirthsignChoice,
  BirthsignChoiceLifecycle as PublicBirthsignChoiceLifecycle,
  BirthsignChoiceOption as PublicBirthsignChoiceOption,
  BirthsignEffect as PublicBirthsignEffect,
  StarCursedBirthsign as PublicStarCursedBirthsign,
} from "../src/index";

const effects = [
  { bonusType: "characteristic", bonusTargetKey: "str", bonusValue: 5 },
  { bonusType: "characteristic", bonusTargetKey: "wp", bonusValue: -5 },
  { bonusType: "attribute", bonusTargetKey: "spMaximum", bonusValue: 1 },
  { bonusType: "attribute", bonusTargetKey: "speed", bonusValue: 2 },
  { bonusType: "multiplier", bonusTargetKey: "naturalHealing", bonusValue: 2 },
  {
    bonusType: "trait",
    bonusTargetKey: "weakness",
    bonusParams: { type: "fire", X: 2 },
  },
  { bonusType: "trait", bonusTargetKey: "stuntedMagicka" },
  { bonusType: "power", bonusTargetKey: "moonshadow" },
  { bonusType: "extraLuckyNumber", count: 1, retainedRegardlessOfLuck: true },
  {
    bonusType: "replaceRolledCharacteristic",
    bonusTargetKey: "lck",
    bonusValue: 50,
  },
] as const satisfies readonly BirthsignEffect[];

const penaltyOption = {
  id: "wp",
  effects: [
    { bonusType: "characteristic", bonusTargetKey: "wp", bonusValue: -5 },
  ],
} as const satisfies BirthsignChoiceOption;

const once = {
  bonusType: "choice",
  choiceGroup: { id: "theSteedPenalty", choose: 1, options: [penaltyOption] },
  lifecycle: { selection: "once" },
} satisfies BirthsignChoice;

const recurring = {
  bonusType: "choice",
  choiceGroup: {
    id: "theRitualPower",
    choose: 1,
    options: [
      {
        id: "blessedTouch",
        effects: [{ bonusType: "power", bonusTargetKey: "blessedTouch" }],
      },
    ],
  },
  lifecycle: {
    selection: "recurring",
    chooseAt: "longRest",
    expiresAt: "nextLongRest",
  },
} satisfies BirthsignChoice;

const additive = {
  overwriteBaseBonuses: false,
  bonuses: [effects[0], once],
} satisfies StarCursedBirthsign;

const replacement = {
  overwriteBaseBonuses: true,
  bonuses: [effects[5]],
} satisfies StarCursedBirthsign;

const thief = {
  label: "{LOCALE.birthsigns.theThief.label}",
  description: "{LOCALE.birthsigns.theThief.description}",
  bonuses: [effects[8]],
  starCursed: {
    overwriteBaseBonuses: false,
    eligibility: {
      requiresNaturallyRolledSign: true,
      canSelectBySpendingLuck: false,
    },
    bonuses: [
      effects[9],
      { bonusType: "power", bonusTargetKey: "akaviriDangerSense" },
      { bonusType: "trait", bonusTargetKey: "runningOutOfLuck" },
    ],
  },
} satisfies Birthsign;

const bonuses = [
  ...effects,
  once,
  recurring,
] satisfies readonly BirthsignBonus[];
const catalog = { theThief: thief } satisfies BirthsignCatalog;

const publicBirthsign: PublicBirthsign = thief;
const publicBonus: PublicBirthsignBonus = once;
const publicCatalog: PublicBirthsignCatalog = catalog;
const publicChoice: PublicBirthsignChoice = recurring;
const publicOnceLifecycle: PublicBirthsignChoiceLifecycle = once.lifecycle;
const publicRecurringLifecycle: PublicBirthsignChoiceLifecycle =
  recurring.lifecycle;
const publicOption: PublicBirthsignChoiceOption = penaltyOption;
const publicEffect: PublicBirthsignEffect = effects[0];
const publicStarCursed: PublicStarCursedBirthsign = replacement;

const unknownCharacteristic: BirthsignEffect = {
  bonusType: "characteristic",
  // @ts-expect-error Characteristic effects require a known PC characteristic.
  bonusTargetKey: "strength",
  bonusValue: 5,
};
const unknownAttribute: BirthsignEffect = {
  bonusType: "attribute",
  // @ts-expect-error Attribute effects only support spMaximum and speed.
  bonusTargetKey: "hpMaximum",
  bonusValue: 1,
};
const unknownMultiplier: BirthsignEffect = {
  bonusType: "multiplier",
  // @ts-expect-error Multipliers only support naturalHealing.
  bonusTargetKey: "speed",
  bonusValue: 2,
};
const unknownReplacement: BirthsignEffect = {
  bonusType: "replaceRolledCharacteristic",
  // @ts-expect-error Rolled replacements require a known PC characteristic.
  bonusTargetKey: "luck",
  bonusValue: 50,
};
// @ts-expect-error A trait grant must name the trait.
const missingTraitKey: BirthsignEffect = {
  bonusType: "trait",
  bonusParams: { X: 10 },
};
// @ts-expect-error Characteristic adjustments require a value.
const missingValue: BirthsignEffect = {
  bonusType: "characteristic",
  bonusTargetKey: "str",
};
// @ts-expect-error Extra lucky numbers must be retained regardless of Luck.
const missingRetention: BirthsignEffect = {
  bonusType: "extraLuckyNumber",
  count: 1,
};
const falseRetention: BirthsignEffect = {
  bonusType: "extraLuckyNumber",
  count: 1,
  // @ts-expect-error The retention flag cannot be false.
  retainedRegardlessOfLuck: false,
};
const incompatibleValue: BirthsignEffect = {
  bonusType: "power",
  bonusTargetKey: "moonshadow",
  // @ts-expect-error Power grants have no numeric adjustment in fresh literals.
  bonusValue: 5,
};
const invalidParams: BirthsignEffect = {
  bonusType: "trait",
  bonusTargetKey: "weakness",
  // @ts-expect-error Named trait parameter values must be strings or numbers.
  bonusParams: { X: true },
};
// @ts-expect-error Choice options require stable IDs.
const missingOptionId: BirthsignChoiceOption = { effects: [] };
// @ts-expect-error Choice options require effects.
const missingOptionEffects: BirthsignChoiceOption = { id: "wp" };
// @ts-expect-error Choice effects cannot contain another choice.
const nestedChoice: BirthsignChoiceOption = { id: "nested", effects: [once] };
const malformedGroup: BirthsignChoice["choiceGroup"] = {
  id: "penalty",
  choose: 1,
  // @ts-expect-error Options are definitions, not string references.
  options: ["wp"],
};
const unsupportedSelection: BirthsignChoice["lifecycle"] = {
  // @ts-expect-error Only once and recurring selections are supported.
  selection: "daily",
};
// @ts-expect-error Recurring choices require both lifecycle boundaries.
const missingBoundaries: BirthsignChoice["lifecycle"] = {
  selection: "recurring",
};
const unsupportedChooseAt: BirthsignChoice["lifecycle"] = {
  selection: "recurring",
  // @ts-expect-error Recurring choices are made at long rests only.
  chooseAt: "shortRest",
  expiresAt: "nextLongRest",
};
const unsupportedExpiry: BirthsignChoice["lifecycle"] = {
  selection: "recurring",
  chooseAt: "longRest",
  // @ts-expect-error Recurring choices expire at the next long rest only.
  expiresAt: "nextShortRest",
};
const incompatibleLifecycle: BirthsignChoice["lifecycle"] = {
  selection: "once",
  // @ts-expect-error One-time lifecycle literals have no recurring boundaries.
  chooseAt: "longRest",
};
const unnaturalEligibility: StarCursedBirthsign["eligibility"] = {
  // @ts-expect-error Restricted eligibility requires a naturally rolled sign.
  requiresNaturallyRolledSign: false,
  canSelectBySpendingLuck: false,
};
const purchasedEligibility: StarCursedBirthsign["eligibility"] = {
  requiresNaturallyRolledSign: true,
  // @ts-expect-error Restricted eligibility cannot allow spending Luck.
  canSelectBySpendingLuck: true,
};
