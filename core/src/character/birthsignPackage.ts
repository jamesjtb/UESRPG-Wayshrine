import type {
  BirthsignChoice,
  BirthsignChoiceOption,
  BirthsignEffect,
} from "../../interface/character/Birthsign";
import type {
  BirthsignChoiceState,
  BirthsignPackageInput,
  BirthsignPackageResult,
  EffectiveBirthsignPackage,
  SourcedBirthsignBonus,
  SourcedBirthsignEffect,
} from "../../interface/character/BirthsignPackage";
import type { ChoiceIssue } from "../../interface/common/Choice";
import { validateChoice } from "../wizards/validateChoice";

export function activeBirthsignBonuses(
  input: BirthsignPackageInput,
): SourcedBirthsignBonus[] {
  const root = `birthsign/${encodeURIComponent(input.selection.signKey)}`;
  const entries: SourcedBirthsignBonus[] = [];
  const star = input.selection.variant === "starCursed";
  if (!star || !input.definition.starCursed.overwriteBaseBonuses) {
    input.definition.bonuses.forEach((bonus, index) =>
      entries.push({ bonus, sourceId: `${root}/base/${index}` }),
    );
  }
  if (star) {
    input.definition.starCursed.bonuses.forEach((bonus, index) =>
      entries.push({ bonus, sourceId: `${root}/starCursed/${index}` }),
    );
  }
  return entries;
}

function choiceId(
  input: BirthsignPackageInput,
  choice: BirthsignChoice,
): string {
  return `${encodeURIComponent(input.selection.signKey)}/${encodeURIComponent(choice.choiceGroup.id)}`;
}

function copyOption(option: BirthsignChoiceOption): BirthsignChoiceOption {
  return { ...option, effects: option.effects.map(copyEffect) };
}

export function getBirthsignChoices(
  input: BirthsignPackageInput,
): BirthsignChoiceState[] {
  const choices: BirthsignChoiceState[] = [];
  for (const { bonus } of activeBirthsignBonuses(input)) {
    if (bonus.bonusType !== "choice") continue;
    const id = choiceId(input, bonus);
    choices.push({
      ...bonus,
      lifecycle: { ...bonus.lifecycle },
      choiceGroup: {
        ...bonus.choiceGroup,
        id,
        options: bonus.choiceGroup.options.map(copyOption),
      },
      selections: [
        ...(input.answers.find((answer) => answer.choiceId === id)
          ?.selections ?? []),
      ],
    });
  }
  return choices;
}

function copyEffect(effect: BirthsignEffect): BirthsignEffect {
  if (effect.bonusType === "trait" && effect.bonusParams)
    return { ...effect, bonusParams: { ...effect.bonusParams } };
  return { ...effect };
}

export function validateBirthsignChoices(
  input: BirthsignPackageInput,
): ChoiceIssue[] {
  const issues: ChoiceIssue[] = [];
  for (const choice of getBirthsignChoices(input)) {
    if (choice.lifecycle.selection !== "once") continue;
    const group = {
      ...choice.choiceGroup,
      options: choice.choiceGroup.options.map((option) => option.id),
    };
    issues.push(
      ...validateChoice(group, {
        choiceId: group.id,
        selections: choice.selections,
      }),
    );
  }
  return issues;
}

/** Strict and pure: unresolved once choices prevent the entire package. */
export function calculateBirthsignPackage(
  input: BirthsignPackageInput,
): BirthsignPackageResult {
  const issues = validateBirthsignChoices(input);
  if (issues.length) return { ok: false, issues };
  const value: EffectiveBirthsignPackage = {
    characteristicModifiers: {},
    rolledReplacements: {},
    traits: [],
    powers: [],
    spMaximum: [],
    speed: [],
    naturalHealingMultiplier: 1,
    extraLuckyNumbers: [],
  };
  for (const { bonus, sourceId } of activeBirthsignBonuses(input)) {
    if (bonus.bonusType !== "choice") {
      applyEffect(value, bonus, sourceId, input.definition.label);
      continue;
    }
    if (bonus.lifecycle.selection !== "once") continue;
    for (const resolved of resolveChoice(input, bonus, sourceId))
      applyEffect(
        value,
        resolved.effect,
        resolved.sourceId,
        input.definition.label,
      );
  }
  return { ok: true, value };
}

function resolveChoice(
  input: BirthsignPackageInput,
  choice: BirthsignChoice,
  sourceId: string,
): SourcedBirthsignEffect[] {
  const id = choiceId(input, choice);
  const selected =
    input.answers.find((answer) => answer.choiceId === id)?.selections ?? [];
  const effects: SourcedBirthsignEffect[] = [];
  for (const option of choice.choiceGroup.options) {
    if (!selected.includes(option.id)) continue;
    option.effects.forEach((effect, index) =>
      effects.push({
        effect,
        sourceId: `${sourceId}/${encodeURIComponent(option.id)}/${index}`,
      }),
    );
  }
  return effects;
}

function applyEffect(
  value: EffectiveBirthsignPackage,
  effect: BirthsignEffect,
  sourceId: string,
  sourceText: string,
): void {
  switch (effect.bonusType) {
    case "characteristic": {
      const modifiers =
        value.characteristicModifiers[effect.bonusTargetKey] ?? [];
      modifiers.push({ sourceId, sourceText, value: effect.bonusValue });
      value.characteristicModifiers[effect.bonusTargetKey] = modifiers;
      break;
    }
    case "replaceRolledCharacteristic":
      value.rolledReplacements[effect.bonusTargetKey] = effect.bonusValue;
      break;
    case "attribute":
      value[effect.bonusTargetKey].push({
        sourceId,
        sourceText,
        value: effect.bonusValue,
      });
      break;
    case "multiplier":
      value.naturalHealingMultiplier *= effect.bonusValue;
      break;
    case "trait":
      value.traits.push({
        traitKey: effect.bonusTargetKey,
        ...(effect.bonusParams ? { params: { ...effect.bonusParams } } : {}),
        origin: "birthsign",
        sourceId,
      });
      break;
    case "power":
      value.powers.push({
        powerKey: effect.bonusTargetKey,
        origin: "birthsign",
        sourceId,
      });
      break;
    case "extraLuckyNumber":
      value.extraLuckyNumbers.push({
        count: effect.count,
        retainedRegardlessOfLuck: true,
        sourceId,
      });
      break;
  }
}
