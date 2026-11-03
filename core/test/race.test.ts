import type {
  BaselineCharacteristics,
  Race,
  RaceCatalog,
  RacialBonus,
} from "../interface/character/Race";

const baselineCharacteristics = {
  str: 20,
  end: 23,
  ag: 23,
  int: 30,
  wp: 28,
  prc: 25,
  prs: 25,
} satisfies BaselineCharacteristics;

const altmer = {
  label: "{LOCALE.races.altmer.label}",
  description: "{LOCALE.races.altmer.description}",
  baselineCharacteristics,
  racialTraits: [
    { traitKey: "diseaseResistance", params: { X: 50 } },
    { traitKey: "weakness", params: { type: "magic", X: 2 } },
    { traitKey: "mentalStrength" },
  ],
  racialBonuses: [
    {
      bonusType: "skill",
      choiceGroups: [{ id: "a", choose: 1, options: ["alchemy"] }],
    },
  ],
} satisfies Race;

const argonian = {
  label: "{LOCALE.races.argonian.label}",
  description: "{LOCALE.races.argonian.description}",
  baselineCharacteristics,
  racialTraits: [{ traitKey: "amphibious" }],
} satisfies Race;

const races = { altmer, argonian } satisfies RaceCatalog;

const { prc, ...withoutPerception } = baselineCharacteristics;
// @ts-expect-error Race baselines require all seven shared characteristics.
const incompleteBaseline: BaselineCharacteristics = withoutPerception;
// @ts-expect-error Only skill bonuses are currently supported by the content.
const unsupportedBonus: RacialBonus = { bonusType: "talent", choiceGroups: [] };
const pcBaseline: BaselineCharacteristics = {
  ...baselineCharacteristics,
  // @ts-expect-error Race baselines exclude PC-specific Luck.
  lck: 25,
};
