import { useId, useState } from "react";
import type { ClipboardEvent } from "react";
import { ActionIcon, Box, Input, NumberInput, Stack } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import type {
  Characteristic,
  CharacteristicGenerationIssue,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import { GenerationIssues } from "./GenerationIssues";
import classes from "./PointBuyCharacteristics.module.css";

interface Props {
  characteristic: Characteristic;
  value: number | undefined;
  remaining: number;
  issues: readonly CharacteristicGenerationIssue[];
  onChange: (value: number | undefined) => void;
}

export function AllocationCard({
  characteristic,
  value,
  remaining,
  issues,
  onChange,
}: Props) {
  const label = characteristicLabels[characteristic];
  const inputId = useId();
  // Keep lexical edits such as "1." while Core owns the numeric answer.
  const [edit, setEdit] = useState<{
    value: number | undefined;
    input: number | string;
  }>({ value, input: value ?? "" });
  let input = edit.input;
  if (!Object.is(edit.value, value)) {
    input = value ?? "";
    setEdit({ value, input });
  }

  const amount = value ?? 0;
  const canStep = Number.isInteger(amount) && amount >= 0 && amount <= 20;
  const canDecrease = canStep && amount > 0;
  const canIncrease =
    canStep && amount < 20 && Number.isFinite(remaining) && remaining >= 1;

  function changeInput(input: number | string) {
    const value = input === "" ? undefined : Number(input);
    if (value !== undefined && value < 0) {
      setEdit({ value: 0, input: 0 });
      onChange(0);
      return;
    }
    setEdit({ value, input });
    onChange(value);
  }

  function preventNegativePaste(event: ClipboardEvent<HTMLInputElement>) {
    // Normalize before the formatter can strip the minus and make the paste positive.
    const pasted = Number(event.clipboardData.getData("text/plain"));
    if (Number.isNaN(pasted) || pasted >= 0) return;
    event.preventDefault();
    event.stopPropagation();
    changeInput(0);
  }

  function decrease() {
    if (canDecrease) changeInput(amount - 1);
  }

  function increase() {
    if (canIncrease) changeInput(amount + 1);
  }

  return (
    <Stack
      gap={2}
      className={classes.card}
      role="group"
      aria-label={`${label} allocation`}
    >
      <Input.Label htmlFor={inputId} className={classes.label}>
        {label}
      </Input.Label>
      <Box className={classes.controls}>
        <ActionIcon
          size={32}
          variant="transparent"
          className={classes.stepper}
          aria-label={`Decrease ${label} points`}
          disabled={!canDecrease}
          onClick={decrease}
        >
          <IconMinus size={16} aria-hidden="true" />
        </ActionIcon>
        <NumberInput
          id={inputId}
          aria-label={`${label} points`}
          value={input}
          onChange={changeInput}
          onPasteCapture={preventNegativePaste}
          clampBehavior="none"
          allowNegative={false}
          withKeyboardEvents={false}
          hideControls
          variant="unstyled"
          className={classes.input}
          classNames={{ input: classes.value }}
        />
        <ActionIcon
          size={32}
          variant="transparent"
          className={classes.stepper}
          aria-label={`Increase ${label} points`}
          disabled={!canIncrease}
          onClick={increase}
        >
          <IconPlus size={16} aria-hidden="true" />
        </ActionIcon>
      </Box>
      <GenerationIssues
        issues={issues}
        field="allocations"
        characteristic={characteristic}
      />
    </Stack>
  );
}
