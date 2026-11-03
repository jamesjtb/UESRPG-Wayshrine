import { Button, Group } from "@mantine/core";
import type { CharacterCreationSnapshot } from "@wayshrine/core";

type StepNavigationProps = Pick<
  CharacterCreationSnapshot,
  "canGoPrevious" | "canGoNext"
> & {
  onPrevious: () => void;
  onNext: () => void;
};

export function StepNavigation({
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: StepNavigationProps) {
  return (
    <Group
      component="nav"
      aria-label="Character creation navigation"
      justify="space-between"
    >
      <Button variant="default" disabled={!canGoPrevious} onClick={onPrevious}>
        Back
      </Button>
      <Button disabled={!canGoNext} onClick={onNext}>
        Next
      </Button>
    </Group>
  );
}
