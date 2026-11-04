import { cloneElement, useRef, type ReactElement, type Ref } from "react";
import { Menu } from "@mantine/core";
import { useMergedRef } from "@mantine/hooks";

interface Props {
  /** Custom triggers must forward their ref and button props to the focusable element. */
  trigger: ReactElement<{ ref?: Ref<HTMLElement> }>;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
}

export function AssignmentMenu({ trigger, options, onSelect }: Props) {
  const triggerRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRef(trigger.props.ref, triggerRef);

  function returnFocus() {
    // A containing modal can reclaim focus while the dropdown exits.
    triggerRef.current?.focus();
  }

  return (
    <Menu
      position="bottom-start"
      width={280}
      withinPortal
      returnFocus
      onExitTransitionEnd={returnFocus}
      middlewares={{ flip: true, shift: { padding: 8, crossAxis: true } }}
      styles={{ item: { minHeight: 44 } }}
    >
      <Menu.Target>{cloneElement(trigger, { ref: mergedRef })}</Menu.Target>
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
