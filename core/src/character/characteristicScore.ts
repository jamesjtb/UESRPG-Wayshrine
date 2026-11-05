import type {
  PcCharacteristicData,
  CharacteristicScore,
} from "../../interface/character/Characteristic";

/** Creation score only: favored flags and modifiers do not change this result. */
export function calculateCharacteristicScore(
  characteristic: Pick<PcCharacteristicData, "baseline" | "rolled">,
): CharacteristicScore {
  const total = characteristic.baseline + characteristic.rolled;
  return { total, bonus: Math.floor(total / 10) % 10 };
}
