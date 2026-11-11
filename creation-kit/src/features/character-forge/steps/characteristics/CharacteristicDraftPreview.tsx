import type { ReactNode } from "react";
import { ActionIcon, Box, Table, Text, UnstyledButton } from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";
import {
  calculateCharacteristicScore,
  PcCharacteristic,
} from "@wayshrine/core";
import type {
  Characteristic,
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationSnapshot,
  PcCharacteristics,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import classes from "./CharacteristicDraftPreview.module.css";
import { RolledContributionMenu } from "./RolledContributionMenu";
import { LuckContributionMenu } from "./LuckContributionMenu";
import { AllocationInput } from "./AllocationInput";
import { rollBreakdown } from "./dice";

const labels = { ...characteristicLabels, lck: "Luck" };
const shortLabels: Record<PcCharacteristic, string> = {
  str: "Str",
  end: "End",
  ag: "Ag",
  int: "Int",
  wp: "Wp",
  prc: "Prc",
  prs: "Prs",
  lck: "Lck",
};

function draftContribution(
  key: PcCharacteristic,
  generation: CharacteristicGenerationSnapshot,
): number | "Invalid" | undefined {
  const { drafts, issues } = generation;
  if (key === PcCharacteristic.Lck) {
    if (!drafts.luck) return undefined;
    if (issues.some((issue) => issue.field === "luck")) return "Invalid";
    return drafts.luck.dice.reduce((sum, face) => sum + face, 0);
  }
  if (drafts.method === "point-buy") {
    const value = drafts.pointBuy.allocations[key];
    if (value === undefined) return undefined;
    if (issues.some((issue) => issue.characteristic === key)) return "Invalid";
    return value;
  }
  if (drafts.method !== "rolled") return undefined;
  const id = drafts.rolled.assignments[key];
  if (id === undefined) return undefined;
  // A malformed pool cannot supply accepted dice, even for an individual target.
  if (
    issues.some(
      (issue) => issue.field === "rolls" || issue.characteristic === key,
    )
  )
    return "Invalid";
  const roll = drafts.rolled.rolls.find((candidate) => candidate.id === id);
  if (!roll) return "Invalid";
  return roll.dice.reduce((sum, face) => sum + face, 0);
}

export function CharacteristicDraftPreview({
  characteristics,
  raceUsable,
  generation,
  setFavoredCharacteristics,
  setCharacteristicAssignments,
  setCharacteristicAllocations,
  initialLuckControl,
  rerollLuck,
}: {
  characteristics: PcCharacteristics;
  raceUsable: boolean;
  generation: CharacteristicGenerationSnapshot;
  setFavoredCharacteristics: (favored: readonly Characteristic[]) => void;
  setCharacteristicAssignments: (
    assignments: CharacteristicAssignments,
  ) => void;
  setCharacteristicAllocations: (
    allocations: CharacteristicAllocations,
  ) => void;
  rerollLuck?: () => void;
  initialLuckControl?: ReactNode;
}) {
  const favored = generation.drafts.favored;
  const pointBuy = generation.drafts.method === "point-buy";
  const allocations = generation.drafts.pointBuy.allocations;
  let spent = 0;
  for (const value of Object.values(allocations)) spent += value ?? 0;
  const remaining = 80 - spent;

  function changeAllocation(key: Characteristic, value: number | undefined) {
    const next = { ...allocations };
    if (value === undefined) delete next[key];
    else next[key] = value;
    setCharacteristicAllocations(next);
  }
  const rows = Object.values(PcCharacteristic).map((key) => {
    const generated = raceUsable
      ? draftContribution(key, generation)
      : undefined;
    const value = characteristics[key];
    const score = calculateCharacteristicScore({
      baseline: value.baseline,
      rolled: typeof generated === "number" ? generated : 0,
    });
    return {
      key,
      cells: [value.baseline, generated ?? "—", score.total],
    };
  });

  function toggleFavored(key: Characteristic) {
    if (favored.includes(key)) {
      setFavoredCharacteristics(favored.filter((selected) => selected !== key));
    } else if (favored.length < 2) {
      setFavoredCharacteristics([...favored, key]);
    }
  }

  function favoredControl(key: PcCharacteristic) {
    if (key === PcCharacteristic.Lck) return "—";
    const selected = favored.includes(key);
    return (
      <ActionIcon
        className={classes.favored}
        variant="subtle"
        color={selected ? "yellow" : "gray"}
        size="lg"
        aria-label={`Favor ${labels[key]}`}
        aria-pressed={selected}
        disabled={!selected && favored.length >= 2}
        onClick={() => toggleFavored(key)}
      >
        {selected ? <IconStarFilled size={20} /> : <IconStar size={20} />}
      </ActionIcon>
    );
  }

  function contributionCell(key: PcCharacteristic, value: number | string) {
    if (key === PcCharacteristic.Lck) {
      const roll = generation.drafts.luck;
      const valid =
        roll && !generation.issues.some((issue) => issue.field === "luck");
      if (pointBuy && !valid && initialLuckControl) {
        return <Box className={classes.initialLuck}>{initialLuckControl}</Box>;
      }
      if (!valid) return value;
      if (!generation.rerolls.unlimited || !rerollLuck) {
        return (
          <UnstyledButton
            className={classes.contribution}
            disabled
            aria-label="Rolled result for Luck"
            aria-description={rollBreakdown(roll)}
          >
            <span>{value}</span>
          </UnstyledButton>
        );
      }
      return (
        <LuckContributionMenu value={value} roll={roll} onReroll={rerollLuck} />
      );
    }
    if (pointBuy) {
      const amount = allocations[key];
      return (
        <AllocationInput
          characteristic={key}
          value={amount}
          remaining={remaining}
          issues={amount === undefined ? [] : generation.issues}
          onChange={(value) => changeAllocation(key, value)}
        />
      );
    }
    if (generation.drafts.method !== "rolled") return value;
    return (
      <RolledContributionMenu
        key={JSON.stringify(generation.drafts.rolled.rolls)}
        characteristic={key}
        value={value}
        rolls={generation.drafts.rolled.rolls}
        assignments={generation.drafts.rolled.assignments}
        initialized={generation.rerolls.initialized}
        setCharacteristicAssignments={setCharacteristicAssignments}
      />
    );
  }

  return (
    <Box className={classes.preview}>
      {pointBuy && (
        <Text fw={600} mb="sm">
          Points remaining: {Number.isFinite(remaining) ? remaining : "—"}
        </Text>
      )}
      <Table
        aria-label="Characteristic draft preview"
        layout="fixed"
        w="100%"
        h="100%"
        miw={0}
        horizontalSpacing={2}
        verticalSpacing={4}
        fz="sm"
        classNames={{ th: classes.cell, td: classes.cell }}
        className={pointBuy ? classes.pointBuy : undefined}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th
              scope="col"
              aria-label="Characteristic"
              className={classes.characteristicHeading}
            >
              <span className={classes.fullHeading} aria-hidden>
                Characteristic
              </span>
              <abbr
                className={classes.compactHeading}
                title="Characteristic"
                aria-hidden
              >
                Char.
              </abbr>
            </Table.Th>
            <Table.Th scope="col" ta="center" aria-label="Baseline">
              <abbr title="Baseline">Base</abbr>
            </Table.Th>
            <Table.Th scope="col" ta="center">
              {pointBuy ? "Points" : "Rolled"}
            </Table.Th>
            <Table.Th scope="col" ta="center">
              Total
            </Table.Th>
            <Table.Th scope="col" ta="center" aria-label="Favored">
              <span className={classes.fullHeading} aria-hidden>
                Favored
              </span>
              <abbr
                className={classes.compactHeading}
                title="Favored"
                aria-hidden
              >
                Fav.
              </abbr>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map(({ key, cells }) => (
            <Table.Tr key={key}>
              <Table.Th scope="row" aria-label={labels[key]}>
                <abbr title={labels[key]}>{shortLabels[key]}</abbr>
              </Table.Th>
              {cells.map((value, index) => (
                <Table.Td key={index} ta="center">
                  {index === 1 ? contributionCell(key, value) : value}
                </Table.Td>
              ))}
              <Table.Td ta="center">{favoredControl(key)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}
