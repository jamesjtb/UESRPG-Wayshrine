import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Text, Tooltip, UnstyledButton } from "@mantine/core";
import type { CharacteristicRoll } from "@wayshrine/core";
import { rollBreakdown, rollTotal } from "./dice";
import classes from "./RollTile.module.css";

interface Props extends Omit<ComponentPropsWithoutRef<"button">, "children"> {
  roll: CharacteristicRoll;
  label: string;
  assignment?: string | undefined;
}

export const RollTile = forwardRef<HTMLButtonElement, Props>(function RollTile(
  { roll, label, assignment, className, ...buttonProps },
  ref,
) {
  const total = rollTotal(roll);
  let accessibleLabel = `${label}, total ${total}`;
  if (assignment) accessibleLabel += `, assigned ${assignment}`;

  return (
    <Tooltip
      label={rollBreakdown(roll)}
      events={{ hover: true, focus: true, touch: true }}
    >
      <UnstyledButton
        {...buttonProps}
        ref={ref}
        className={className ? `${classes.tile} ${className}` : classes.tile}
        aria-label={buttonProps["aria-label"] ?? accessibleLabel}
      >
        <Text component="span" className={classes.total}>
          {total}
        </Text>
        {assignment && (
          <Text component="span" size="xs" className={classes.assignment}>
            {assignment}
          </Text>
        )}
      </UnstyledButton>
    </Tooltip>
  );
});
