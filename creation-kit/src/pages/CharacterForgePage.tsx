import { Button, Group, Stack, Title } from "@mantine/core";
import { useState } from "react";
import { ToolBreadcrumbs } from "../layouts/CreationKitLayout/ToolBreadcrumbs";
import { ToolHeader } from "../layouts/CreationKitLayout/ToolHeader";

const steps = [
  "Select Race",
  "Generate Characteristics",
  "Determine Birthsign",
  "Generate Lucky Numbers",
  "Bonds (Optional)",
  "Character Traits (Optional)",
  "Character Details",
];

export function CharacterForgePage() {
  const [active, setActive] = useState(0);
  const completed = active === steps.length;

  return (
    <Stack>
      <Title order={1}>Character Forge</Title>
      <ToolHeader>
        <ToolBreadcrumbs
          steps={steps}
          active={active}
          onStepClick={setActive}
          label="Character creation steps"
        />
      </ToolHeader>
      <Group justify="space-between">
        <Button
          variant="default"
          disabled={active === 0}
          onClick={() => setActive((step) => Math.max(0, step - 1))}
        >
          Back
        </Button>
        {!completed && (
          <Button
            onClick={() =>
              setActive((step) => Math.min(steps.length, step + 1))
            }
          >
            {active === steps.length - 1 ? "Finalize Character" : "Next"}
          </Button>
        )}
      </Group>
    </Stack>
  );
}
