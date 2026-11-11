import type {
  PcCharacteristicData,
  CharacteristicScore,
} from "../../interface/character/Characteristic";

/** Explicit modifiers and purchase deductions apply; favored flags are not numeric. */
export function calculateCharacteristicScore(
  characteristic: Pick<PcCharacteristicData, "baseline" | "rolled"> &
    Partial<Pick<PcCharacteristicData, "modifiers" | "purchaseCost">>,
): CharacteristicScore {
  let total = characteristic.baseline + characteristic.rolled;
  for (const modifier of characteristic.modifiers ?? [])
    total += modifier.value;
  total -= characteristic.purchaseCost?.value ?? 0;
  return { total, bonus: Math.floor(total / 10) % 10 };
}
