import { Button, Stack } from "@mantine/core";
import type {
  CharacteristicGenerationIssue,
  CharacteristicRoll,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import { RollAssignmentMenu } from "./RollAssignmentMenu";
import type { CharacteristicRoller } from "./dice";
import classes from "./LuckRoll.module.css";

interface Props {
  roll: CharacteristicRoll | undefined;
  issues: readonly CharacteristicGenerationIssue[];
  rollDice: CharacteristicRoller;
  submitLuckRoll: (roll: CharacteristicRoll) => void;
  unlimited: boolean;
  selected: boolean;
  onToggleReroll: () => void;
  showInitialAction?: boolean;
}

function keepLuckAssignment() {}

export function LuckRoll({
  roll,
  issues,
  rollDice,
  submitLuckRoll,
  unlimited,
  selected,
  onToggleReroll,
  showInitialAction = true,
}: Props) {
  const visibleIssues = issues.filter(
    (issue) => issue.field === "luck" && roll !== undefined,
  );
  function rollLuck() {
    submitLuckRoll(rollDice());
  }
  return (
    <Stack
      className={classes.luck}
      gap="xs"
      role="group"
      aria-label="Luck roll"
    >
      {roll && (
        <RollAssignmentMenu
          roll={roll}
          ordinal={8}
          assignments={{}}
          lockedAssignment="Luck"
          selected={selected}
          canSelectReroll={unlimited}
          onToggleReroll={onToggleReroll}
          onAssign={keepLuckAssignment}
          onUnassign={keepLuckAssignment}
        />
      )}
      {!roll && showInitialAction && (
        <Button size="sm" onClick={rollLuck}>
          Roll
        </Button>
      )}
      <GenerationIssues issues={visibleIssues} field="luck" />
      {roll && (
        <GenerationIssues
          issues={visibleIssues}
          field="luck"
          rollId={roll.id}
        />
      )}
    </Stack>
  );
}
