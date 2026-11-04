import type { ReactNode } from "react";
import { Checkbox, Stack } from "@mantine/core";

interface Props {
  label: ReactNode;
  description?: ReactNode;
  options: readonly string[];
  optionLabels: Readonly<Record<string, string>>;
  selections: readonly string[];
  limit: number;
  disabled: boolean;
  onChange: (selections: readonly string[]) => void;
}

export function LimitedCheckboxGroup({
  label,
  description,
  options,
  optionLabels,
  selections,
  limit,
  disabled,
  onChange,
}: Props) {
  const limitReached = selections.length >= limit;

  return (
    <Checkbox.Group
      label={label}
      description={description}
      value={[...selections]}
      onChange={onChange}
    >
      <Stack gap="xs" mt="xs">
        {options.map((key) => (
          <Checkbox
            key={key}
            value={key}
            disabled={disabled || (limitReached && !selections.includes(key))}
            label={optionLabels[key]}
          />
        ))}
      </Stack>
    </Checkbox.Group>
  );
}
