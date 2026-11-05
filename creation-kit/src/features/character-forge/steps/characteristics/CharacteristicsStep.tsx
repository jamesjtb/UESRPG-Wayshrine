import { useState } from "react";
import { Button, Stack, Switch, Text, Title } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationMethod,
  CharacteristicGenerationCommandResult,
  CharacteristicGenerationIssue,
  CharacteristicGenerationSnapshot,
  CharacteristicRoll,
} from "@wayshrine/core";
import { characteristicLabels } from "./characteristicLabels";
import { GenerationIssues } from "./GenerationIssues";
import { RolledCharacteristics } from "./RolledCharacteristics";
import { PointBuyCharacteristics } from "./PointBuyCharacteristics";
import { LuckRoll } from "./LuckRoll";
import type { CharacteristicRoller } from "./dice";
import { LimitedCheckboxGroup } from "../../components/LimitedCheckboxGroup";
import { ToContinue } from "../../components/ToContinue";
import { characteristicUserActions } from "../../userActions";

interface Props {
  generation: CharacteristicGenerationSnapshot;
  raceComplete: boolean;
  setFavoredCharacteristics: (favored: readonly Characteristic[]) => void;
  setCharacteristicGenerationMethod: (
    method: CharacteristicGenerationMethod,
  ) => void;
  rollDice: CharacteristicRoller;
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
  raceComplete,
  setFavoredCharacteristics,
  setCharacteristicGenerationMethod,
  rollDice,
  submitCharacteristicRolls,
  setUnlimitedCharacteristicRerolls,
  rerollCharacteristics,
  setCharacteristicAssignments,
  setCharacteristicAllocations,
  submitLuckRoll,
}: Props) {
  const [luckSelected, setLuckSelected] = useState(false);
  const [commandIssues, setCommandIssues] = useState<
    readonly CharacteristicGenerationIssue[]
  >([]);
  const methodIssues = generation.issues.filter(
    (issue) => issue.field === "method" && issue.code !== "generation-method",
  );

  function changeFavored(values: readonly string[]) {
    const favored = Object.values(Characteristic).filter((key) =>
      values.includes(key),
    );
    setFavoredCharacteristics(favored);
  }

  function changeMethod(pointBuy: boolean) {
    setLuckSelected(false);
    setCommandIssues([]);
    if (pointBuy) {
      setCharacteristicGenerationMethod("point-buy");
    } else {
      setCharacteristicGenerationMethod("rolled");
    }
  }

  function changeUnlimited(enabled: boolean) {
    if (!enabled) setLuckSelected(false);
    setUnlimitedCharacteristicRerolls(enabled);
  }

  function toggleLuck() {
    if (luckSelected || generation.rerolls.unlimited)
      setLuckSelected(!luckSelected);
    setCommandIssues([]);
  }

  function rerollSelected(
    ids: readonly string[],
    roller: CharacteristicRoller,
  ) {
    const result = rerollCharacteristics(ids, roller, luckSelected);
    if (result?.ok) setLuckSelected(false);
    return result;
  }

  function rerollPointBuyLuck() {
    const result = rerollSelected([], rollDice);
    setCommandIssues(result && !result.ok ? result.issues : []);
  }

  function submitInitialRolls(rolls: readonly CharacteristicRoll[]) {
    const luck = generation.drafts.luck ? undefined : rollDice();
    submitCharacteristicRolls(rolls);
    if (luck) submitLuckRoll(luck);
  }

  const luck = (
    <LuckRoll
      roll={generation.drafts.luck}
      issues={generation.issues}
      rollDice={rollDice}
      submitLuckRoll={submitLuckRoll}
      unlimited={generation.rerolls.unlimited}
      selected={luckSelected}
      onToggleReroll={toggleLuck}
      showInitialAction={generation.drafts.method === "point-buy"}
    />
  );

  return (
    <Stack>
      <Title order={2}>Generate Characteristics</Title>
      <ToContinue
        actions={characteristicUserActions(generation, raceComplete)}
      />
      <LimitedCheckboxGroup
        label="Favored characteristics"
        description="Choose two"
        options={Object.values(Characteristic)}
        optionLabels={characteristicLabels}
        selections={generation.drafts.favored}
        limit={2}
        disabled={false}
        onChange={changeFavored}
      />
      <GenerationIssues issues={generation.issues} field="favored" />
      {generation.drafts.method === "rolled" && (
        <RolledCharacteristics
          draft={generation.drafts.rolled}
          issues={generation.issues}
          rollDice={rollDice}
          submitCharacteristicRolls={submitInitialRolls}
          rerolls={generation.rerolls}
          rerollCharacteristics={rerollSelected}
          luckSelected={luckSelected}
          setCharacteristicAssignments={setCharacteristicAssignments}
        >
          {luck}
        </RolledCharacteristics>
      )}
      {generation.drafts.method === "point-buy" && (
        <PointBuyCharacteristics
          allocations={generation.drafts.pointBuy.allocations}
          issues={generation.issues}
          setCharacteristicAllocations={setCharacteristicAllocations}
        >
          {luck}
        </PointBuyCharacteristics>
      )}
      {generation.drafts.method === "point-buy" && generation.drafts.luck && (
        <Stack gap="xs">
          <Button
            size="sm"
            disabled={!luckSelected || !generation.rerolls.unlimited}
            onClick={rerollPointBuyLuck}
          >
            Reroll
          </Button>
          {commandIssues.map((issue, index) => (
            <Text size="sm" role="status" key={index}>
              {issue.message}
            </Text>
          ))}
        </Stack>
      )}
      <Switch
        label="Unlimited Rerolls"
        checked={generation.rerolls.unlimited}
        onChange={(event) => changeUnlimited(event.currentTarget.checked)}
      />
      <Switch
        label="Use Optional Point Buy Rules"
        checked={generation.drafts.method === "point-buy"}
        onChange={(event) => changeMethod(event.currentTarget.checked)}
      />
      <GenerationIssues issues={methodIssues} field="method" />
    </Stack>
  );
}
