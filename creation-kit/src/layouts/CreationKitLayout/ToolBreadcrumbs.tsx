import { Button, Group, Menu, OverflowList, Text } from "@mantine/core";

interface ToolBreadcrumbsProps {
  steps: string[];
  active: number;
  onStepClick: (step: number) => void;
  label: string;
}

export function ToolBreadcrumbs({
  steps,
  active,
  onStepClick,
  label,
}: ToolBreadcrumbsProps) {
  const current = Math.min(active, steps.length - 1);
  const previousSteps = steps.slice(0, current);
  const separator = (
    <Text span size="xs" c="dimmed" aria-hidden="true">
      ›
    </Text>
  );

  return (
    <Group component="nav" aria-label={label} gap="xs" wrap="nowrap">
      {previousSteps.length > 0 && (
        <OverflowList
          data={previousSteps}
          collapseFrom="start"
          gap="xs"
          style={{ minWidth: 0, flexShrink: 1 }}
          renderItem={(step, index) => (
            <Group gap="xs" wrap="nowrap">
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                onClick={() => onStepClick(index)}
              >
                {step}
              </Button>
              {separator}
            </Group>
          )}
          renderOverflow={(hiddenSteps) => (
            <Group gap="xs" wrap="nowrap">
              <Menu position="bottom-start" withinPortal>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    color="gray"
                    size="compact-xs"
                    aria-label="Show earlier steps"
                  >
                    …
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {hiddenSteps.map((step, index) => (
                    <Menu.Item key={step} onClick={() => onStepClick(index)}>
                      {step}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
              {separator}
            </Group>
          )}
        />
      )}
      <Button
        variant="subtle"
        size="compact-xs"
        fw={700}
        style={{ flexShrink: 0 }}
        aria-current={active < steps.length ? "step" : undefined}
        onClick={() => onStepClick(current)}
      >
        {steps[current]}
      </Button>
    </Group>
  );
}
