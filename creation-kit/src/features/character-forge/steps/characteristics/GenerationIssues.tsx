import { Text } from "@mantine/core";
import type {
  Characteristic,
  CharacteristicGenerationField,
  CharacteristicGenerationIssue,
} from "@wayshrine/core";

interface Props {
  issues: readonly CharacteristicGenerationIssue[];
  field: CharacteristicGenerationField;
  characteristic?: Characteristic;
  rollId?: string | undefined;
  targetLabel?: string;
}

/** Put field-wide issues beside the section and targeted issues beside its input. */
export function GenerationIssues({
  issues,
  field,
  characteristic,
  rollId,
  targetLabel,
}: Props) {
  function matchesTarget(issue: CharacteristicGenerationIssue) {
    if (issue.field !== field || issue.code === "favored-count") return false;
    if (issue.characteristic !== characteristic) return false;
    if (characteristic !== undefined) return true;
    return issue.rollId === rollId;
  }

  return issues.filter(matchesTarget).map((issue, index) => (
    <Text size="sm" role="status" key={index}>
      {targetLabel && `${targetLabel}: `}
      {issue.message}
    </Text>
  ));
}
