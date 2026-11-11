import type { BirthsignChargeTable } from "../../interface/character/Birthsign";

/** The fifth face is an instruction, never a thirteenth sign. No rolls are resolved here. */
export const BIRTHSIGN_CHARGE_TABLES: readonly BirthsignChargeTable[] = [
  {
    guardian: "warrior",
    entries: ["theWarrior", "theLady", "theSteed", "theLord"],
    fifthResult: "rerollStarCursed",
  },
  {
    guardian: "mage",
    entries: ["theMage", "theApprentice", "theAtronach", "theRitual"],
    fifthResult: "rerollStarCursed",
  },
  {
    guardian: "thief",
    entries: ["theThief", "theLover", "theShadow", "theTower"],
    fifthResult: "rerollStarCursed",
  },
];

export function validateBirthsignChargeTables(
  signKeys: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  for (const table of BIRTHSIGN_CHARGE_TABLES) {
    for (const key of table.entries) {
      if (!signKeys.has(key))
        issues.push(
          `Unknown birthsign in ${table.guardian} charge table: ${key}.`,
        );
    }
  }
  return issues;
}
