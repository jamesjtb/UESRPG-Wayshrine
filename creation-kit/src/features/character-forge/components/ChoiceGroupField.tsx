import { Button, Checkbox, Stack, Text } from "@mantine/core";
import type { ChoiceState } from "@wayshrine/core";
import { LoadingIndicator } from "../../../components/LoadingIndicator";

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
      <Checkbox.Group
        label={<strong>Choose {group.choose}</strong>}
        value={[...group.selections]}
        onChange={onChange}
      >
        <Stack gap="xs" mt="xs">
          {group.options.map((key) => (
            <Checkbox
              key={key}
              value={key}
              disabled={disabled}
              label={optionLabels[key]}
            />
          ))}
        </Stack>
      </Checkbox.Group>
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
