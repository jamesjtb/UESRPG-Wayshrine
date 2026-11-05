import { Stack, Switch, Title } from "@mantine/core";
import { Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationMethod,
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

interface Props {
  generation: CharacteristicGenerationSnapshot;
  setFavoredCharacteristics: (favored: readonly Characteristic[]) => void;
  setCharacteristicGenerationMethod: (
    method: CharacteristicGenerationMethod,
  ) => void;
  rollDice: CharacteristicRoller;
  submitCharacteristicRolls: (rolls: readonly CharacteristicRoll[]) => void;
  unlimitedRerolls: boolean;
  rerollBatchSpent: boolean;
  setUnlimitedRerolls: (enabled: boolean) => void;
  rerollCharacteristics: (
    ids: readonly string[],
    rollDice: CharacteristicRoller,
  ) => boolean;
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
  setFavoredCharacteristics,
  setCharacteristicGenerationMethod,
  rollDice,
  submitCharacteristicRolls,
  unlimitedRerolls,
  rerollBatchSpent,
  setUnlimitedRerolls,
  rerollCharacteristics,
  setCharacteristicAssignments,
  setCharacteristicAllocations,
  submitLuckRoll,
}: Props) {
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
    if (pointBuy) {
      setCharacteristicGenerationMethod("point-buy");
    } else {
      setCharacteristicGenerationMethod("rolled");
    }
  }

  return (
    <Stack>
      <Title order={2}>Generate Characteristics</Title>
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
          submitCharacteristicRolls={submitCharacteristicRolls}
          unlimitedRerolls={unlimitedRerolls}
          rerollBatchSpent={rerollBatchSpent}
          rerollCharacteristics={rerollCharacteristics}
          setCharacteristicAssignments={setCharacteristicAssignments}
        />
      )}
      {generation.drafts.method === "point-buy" && (
        <PointBuyCharacteristics
          allocations={generation.drafts.pointBuy.allocations}
          issues={generation.issues}
          setCharacteristicAllocations={setCharacteristicAllocations}
        />
      )}
      <Switch
        label="Unlimited Rerolls"
        checked={unlimitedRerolls}
        onChange={(event) => setUnlimitedRerolls(event.currentTarget.checked)}
      />
      <Switch
        label="Use Optional Point Buy Rules"
        checked={generation.drafts.method === "point-buy"}
        onChange={(event) => changeMethod(event.currentTarget.checked)}
      />
      <GenerationIssues issues={methodIssues} field="method" />
      <LuckRoll
        roll={generation.drafts.luck}
        issues={generation.issues}
        rollDice={rollDice}
        submitLuckRoll={submitLuckRoll}
      />
    </Stack>
  );
}
