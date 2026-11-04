import type { CharacteristicRoll } from "@wayshrine/core";

export type CharacteristicRoller = () => CharacteristicRoll;

/** Browser acquisition only. Core validates and applies the submitted faces. */
export function createCharacteristicRoller(
  random: () => number = Math.random,
): CharacteristicRoller {
  let sequence = 0;
  return function roll2d10() {
    sequence += 1;
    return {
      id: `roll-${sequence}`,
      dice: [Math.floor(random() * 10) + 1, Math.floor(random() * 10) + 1],
    };
  };
}

export const rollCharacteristicDice = createCharacteristicRoller();

export function rollTotal(roll: CharacteristicRoll): number {
  return roll.dice.reduce((sum, face) => sum + face, 0);
}

export function rollBreakdown(roll: CharacteristicRoll): string {
  return `2d10: ${roll.dice.join(" + ")} = ${rollTotal(roll)}`;
}
