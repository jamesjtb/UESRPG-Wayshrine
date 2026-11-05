import { useState } from "react";
import { Accordion, Box, Stack, Switch, Text, Title } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import type {
  Characteristic,
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationMethod,
  CharacteristicGenerationCommandResult,
  CharacteristicGenerationIssue,
  CharacteristicGenerationSnapshot,
  CharacteristicRoll,
  PcCharacteristics,
} from "@wayshrine/core";
import { GenerationIssues } from "./GenerationIssues";
import { RolledCharacteristics } from "./RolledCharacteristics";
import { PointBuyCharacteristics } from "./PointBuyCharacteristics";
import { LuckRoll } from "./LuckRoll";
import type { CharacteristicRoller } from "./dice";
import { CharacteristicDraftPreview } from "./CharacteristicDraftPreview";
import { ToContinue } from "../../components/ToContinue";
import { characteristicUserActions } from "../../userActions";
import classes from "./CharacteristicsStep.module.css";
import disclosureClasses from "../../components/ToContinue.module.css";

interface Props {
  generation: CharacteristicGenerationSnapshot;
  characteristics: PcCharacteristics;
  raceUsable: boolean;
  raceComplete: boolean;
  setFavoredCharacteristics: (favored: readonly Characteristic[]) => void;
  setCharacteristicGenerationMethod: (
    method: CharacteristicGenerationMethod,
  ) => void;
  rollDice: CharacteristicRoller;
  onDiceAcquisitionError: (error: unknown) => void;
  submitCharacteristicRolls: (rolls: readonly CharacteristicRoll[]) => void;
  setUnlimitedCharacteristicRerolls: (enabled: boolean) => void;
  rerollCharacteristics: (
    ids: readonly string[],
    rollDice: CharacteristicRoller,
    rerollLuck?: boolean,
  ) => CharacteristicGenerationCommandResult | undefined;
  setCharacteristicAssignments: (
    assignments: CharacteristicAssignments,
  ) => void;
  setCharacteristicAllocations: (
    allocations: CharacteristicAllocations,
  ) => void;
  submitLuckRoll: (roll: CharacteristicRoll) => void;
}

export function CharacteristicsStep({
  generation,
  characteristics,
  raceUsable,
  raceComplete,
  setFavoredCharacteristics,
  setCharacteristicGenerationMethod,
  rollDice,
  onDiceAcquisitionError,
  submitCharacteristicRolls,
  setUnlimitedCharacteristicRerolls,
  rerollCharacteristics,
  setCharacteristicAssignments,
  setCharacteristicAllocations,
  submitLuckRoll,
}: Props) {
  const [commandIssues, setCommandIssues] = useState<
    readonly CharacteristicGenerationIssue[]
  >([]);
  const methodIssues = generation.issues.filter(
    (issue) => issue.field === "method" && issue.code !== "generation-method",
  );

  function changeMethod(pointBuy: boolean) {
    setCommandIssues([]);
    if (pointBuy) {
      setCharacteristicGenerationMethod("point-buy");
    } else {
      setCharacteristicGenerationMethod("rolled");
    }
  }

  function changeUnlimited(enabled: boolean) {
    setCommandIssues([]);
    setUnlimitedCharacteristicRerolls(enabled);
  }

  function rerollLuck() {
    const result = rerollCharacteristics([], rollDice, true);
    setCommandIssues(result && !result.ok ? result.issues : []);
  }

  function submitInitialRolls(rolls: readonly CharacteristicRoll[]) {
    const luck = generation.drafts.luck ? undefined : rollDice();
    submitCharacteristicRolls(rolls);
    if (luck) submitLuckRoll(luck);
  }

  const preview = (
    <CharacteristicDraftPreview
      characteristics={characteristics}
      raceUsable={raceUsable}
      generation={generation}
      setFavoredCharacteristics={setFavoredCharacteristics}
      setCharacteristicAssignments={setCharacteristicAssignments}
      rerollLuck={rerollLuck}
    />
  );

  return (
    <Stack>
      <Title order={2}>Generate Characteristics</Title>
      <ToContinue
        actions={characteristicUserActions(generation, raceComplete)}
      />
      <Box className={classes.container}>
        <Box
          className={
            generation.drafts.method === "rolled" ? classes.rolled : undefined
          }
        >
          {preview}
          {generation.drafts.method === "rolled" && (
            <RolledCharacteristics
              draft={generation.drafts.rolled}
              issues={generation.issues}
              rollDice={rollDice}
              submitCharacteristicRolls={submitInitialRolls}
              rerolls={generation.rerolls}
              rerollCharacteristics={rerollCharacteristics}
              onDiceAcquisitionError={onDiceAcquisitionError}
            />
          )}
        </Box>
      </Box>
      <GenerationIssues issues={generation.issues} field="favored" />
      {generation.drafts.method === "point-buy" && (
        <PointBuyCharacteristics
          allocations={generation.drafts.pointBuy.allocations}
          issues={generation.issues}
          setCharacteristicAllocations={setCharacteristicAllocations}
        />
      )}
      <LuckRoll
        roll={generation.drafts.luck}
        issues={generation.issues}
        rollDice={rollDice}
        submitLuckRoll={submitLuckRoll}
        onDiceAcquisitionError={onDiceAcquisitionError}
        showInitialAction={
          generation.drafts.method === "point-buy" ||
          generation.rerolls.initialized
        }
      />
      {commandIssues.length > 0 && (
        <Stack gap="xs" role="group" aria-label="Luck reroll feedback">
          {commandIssues.map((issue, index) => (
            <Text size="sm" role="status" key={index}>
              {issue.message}
            </Text>
          ))}
        </Stack>
      )}
      <Accordion
        className={disclosureClasses.frame}
        chevronPosition="right"
        chevronSize={28}
        chevron={<IconChevronDown size={18} aria-hidden />}
        classNames={{
          item: disclosureClasses.item,
          control: disclosureClasses.control,
          label: disclosureClasses.label,
          content: disclosureClasses.content,
          chevron: disclosureClasses.chevron,
        }}
      >
        <Accordion.Item value="options">
          <Accordion.Control>Options</Accordion.Control>
          <Accordion.Panel>
            <Stack>
              <Switch
                label="Unlimited Rerolls"
                checked={generation.rerolls.unlimited}
                onChange={(event) =>
                  changeUnlimited(event.currentTarget.checked)
                }
              />
              <Switch
                label="Use Optional Point Buy Rules"
                checked={generation.drafts.method === "point-buy"}
                onChange={(event) => changeMethod(event.currentTarget.checked)}
              />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
      <GenerationIssues issues={methodIssues} field="method" />
    </Stack>
  );
}
