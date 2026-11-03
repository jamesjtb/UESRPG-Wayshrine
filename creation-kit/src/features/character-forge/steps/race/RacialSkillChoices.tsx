import type {
  CharacterCreationSnapshot,
  ChoiceState,
  WizardIssue,
} from "@wayshrine/core";
import { readableLabel } from "../../labels";
import { isBlockingContentIssue } from "../../issues";
import { ChoiceGroupField } from "../../components/ChoiceGroupField";

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
  const visibleIssues = issues
    .filter(
      (issue) =>
        issue.code !== "selection-count" &&
        issue.code !== "content-loading" &&
        !isBlockingContentIssue(issue),
    )
    .map(skillIssueMessage);

  function skillLabel(key: string) {
    const option = snapshot.racialSkillOptions.find(
      (candidate) => candidate.key === key,
    );
    return readableLabel(key, option?.label);
  }
  const optionLabels = Object.fromEntries(
    group.options.map((key) => [key, skillLabel(key)]),
  );

  function retry() {
    chooseRacialBonus(group.id, group.selections);
  }

  return (
    <ChoiceGroupField
      group={group}
      optionLabels={optionLabels}
      disabled={disabled}
      loading={load?.status === "loading"}
      loadingLabel="Loading skills"
      visibleIssues={visibleIssues}
      onChange={(selections) => chooseRacialBonus(group.id, selections)}
      onRetry={retryable ? retry : undefined}
      retryLabel="Retry skill selection"
    />
  );
}

function skillIssueMessage(issue: WizardIssue): string {
  if (issue.code === "content-unresolved") return "Retry this skill selection.";
  return issue.message;
}
