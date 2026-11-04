import type { ReactElement } from "react";
import { Menu } from "@mantine/core";

interface Props {
  /** Custom triggers must forward their ref and button props to the focusable element. */
  trigger: ReactElement;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
}

export function AssignmentMenu({ trigger, options, onSelect }: Props) {
  return (
    <Menu
      position="bottom-start"
      width={280}
      withinPortal
      returnFocus
      middlewares={{ flip: true, shift: { padding: 8, crossAxis: true } }}
      styles={{ item: { minHeight: 44 } }}
    >
      <Menu.Target>{trigger}</Menu.Target>
      <Menu.Dropdown
        style={{
          maxWidth: "calc(100vw - 1rem)",
          maxHeight: "calc(100dvh - 2rem)",
          overflowY: "auto",
        }}
      >
        {options.map((option) => (
          <Menu.Item key={option.value} onClick={() => onSelect(option.value)}>
            {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
