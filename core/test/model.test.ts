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
  RacialBonusChoice,
  Skill,
  SkillTraining,
  Trait,
  TraitCatalog,
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
  Assert<Equal<PcCharacteristicData["modifiers"], Modifier[]>>,
  Assert<Equal<Race["baselineCharacteristics"], BaselineCharacteristics>>,
  Assert<Equal<BaselineCharacteristics, Readonly<Record<Characteristic, number>>>>,
  Assert<Equal<Race["racialTraits"], readonly AppliedTrait[]>>,
  Assert<Equal<Race["racialBonuses"], readonly RacialBonus[] | undefined>>,
  Assert<Equal<RacialBonus["choices"], readonly RacialBonusChoice[]>>,
  Assert<Equal<RaceCatalog, Readonly<Record<string, Race>>>>,
  Assert<Equal<TraitCatalog, Readonly<Record<string, Trait>>>>,
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
  governingCharacteristics: [],
} satisfies Skill;

const training = {
  skill,
  skillRank: SkillRank.Novice,
} satisfies SkillTraining;

const character = new PcCharacterData() satisfies CharacterData;
const attributes: Attributes = character.attributes;
const standardSize: Attributes["size"] = { value: Size.Standard };

// @ts-expect-error Size values must be enum members, not numeric placeholders.
const numericSize: Attributes["size"] = { value: 0 };
// @ts-expect-error PCs use Luck, not NPC-specific Morale.
const pcMorale: PcCharacteristicData["characteristicKey"] = NpcCharacteristic.Mrl;
// @ts-expect-error NPCs use Morale, not PC-specific Luck.
const npcLuck: NpcCharacteristicData["characteristicKey"] = PcCharacteristic.Lck;
// @ts-expect-error Characteristic baselines must be numeric.
const textualBaseline: PcCharacteristicData["baseline"] = "40";
// @ts-expect-error Modifier values must be numeric.
const textualModifier: Modifier = { ...modifier, value: "5" };
// @ts-expect-error Skill training requires a rank.
const missingRank: SkillTraining = { skill };
