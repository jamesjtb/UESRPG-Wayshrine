import {
  Characteristic,
  NpcCharacteristic,
  PcCharacteristic,
  Size,
  SkillRank,
} from "../src/index";
import type {
  AppliedTrait,
  Attributes,
  BaselineCharacteristics,
  CharacterData,
  Modifier,
  NpcCharacteristicData,
  PcCharacteristicData,
  Race,
  RaceCatalog,
  RacialBonus,
  ChoiceGroup,
  Skill,
  SkillTraining,
  Trait,
  TraitCatalog,
  TraitOrigin,
  ContentCatalog,
  BirthsignSelection,
  BirthsignAdjustments,
  PowerGrant,
  LuckyNumberEntitlement,
} from "../src/index";
import PcCharacterData from "../src/data/CharacterData";

type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type ModelChecks = [
  Assert<Equal<PcCharacteristicData["characteristicKey"], PcCharacteristic>>,
  Assert<Equal<NpcCharacteristicData["characteristicKey"], NpcCharacteristic>>,
  Assert<Equal<Attributes["size"]["value"], Size>>,
  Assert<Equal<Attributes["hp"]["value"], number>>,
  Assert<Equal<Attributes["luckyNumbers"]["value"], number[]>>,
  Assert<Equal<SkillTraining["skill"], Skill>>,
  Assert<Equal<SkillTraining["skillRank"], SkillRank>>,
  Assert<
    Equal<SkillTraining["governingCharacteristic"], Characteristic | undefined>
  >,
  Assert<Equal<PcCharacteristicData["modifiers"], Modifier[]>>,
  Assert<Equal<PcCharacteristicData["purchaseCost"], Modifier | undefined>>,
  Assert<Equal<CharacterData["birthsign"], BirthsignSelection | undefined>>,
  Assert<Equal<CharacterData["powers"], PowerGrant[]>>,
  Assert<Equal<BirthsignAdjustments["spMaximum"], Modifier[]>>,
  Assert<Equal<BirthsignAdjustments["speed"], Modifier[]>>,
  Assert<Equal<BirthsignAdjustments["naturalHealingMultiplier"], number>>,
  Assert<Equal<LuckyNumberEntitlement["count"], number>>,
  Assert<Equal<LuckyNumberEntitlement["retainedRegardlessOfLuck"], true>>,
  Assert<Equal<Race["baselineCharacteristics"], BaselineCharacteristics>>,
  Assert<
    Equal<BaselineCharacteristics, Readonly<Record<Characteristic, number>>>
  >,
  Assert<Equal<Race["racialTraits"], readonly AppliedTrait[]>>,
  Assert<Equal<Race["racialBonuses"], readonly RacialBonus[] | undefined>>,
  Assert<Equal<RacialBonus["choiceGroups"], readonly ChoiceGroup<string>[]>>,
  Assert<Equal<RaceCatalog, Readonly<Record<string, Race>>>>,
  Assert<Equal<TraitCatalog, Readonly<Record<string, Trait>>>>,
  Assert<Equal<TraitOrigin, "race" | "purchased" | "birthsign">>,
  Assert<Equal<AppliedTrait["origin"], TraitOrigin | undefined>>,
];

const modifier = {
  sourceId: "example",
  sourceText: "Example modifier",
  value: -5,
} satisfies Modifier;

const pcCharacteristic = {
  characteristicKey: PcCharacteristic.Lck,
  baseline: 20,
  rolled: 20,
  favored: false,
  modifiers: [modifier],
} satisfies PcCharacteristicData;

const npcCharacteristic = {
  characteristicKey: NpcCharacteristic.Mrl,
  base: 40,
  modifiers: [],
  score: 40,
} satisfies NpcCharacteristicData;

const skill = {
  skillKey: "alchemy",
  governingCharacteristics: [Characteristic.Int],
} satisfies Skill;

const profession = {
  skillKey: "profession",
  hasCustomName: true,
  chooseGoverningCharacteristic: true,
} satisfies Skill;

const trainedProfession = {
  skill: profession,
  skillRank: SkillRank.Novice,
  customName: "Smith",
  governingCharacteristic: Characteristic.Str,
} satisfies SkillTraining;

const enumObjectSkill: Skill = {
  skillKey: "alchemy",
  // @ts-expect-error Governing characteristics are keys, not enum objects.
  governingCharacteristics: [Characteristic],
};
// @ts-expect-error A selectable skill cannot also impose fixed characteristics.
const conflictingSkill: Skill = {
  skillKey: "profession",
  chooseGoverningCharacteristic: true,
  governingCharacteristics: [Characteristic.Str],
};

async function catalogChecks(catalog: ContentCatalog) {
  const race: Race | undefined = await catalog.get("race", "altmer");
  const skill: Skill | undefined = await catalog.get("skill", "alchemy");
  // @ts-expect-error The kind determines the returned definition.
  const wrongKind: Trait | undefined = await catalog.get("skill", "alchemy");
}

const training = {
  skill,
  skillRank: SkillRank.Novice,
} satisfies SkillTraining;

const character = new PcCharacterData() satisfies CharacterData;
const attributes: Attributes = character.attributes;
const standardSize: Attributes["size"] = { value: Size.Standard };

character.updateCharacteristic(PcCharacteristic.Str, { baseline: 30 });
character.updateCharacteristic(PcCharacteristic.Lck, {
  rolled: 20,
  favored: true,
  modifiers: [modifier],
});

character.updateCharacteristic(PcCharacteristic.Str, {
  // @ts-expect-error Characteristic updates cannot change the characteristic's identity.
  characteristicKey: PcCharacteristic.Lck,
});
// @ts-expect-error PCs cannot update NPC-specific Morale.
character.updateCharacteristic(NpcCharacteristic.Mrl, { baseline: 30 });
// @ts-expect-error Characteristic updates require numeric baselines.
character.updateCharacteristic(PcCharacteristic.Str, { baseline: "30" });

// @ts-expect-error Size values must be enum members, not numeric placeholders.
const numericSize: Attributes["size"] = { value: 0 };
// @ts-expect-error PCs use Luck, not NPC-specific Morale.
const pcMorale: PcCharacteristicData["characteristicKey"] =
  NpcCharacteristic.Mrl;
// @ts-expect-error NPCs use Morale, not PC-specific Luck.
const npcLuck: NpcCharacteristicData["characteristicKey"] =
  PcCharacteristic.Lck;
// @ts-expect-error Characteristic baselines must be numeric.
const textualBaseline: PcCharacteristicData["baseline"] = "40";
// @ts-expect-error Modifier values must be numeric.
const textualModifier: Modifier = { ...modifier, value: "5" };
// @ts-expect-error Skill training requires a rank.
const missingRank: SkillTraining = { skill };
