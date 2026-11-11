import { CharacterCreator, parseContentDefinition } from "../../src/index";
import type { ContentCatalog } from "../../src/index";

/** Race-focused tests supply valid generation so finish still exercises race guards. */
export async function createRaceTestCreator(
  catalog: ContentCatalog,
): Promise<CharacterCreator> {
  // Isolate race transport assertions from the unrelated, completed birthsign step.
  const creator = new CharacterCreator({
    version: catalog.version,
    list: (kind) => catalog.list(kind),
    get: (kind, key) =>
      kind === "birthsign"
        ? Promise.resolve(
            parseContentDefinition(kind, key, {
              label: "Test sign",
              description: "Test sign",
              bonuses: [],
              starCursed: { overwriteBaseBonuses: false, bonuses: [] },
            }),
          )
        : catalog.get(kind, key),
  });
  completeGeneration(creator);
  await creator.submitBirthsignRoll({
    id: "test-sign",
    charge: "warrior",
    dice: [1],
  });
  return creator;
}

export function completeGeneration(creator: CharacterCreator): void {
  creator.setFavoredCharacteristics(["str", "int"]);
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({
    str: 20,
    end: 20,
    ag: 20,
    int: 10,
    wp: 10,
    prc: 0,
    prs: 0,
  });
  creator.submitLuckRoll({ id: "luck", dice: [5, 5] });
}
