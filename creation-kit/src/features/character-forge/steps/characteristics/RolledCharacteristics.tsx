import { useEffect, useRef, useState } from "react";
import { Button, Group, Stack } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAssignments,
  CharacteristicGenerationDrafts,
  CharacteristicGenerationIssue,
  CharacteristicRoll,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import { RollAssignmentMenu } from "./RollAssignmentMenu";
import type { CharacteristicRoller } from "./dice";
import { characteristicLabels } from "./characteristicLabels";

interface Props {
  draft: CharacteristicGenerationDrafts["rolled"];
  issues: readonly CharacteristicGenerationIssue[];
  rollDice: CharacteristicRoller;
  submitCharacteristicRolls: (rolls: readonly CharacteristicRoll[]) => void;
  unlimitedRerolls: boolean;
  rerollBatchSpent: boolean;
  rerollCharacteristics: (
    ids: readonly string[],
    rollDice: CharacteristicRoller,
  ) => boolean;
  setCharacteristicAssignments: (
    assignments: CharacteristicAssignments,
  ) => void;
}

function withoutRoll(assignments: CharacteristicAssignments, rollId: string) {
  const next = { ...assignments };
  for (const key of Object.values(Characteristic)) {
    if (next[key] === rollId) delete next[key];
  }
  return next;
}

export function RolledCharacteristics({
  draft,
  issues,
  rollDice,
  submitCharacteristicRolls,
  unlimitedRerolls,
  rerollBatchSpent,
  rerollCharacteristics,
  setCharacteristicAssignments,
}: Props) {
  const [selected, setSelected] = useState<readonly string[]>([]);
  const poolRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (pendingFocus.current === undefined || draft.rolls.length === 0) return;
    poolRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-roll-result]")
      [pendingFocus.current]?.focus();
    pendingFocus.current = undefined;
  }, [draft.rolls]);
  const limit = unlimitedRerolls ? 7 : 3;
  const canReroll = unlimitedRerolls || !rerollBatchSpent;
  const selection = selected.filter((id) =>
    draft.rolls.some((roll) => roll.id === id),
  );
  let rerollLabel = `Reroll (${selection.length} of 3)`;
  if (!canReroll) rerollLabel = "Reroll Expended";
  if (unlimitedRerolls) rerollLabel = "Reroll";

  function selectRoll(id: string, checked: boolean) {
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
    if (rerollCharacteristics(selection, rollDice)) {
      setSelected([]);
    } else {
      pendingFocus.current = undefined;
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
    const rolls: CharacteristicRoll[] = [];
    for (let index = 0; index < 7; index += 1) rolls.push(rollDice());
    pendingFocus.current = 0;
    submitCharacteristicRolls(rolls);
  }

  function assignRoll(rollId: string, key: Characteristic) {
    if (!draft.rolls.some((roll) => roll.id === rollId)) return;
    const assignments = withoutRoll(draft.assignments, rollId);
    assignments[key] = rollId;
    setCharacteristicAssignments(assignments);
  }

  function unassignRoll(rollId: string) {
    setCharacteristicAssignments(withoutRoll(draft.assignments, rollId));
  }

  return (
    <Stack gap="sm" role="group" aria-label="Rolled characteristics">
      {draft.rolls.length === 0 && (
        <Group align="center" gap="sm">
          <Button size="sm" onClick={rollPool}>
            Roll
          </Button>
        </Group>
      )}
      <GenerationIssues issues={rollIssues} field="rolls" />
      <Group
        ref={poolRef}
        key={JSON.stringify(draft.rolls)}
        gap="xs"
        align="flex-start"
        role="group"
        aria-label="Characteristic rolls"
      >
        {draft.rolls.map((roll, index) => (
          <Stack gap="xs" key={roll.id}>
            <RollAssignmentMenu
              roll={roll}
              ordinal={index + 1}
              assignments={draft.assignments}
              selected={selection.includes(roll.id)}
              canSelectReroll={canReroll && selection.length < limit}
              onToggleReroll={() =>
                selectRoll(roll.id, !selection.includes(roll.id))
              }
              onAssign={(key) => assignRoll(roll.id, key)}
              onUnassign={() => unassignRoll(roll.id)}
            />
            <GenerationIssues
              issues={rollIssues}
              field="rolls"
              rollId={roll.id}
            />
          </Stack>
        ))}
      </Group>
      {draft.rolls.length > 0 && (
        <Stack gap="xs">
          <Button
            size="sm"
            onClick={rerollSelected}
            disabled={
              !canReroll || selection.length === 0 || selection.length > limit
            }
          >
            {rerollLabel}
          </Button>
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
