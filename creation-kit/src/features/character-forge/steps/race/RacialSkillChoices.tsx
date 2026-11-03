import { Button, Checkbox, Stack, Text } from "@mantine/core";
import type { CharacterCreationSnapshot, ChoiceState } from "@wayshrine/core";
import { readableLabel } from "../../labels";
import { choiceIssueMessage, isBlockingContentIssue } from "../../issues";
import { LoadingIndicator } from "../../../../components/LoadingIndicator";

interface Props {
  snapshot: CharacterCreationSnapshot;
  disabled: boolean;
  chooseRacialBonus: (id: string, selections: readonly string[]) => void;
}

export function RacialSkillChoices(props: Props) {
  return props.snapshot.racialBonusChoices.map((group) => (
    <SkillGroup key={group.id} group={group} {...props} />
  ));
}

function SkillGroup({
  group,
  snapshot,
  disabled,
  chooseRacialBonus,
}: Props & { group: ChoiceState<string> }) {
  const issues = snapshot.issues.filter((issue) => issue.choiceId === group.id);
  const load = snapshot.contentLoads.find(
    (candidate) =>
      candidate.operation.kind === "racial-bonus" &&
      candidate.operation.choiceId === group.id,
  );
  const unresolved = issues.some(
    (issue) => issue.code === "content-unresolved",
  );
  const retryable = unresolved || load?.status === "failed";
  const visibleIssues = issues.filter(
    (issue) =>
      issue.code !== "selection-count" &&
      issue.code !== "content-loading" &&
      !isBlockingContentIssue(issue),
  );

  function skillLabel(key: string) {
    const option = snapshot.racialSkillOptions.find(
      (candidate) => candidate.key === key,
    );
    return readableLabel(key, option?.label);
  }
  return (
    <Stack gap="xs">
      <Checkbox.Group
        label={<strong>Choose {group.choose}</strong>}
        value={[...group.selections]}
        onChange={(selections) => chooseRacialBonus(group.id, selections)}
      >
        <Stack gap="xs" mt="xs">
          {group.options.map((key) => (
            <Checkbox
              key={key}
              value={key}
              disabled={disabled}
              label={skillLabel(key)}
            />
          ))}
        </Stack>
      </Checkbox.Group>
      {load?.status === "loading" && (
        <LoadingIndicator label="Loading skills" />
      )}
      {visibleIssues.map((issue, index) => (
        <Text size="sm" role="status" key={`${issue.code}/${index}`}>
          {choiceIssueMessage(issue)}
        </Text>
      ))}
      {retryable && (
        <Button
          variant="default"
          disabled={disabled}
          onClick={() => chooseRacialBonus(group.id, group.selections)}
        >
          Retry skill selection
        </Button>
      )}
    </Stack>
  );
}
