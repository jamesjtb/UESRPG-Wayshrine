import type { Talent } from "../interface/character/Talent";
import { Characteristic } from "../src/enum/Characteristic";
import { TalentLevel } from "../src/enum/TalentLevel";

type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type TalentChecks = [
  Assert<Equal<Talent["requires"], readonly string[] | undefined>>,
  Assert<Equal<Talent["replaces"], string | undefined>>,
  Assert<Equal<Talent["governingCharacteristic"], Characteristic>>,
  Assert<Equal<`${TalentLevel.Novice}`, "0">>,
  Assert<Equal<`${TalentLevel.Apprentice}`, "1">>,
  Assert<Equal<`${TalentLevel.Journeyman}`, "2">>,
  Assert<Equal<`${TalentLevel.Adept}`, "3">>,
  Assert<Equal<`${TalentLevel.Expert}`, "4">>,
  Assert<Equal<`${TalentLevel.Master}`, "5">>,
];

const noPrerequisites = {
  label: "{LOCALE.talents.combatSenses.label}",
  description: "{LOCALE.talents.combatSenses.description}",
  level: TalentLevel.Novice,
  governingCharacteristic: Characteristic.Prc,
} satisfies Talent;

const multiplePrerequisites = {
  ...noPrerequisites,
  level: TalentLevel.Expert,
  requires: ["combatSenses", "honedSenses"],
} as const satisfies Talent;

const replacement = {
  ...multiplePrerequisites,
  replaces: "honedSenses",
} satisfies Talent;

const numericLevel = {
  ...noPrerequisites,
  level: 5,
} satisfies Talent;

// @ts-expect-error Every talent requires a governing characteristic.
const missingGoverningCharacteristic: Talent = {
  label: "Talent",
  description: "Description",
  level: TalentLevel.Novice,
};
// @ts-expect-error Every talent requires a label.
const missingLabel: Talent = {
  description: "Description",
  level: TalentLevel.Novice,
  governingCharacteristic: Characteristic.Prc,
};
// @ts-expect-error Every talent requires a description.
const missingDescription: Talent = {
  label: "Talent",
  level: TalentLevel.Novice,
  governingCharacteristic: Characteristic.Prc,
};
// @ts-expect-error Every talent requires a level.
const missingLevel: Talent = {
  label: "Talent",
  description: "Description",
  governingCharacteristic: Characteristic.Prc,
};

const scalarPrerequisite: Talent = {
  ...noPrerequisites,
  // @ts-expect-error Prerequisites must be an array of talent keys.
  requires: "honedSenses",
};
const multipleReplacements: Talent = {
  ...noPrerequisites,
  // @ts-expect-error A talent replaces only a single talent key.
  replaces: ["honedSenses", "combatSenses"],
};
const invalidLevel: Talent = {
  ...noPrerequisites,
  // @ts-expect-error Talent levels are limited to the existing values 0 through 5.
  level: 6,
};
const textualLevel: Talent = {
  ...noPrerequisites,
  // @ts-expect-error Talent levels use numeric enum values, not rank names.
  level: "Novice",
};
const unknownCharacteristic: Talent = {
  ...noPrerequisites,
  // @ts-expect-error A governing characteristic must be a known characteristic.
  governingCharacteristic: "perception",
};
