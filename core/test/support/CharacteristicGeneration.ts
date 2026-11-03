import { CharacterCreator } from "../../src/index";
import type { ContentCatalog } from "../../src/index";

/** Race-focused tests supply valid generation so finish still exercises race guards. */
export function createRaceTestCreator(
  catalog: ContentCatalog,
): CharacterCreator {
  const creator = new CharacterCreator(catalog);
  completeGeneration(creator);
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
