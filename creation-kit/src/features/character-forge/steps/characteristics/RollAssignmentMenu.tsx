import { useRef, useState, type KeyboardEvent } from "react";
import { Menu, Stack, UnstyledButton } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAssignments,
  CharacteristicRoll,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import { RollTile } from "./RollTile";
import { rollBreakdown, rollTotal } from "./dice";
import classes from "./RollAssignmentMenu.module.css";

interface Props {
  lockedAssignment?: "Luck";
  roll: CharacteristicRoll;
  ordinal: number;
  assignments: CharacteristicAssignments;
  selected: boolean;
  canSelectReroll: boolean;
  onToggleReroll: () => void;
  onAssign: (key: Characteristic) => void;
  onUnassign: () => void;
}

export function RollAssignmentMenu({
  lockedAssignment,
  roll,
  ordinal,
  assignments,
  selected,
  canSelectReroll,
  onToggleReroll,
  onAssign,
  onUnassign,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [opened, setOpened] = useState(false);
  const assigned = Object.values(Characteristic).find(
    (key) => assignments[key] === roll.id,
  );
  const available = Object.values(Characteristic).filter(
    (key) => assignments[key] === undefined,
  );
  const assignment =
    lockedAssignment ?? (assigned ? characteristicLabels[assigned] : undefined);
  const tileLabel = lockedAssignment ? "Luck roll" : `Roll ${ordinal}`;
  let label = `${tileLabel}, total ${rollTotal(roll)}`;
  if (assignment) label += `, assigned ${assignment}`;
  if (selected) label += ", selected for reroll";
  let action = assignment;
  if (selected) action = "Rerolling";

  function closeFromTrigger(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape" || !opened) return;
    event.preventDefault();
    event.stopPropagation();
    setOpened(false);
  }

  return (
    <Stack
      gap={0}
      className={classes.pair}
      role="group"
      aria-label={lockedAssignment ? "Luck result" : tileLabel}
      data-selected={selected || undefined}
    >
      <RollTile
        roll={roll}
        label={tileLabel}
        className={classes.total}
        aria-label={label}
        aria-description={rollBreakdown(roll)}
        data-roll-result={!lockedAssignment || undefined}
        data-selected={selected || undefined}
      />
      <Menu
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        width={280}
        withinPortal
        returnFocus
        onExitTransitionEnd={() => triggerRef.current?.focus()}
        middlewares={{ flip: true, shift: { padding: 8, crossAxis: true } }}
        styles={{ item: { minHeight: 44 } }}
      >
        <Menu.Target>
          <UnstyledButton
            ref={triggerRef}
            className={classes.action}
            aria-label={
              lockedAssignment
                ? "Actions for Luck"
                : `Actions for result: ${rollTotal(roll)}`
            }
            aria-description={label}
            data-mantine-stop-propagation={opened || undefined}
            onKeyDown={closeFromTrigger}
          >
            {action ?? <IconDots size={20} aria-hidden />}
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown
          style={{
            maxWidth: "calc(100vw - 1rem)",
            maxHeight: "calc(100dvh - 2rem)",
            overflowY: "auto",
          }}
        >
          <Menu.Item
            disabled={!selected && !canSelectReroll}
            onClick={onToggleReroll}
          >
            {selected ? "Don't reroll" : "Reroll"}
          </Menu.Item>
          {!lockedAssignment && (
            <>
              {assigned && <Menu.Item onClick={onUnassign}>Unassign</Menu.Item>}
              <Menu.Divider />
              <Menu.Label>Assign To</Menu.Label>
              {available.map((key) => (
                <Menu.Item key={key} onClick={() => onAssign(key)}>
                  {characteristicLabels[key]}
                </Menu.Item>
              ))}
            </>
          )}
        </Menu.Dropdown>
      </Menu>
    </Stack>
  );
}
