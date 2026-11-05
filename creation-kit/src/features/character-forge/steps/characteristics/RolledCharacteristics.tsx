import { useEffect, useRef, useState } from "react";
import { Box, Button, Stack, Text } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicGenerationDrafts,
  CharacteristicGenerationIssue,
  CharacteristicGenerationCommandResult,
  CharacteristicRerollSnapshot,
  CharacteristicRoll,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import { RerollTile } from "./RerollTile";
import type { CharacteristicRoller } from "./dice";
import { characteristicLabels } from "./characteristicLabels";
import classes from "./RolledCharacteristics.module.css";

interface Props {
  draft: CharacteristicGenerationDrafts["rolled"];
  issues: readonly CharacteristicGenerationIssue[];
  rollDice: CharacteristicRoller;
  onDiceAcquisitionError: (error: unknown) => void;
  submitCharacteristicRolls: (rolls: readonly CharacteristicRoll[]) => void;
  rerolls: CharacteristicRerollSnapshot;
  rerollCharacteristics: (
    ids: readonly string[],
    rollDice: CharacteristicRoller,
  ) => CharacteristicGenerationCommandResult | undefined;
}

function isVisibleRoll(draft: Props["draft"], id: string) {
  return (
    draft.rolls.some((roll) => roll.id === id) &&
    !Object.values(draft.assignments).includes(id)
  );
}

export function RolledCharacteristics({
  draft,
  issues,
  rollDice,
  onDiceAcquisitionError,
  submitCharacteristicRolls,
  rerolls,
  rerollCharacteristics,
}: Props) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [commandIssues, setCommandIssues] = useState<
    readonly CharacteristicGenerationIssue[]
  >([]);
  const poolRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (pendingFocus.current === undefined) return;
    poolRef.current
      ?.querySelector<HTMLButtonElement>(
        `[aria-label="Roll ${pendingFocus.current + 1}"] [data-roll-result]`,
      )
      ?.focus();
    pendingFocus.current = undefined;
  }, [draft.rolls]);
  useEffect(() => {
    setSelected((current) => {
      const visible = current.filter((id) => isVisibleRoll(draft, id));
      return visible.length === current.length ? current : visible;
    });
  }, [draft.rolls, draft.assignments]);
  const limit = rerolls.maxBatchSize;
  const canReroll = rerolls.available;
  const selection = selected.filter((id) => isVisibleRoll(draft, id));
  let rerollLabel = `Reroll (${selection.length} of 3)`;
  if (rerolls.batchSpent) rerollLabel = "Reroll Used";
  if (rerolls.unlimited) rerollLabel = "Reroll";

  function selectRoll(id: string, checked: boolean) {
    setCommandIssues([]);
    if (!checked) {
      setSelected(selection.filter((value) => value !== id));
    } else if (canReroll && selection.length < limit) {
      setSelected([...selection, id]);
    }
  }

  function rerollSelected() {
    pendingFocus.current = draft.rolls.findIndex((roll) =>
      selection.includes(roll.id),
    );
    const result = rerollCharacteristics(selection, rollDice);
    if (result?.ok) {
      setSelected([]);
      setCommandIssues([]);
    } else {
      pendingFocus.current = undefined;
      if (result) setCommandIssues(result.issues);
    }
  }
  const rollIssues = issues.filter(
    (issue) =>
      issue.field === "rolls" &&
      (draft.rolls.length > 0 || issue.code !== "roll-count"),
  );
  const assignmentIssues = issues.filter(
    (issue) =>
      issue.field === "assignments" && issue.code !== "invalid-assignment",
  );

  function rollPool() {
    try {
      const rolls: CharacteristicRoll[] = [];
      for (let index = 0; index < 7; index += 1) rolls.push(rollDice());
      pendingFocus.current = 0;
      submitCharacteristicRolls(rolls);
    } catch (error) {
      pendingFocus.current = undefined;
      onDiceAcquisitionError(error);
    }
  }

  return (
    <Stack
      className={classes.container}
      gap="sm"
      role="group"
      aria-label="Rolled characteristics"
    >
      {!rerolls.initialized && (
        <Button size="sm" fullWidth onClick={rollPool}>
          Make Characteristic Roll
        </Button>
      )}
      {rerolls.initialized && (
        <Button
          size="sm"
          onClick={rerollSelected}
          disabled={
            !canReroll || selection.length === 0 || selection.length > limit
          }
        >
          {rerollLabel}
        </Button>
      )}
      <GenerationIssues issues={rollIssues} field="rolls" />
      <Box
        ref={poolRef}
        key={JSON.stringify(draft.rolls)}
        className={classes.row}
        role="group"
        aria-label="Characteristic rolls"
      >
        {draft.rolls.map((roll, index) => {
          if (Object.values(draft.assignments).includes(roll.id)) return null;
          return (
            <Stack gap={4} className={classes.result} key={roll.id}>
              <RerollTile
                roll={roll}
                ordinal={index + 1}
                selected={selection.includes(roll.id)}
                canSelect={canReroll && selection.length < limit}
                onToggle={() =>
                  selectRoll(roll.id, !selection.includes(roll.id))
                }
              />
              <GenerationIssues
                issues={rollIssues}
                field="rolls"
                rollId={roll.id}
              />
            </Stack>
          );
        })}
      </Box>
      {commandIssues.length > 0 && (
        <Stack gap="xs">
          {commandIssues.map((issue, index) => (
            <Text size="sm" role="status" key={index}>
              {issue.message}
            </Text>
          ))}
        </Stack>
      )}
      {assignmentIssues.length > 0 && (
        <Stack gap={4} role="group" aria-label="Roll assignment validation">
          <GenerationIssues issues={assignmentIssues} field="assignments" />
          {Object.values(Characteristic).map((key) => (
            <GenerationIssues
              key={key}
              issues={assignmentIssues}
              field="assignments"
              characteristic={key}
              targetLabel={characteristicLabels[key]}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
