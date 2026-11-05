import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Menu, UnstyledButton } from "@mantine/core";
import type { CharacteristicRoll } from "@wayshrine/core";
import { rollBreakdown } from "./dice";
import classes from "./CharacteristicDraftPreview.module.css";
import { ContributionMenuValue } from "./ContributionMenuValue";

export function LuckContributionMenu({
  value,
  roll,
  onReroll,
}: {
  value: ReactNode;
  roll: CharacteristicRoll;
  onReroll: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);

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
      withinPortal
      returnFocus
      position="bottom-start"
      width={200}
      onExitTransitionEnd={restoreTriggerFocus}
      middlewares={{ flip: true, shift: { padding: 8, crossAxis: true } }}
      styles={{ item: { minHeight: 44 } }}
    >
      <Menu.Target>
        <UnstyledButton
          ref={triggerRef}
          className={classes.contribution}
          aria-label="Rolled result for Luck"
          aria-description={rollBreakdown(roll)}
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
        <Menu.Item onClick={onReroll}>Reroll</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
