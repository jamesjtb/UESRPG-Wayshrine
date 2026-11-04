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
  setCharacteristicAssignments,
}: Props) {
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
      <Group align="center" gap="sm">
        <Button size="sm" onClick={rollPool}>
          {draft.rolls.length === 0 ? "Roll" : "Reroll"}
        </Button>
      </Group>
      <GenerationIssues issues={rollIssues} field="rolls" />
      <Group
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
