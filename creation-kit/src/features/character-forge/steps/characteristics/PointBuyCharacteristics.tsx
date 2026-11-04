import { Box, Stack, Text } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAllocations,
  CharacteristicGenerationIssue,
} from "@wayshrine/core";
import { AllocationCard } from "./AllocationCard";
import { GenerationIssues } from "./GenerationIssues";
import classes from "./PointBuyCharacteristics.module.css";

interface Props {
  allocations: CharacteristicAllocations;
  issues: readonly CharacteristicGenerationIssue[];
  setCharacteristicAllocations: (
    allocations: CharacteristicAllocations,
  ) => void;
}

export function PointBuyCharacteristics({
  allocations,
  issues,
  setCharacteristicAllocations,
}: Props) {
  function changeAllocation(key: Characteristic, value: number | undefined) {
    const next = { ...allocations };
    if (value === undefined) delete next[key];
    else next[key] = value;
    setCharacteristicAllocations(next);
  }

  function showIssue(issue: CharacteristicGenerationIssue) {
    if (issue.field !== "allocations" || issue.code === "point-budget")
      return false;
    if (issue.code !== "invalid-allocation") return true;
    if (!issue.characteristic) return false;
    return allocations[issue.characteristic] !== undefined;
  }

  let spent = 0;
  for (const value of Object.values(allocations)) spent += value ?? 0;
  const remaining = 80 - spent;
  const displayedRemaining = Number.isFinite(remaining) ? remaining : "—";
  const visibleIssues = issues.filter(showIssue);

  return (
    <Stack gap="sm">
      <Text fw={600}>Points remaining: {displayedRemaining}</Text>
      <GenerationIssues issues={visibleIssues} field="allocations" />
      <Box className={classes.grid}>
        {Object.values(Characteristic).map((key) => (
          <AllocationCard
            key={key}
            characteristic={key}
            value={allocations[key]}
            remaining={remaining}
            issues={visibleIssues}
            onChange={(value) => changeAllocation(key, value)}
          />
        ))}
      </Box>
    </Stack>
  );
}
