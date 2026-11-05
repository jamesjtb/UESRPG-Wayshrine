import { Box } from "@mantine/core";
import type { CharacteristicRoll } from "@wayshrine/core";
import { RollTile } from "./RollTile";
import { rollBreakdown, rollTotal } from "./dice";
import classes from "./RerollTile.module.css";

interface Props {
  roll: CharacteristicRoll;
  ordinal: number;
  selected: boolean;
  canSelect: boolean;
  onToggle: () => void;
}

export function RerollTile({
  roll,
  ordinal,
  selected,
  canSelect,
  onToggle,
}: Props) {
  const label = `Roll ${ordinal}`;
  const selection = selected
    ? "Selected for reroll"
    : "Not selected for reroll";
  const unavailable = !selected && !canSelect;
  return (
    <Box role="group" aria-label={label} data-selected={selected || undefined}>
      <RollTile
        roll={roll}
        label={label}
        aria-label={`${label}, total ${rollTotal(roll)}`}
        aria-description={`${rollBreakdown(roll)}. ${selection}.`}
        aria-pressed={selected}
        aria-disabled={unavailable}
        data-disabled={unavailable || undefined}
        onClick={() => {
          if (!unavailable) onToggle();
        }}
        assignment={selected ? "Rerolling" : undefined}
        className={classes.tile}
        data-roll-result
        data-selected={selected || undefined}
      />
    </Box>
  );
}
