import { Button, Stack, Text } from "@mantine/core";
import type { ChoiceState } from "@wayshrine/core";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import { LimitedCheckboxGroup } from "./LimitedCheckboxGroup";

interface Props {
  group: ChoiceState<string>;
  optionLabels: Readonly<Record<string, string>>;
  disabled: boolean;
  loading: boolean;
  loadingLabel: string;
  visibleIssues: readonly string[];
  onChange: (selections: readonly string[]) => void;
  onRetry?: (() => void) | undefined;
  retryLabel: string;
}

export function ChoiceGroupField({
  group,
  optionLabels,
  disabled,
  loading,
  loadingLabel,
  visibleIssues,
  onChange,
  onRetry,
  retryLabel,
}: Props) {
  return (
    <Stack gap="xs">
      <LimitedCheckboxGroup
        label={<strong>Choose {group.choose}</strong>}
        options={group.options}
        optionLabels={optionLabels}
        selections={group.selections}
        limit={group.choose}
        disabled={disabled}
        onChange={onChange}
      />
      {loading && <LoadingIndicator label={loadingLabel} />}
      {visibleIssues.map((message, index) => (
        <Text size="sm" role="status" key={index}>
          {message}
        </Text>
      ))}
      {onRetry && (
        <Button variant="default" disabled={disabled} onClick={() => onRetry()}>
          {retryLabel}
        </Button>
      )}
    </Stack>
  );
}
