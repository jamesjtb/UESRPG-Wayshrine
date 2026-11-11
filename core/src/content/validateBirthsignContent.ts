import type {
  Birthsign,
  BirthsignBonus,
  BirthsignEffect,
} from "../../interface/character/Birthsign";
import type { Trait } from "../../interface/character/Trait";

/** Checks every branch, including choices not selected by any consumer. */
export function validateBirthsignContent(
  sign: Birthsign,
  traits: ReadonlyMap<string, Trait>,
  powerKeys: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  validateBonuses(sign.bonuses, traits, powerKeys, issues);
  validateBonuses(sign.starCursed.bonuses, traits, powerKeys, issues);
  return issues;
}

function validateBonuses(
  bonuses: readonly BirthsignBonus[],
  traits: ReadonlyMap<string, Trait>,
  powerKeys: ReadonlySet<string>,
  issues: string[],
) {
  for (const bonus of bonuses) {
    if (bonus.bonusType === "choice") {
      validateChoiceEffects(bonus, traits, powerKeys, issues);
    } else {
      validateEffects([bonus], traits, powerKeys, issues);
    }
  }
}

function validateChoiceEffects(
  bonus: Extract<BirthsignBonus, { bonusType: "choice" }>,
  traits: ReadonlyMap<string, Trait>,
  powerKeys: ReadonlySet<string>,
  issues: string[],
) {
  for (const option of bonus.choiceGroup.options)
    validateEffects(option.effects, traits, powerKeys, issues);
}

function validateEffects(
  effects: readonly BirthsignEffect[],
  traits: ReadonlyMap<string, Trait>,
  powerKeys: ReadonlySet<string>,
  issues: string[],
) {
  for (const effect of effects) {
    if (effect.bonusType === "power" && !powerKeys.has(effect.bonusTargetKey))
      issues.push(`Unknown birthsign power: ${effect.bonusTargetKey}.`);
    if (effect.bonusType === "trait") validateTrait(effect, traits, issues);
  }
}

function validateTrait(
  effect: Extract<BirthsignEffect, { bonusType: "trait" }>,
  traits: ReadonlyMap<string, Trait>,
  issues: string[],
) {
  const trait = traits.get(effect.bonusTargetKey);
  if (!trait) {
    issues.push(`Unknown birthsign trait: ${effect.bonusTargetKey}.`);
    return;
  }
  const required = trait.params ?? [];
  const supplied = Object.keys(effect.bonusParams ?? {});
  if (
    required.some((name) => !supplied.includes(name)) ||
    supplied.some((name) => !required.includes(name))
  )
    issues.push(
      `Incorrect parameters for birthsign trait: ${effect.bonusTargetKey}.`,
    );
}
