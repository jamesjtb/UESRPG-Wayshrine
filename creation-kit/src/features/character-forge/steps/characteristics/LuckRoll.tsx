import { useState } from "react";
import { Button, Group, Stack, Text, Title } from "@mantine/core";
import type {
  CharacteristicGenerationIssue,
  CharacteristicRoll,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import { rollBreakdown } from "./dice";
import { RollTile } from "./RollTile";
import type { CharacteristicRoller } from "./dice";

interface Props {
  roll: CharacteristicRoll | undefined;
  issues: readonly CharacteristicGenerationIssue[];
  rollDice: CharacteristicRoller;
  submitLuckRoll: (roll: CharacteristicRoll) => void;
}

export function LuckRoll({ roll, issues, rollDice, submitLuckRoll }: Props) {
  const [detailsOpened, setDetailsOpened] = useState(false);

  function showIssue(issue: CharacteristicGenerationIssue) {
    if (roll !== undefined || issue.field !== "luck") return true;
    return issue.code !== "roll-identity" && issue.code !== "invalid-dice";
  }

  const visibleIssues = issues.filter(showIssue);

  function rollLuck() {
    setDetailsOpened(false);
    submitLuckRoll(rollDice());
  }

  return (
    <Stack gap="xs" role="group" aria-label="Luck roll">
      <Title order={3}>Luck</Title>
      <Group gap="sm">
        {roll && (
          <RollTile
            roll={roll}
            label="Luck roll"
            aria-expanded={detailsOpened}
            onClick={() => setDetailsOpened(!detailsOpened)}
          />
        )}
        <Button size="sm" variant="light" onClick={rollLuck}>
          {roll ? "Reroll" : "Roll"}
        </Button>
      </Group>
      {roll && detailsOpened && (
        <Text size="sm" c="dimmed" role="status">
          {rollBreakdown(roll)}
        </Text>
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
