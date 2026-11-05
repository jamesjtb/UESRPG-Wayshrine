import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Menu, UnstyledButton } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAssignments,
  CharacteristicRoll,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import { rollTotal } from "./dice";
import classes from "./CharacteristicDraftPreview.module.css";
import { ContributionMenuValue } from "./ContributionMenuValue";

interface Props {
  characteristic: Characteristic;
  value: ReactNode;
  rolls: readonly CharacteristicRoll[];
  assignments: CharacteristicAssignments;
  initialized: boolean;
  setCharacteristicAssignments: (
    assignments: CharacteristicAssignments,
  ) => void;
}

function resultLabel(
  roll: CharacteristicRoll,
  index: number,
  assignments: CharacteristicAssignments,
) {
  const assigned = Object.values(Characteristic).find(
    (key) => assignments[key] === roll.id,
  );
  const destination = assigned ? characteristicLabels[assigned] : "Unassigned";
  return `Result ${index + 1}: ${rollTotal(roll)} (${roll.dice.join(" + ")}) — ${destination}`;
}

export function RolledContributionMenu({
  characteristic,
  value,
  rolls,
  assignments,
  initialized,
  setCharacteristicAssignments,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const current = assignments[characteristic];
  const occupied = current !== undefined;
  const assignedIds = Object.values(assignments);
  const currentIndex = rolls.findIndex((roll) => roll.id === current);
  let description = "Choose a result";
  if (occupied) description = "Assigned result. Unassign before replacing.";
  if (currentIndex !== -1)
    description = `${resultLabel(rolls[currentIndex]!, currentIndex, assignments)}. Unassign before replacing.`;

  function assignResult(rollId: string) {
    if (
      occupied ||
      !initialized ||
      assignedIds.includes(rollId) ||
      !rolls.some((roll) => roll.id === rollId)
    )
      return;
    const next = { ...assignments };
    next[characteristic] = rollId;
    setCharacteristicAssignments(next);
  }

  function unassign() {
    const next = { ...assignments };
    delete next[characteristic];
    setCharacteristicAssignments(next);
  }

  function closeFromTrigger(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Escape" || !opened) return;
    event.preventDefault();
    event.stopPropagation();
    setOpened(false);
  }

  function restoreTriggerFocus() {
    const menus = document.querySelectorAll('[role="menu"]');
    if ([...menus].some((menu) => menu !== dropdownRef.current)) return;
    triggerRef.current?.focus();
  }

  return (
    <Menu
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={320}
      withinPortal
      returnFocus
      onExitTransitionEnd={restoreTriggerFocus}
      middlewares={{ flip: true, shift: { padding: 8, crossAxis: true } }}
      styles={{ item: { minHeight: 44, whiteSpace: "normal" } }}
    >
      <Menu.Target>
        <UnstyledButton
          ref={triggerRef}
          className={classes.contribution}
          aria-label={`Rolled result for ${characteristicLabels[characteristic]}`}
          aria-description={description}
          data-mantine-stop-propagation={opened || undefined}
          onKeyDown={closeFromTrigger}
        >
          <ContributionMenuValue value={value} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown
        ref={dropdownRef}
        style={{
          maxWidth: "calc(100vw - 1rem)",
          maxHeight: "calc(100dvh - 2rem)",
          overflowY: "auto",
        }}
      >
        {occupied && <Menu.Item onClick={unassign}>Unassign</Menu.Item>}
        {!occupied && !initialized && (
          <Menu.Label>Make characteristic roll first</Menu.Label>
        )}
        {!occupied &&
          initialized &&
          rolls.map((roll, index) => {
            if (assignedIds.includes(roll.id)) return null;
            return (
              <Menu.Item
                key={roll.id}
                aria-label={resultLabel(roll, index, assignments)}
                onClick={() => assignResult(roll.id)}
              >
                ({roll.dice.join(" + ")}) {rollTotal(roll)}
              </Menu.Item>
            );
          })}
      </Menu.Dropdown>
    </Menu>
  );
}
