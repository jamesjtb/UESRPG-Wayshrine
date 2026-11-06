import { Button, Stack, UnstyledButton } from "@mantine/core";
import type {
  CharacteristicGenerationIssue,
  CharacteristicRoll,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import type { CharacteristicRoller } from "./dice";
import classes from "./CharacteristicDraftPreview.module.css";

/** Initial acquisition and invalid-draft feedback, reused inside or outside the table. */
export function LuckRoll({
  roll,
  issues,
  rollDice,
  submitLuckRoll,
  onDiceAcquisitionError,
  showInitialAction,
  inTable = false,
}: {
  roll: CharacteristicRoll | undefined;
  issues: readonly CharacteristicGenerationIssue[];
  rollDice: CharacteristicRoller;
  submitLuckRoll: (roll: CharacteristicRoll) => void;
  onDiceAcquisitionError: (error: unknown) => void;
  showInitialAction: boolean;
  inTable?: boolean;
}) {
  const visibleIssues = issues.filter(
    (issue) => issue.field === "luck" && roll !== undefined,
  );
  const valid = roll !== undefined && visibleIssues.length === 0;
  function rollLuck() {
    try {
      submitLuckRoll(rollDice());
    } catch (error) {
      onDiceAcquisitionError(error);
    }
  }
  if (valid || (!showInitialAction && visibleIssues.length === 0)) return null;
  return (
    <Stack gap="xs" role="group" aria-label="Luck roll">
      {showInitialAction &&
        (inTable ? (
          <UnstyledButton className={classes.contribution} onClick={rollLuck}>
            Roll
          </UnstyledButton>
        ) : (
          <Button size="sm" onClick={rollLuck}>
            Roll
          </Button>
        ))}
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
