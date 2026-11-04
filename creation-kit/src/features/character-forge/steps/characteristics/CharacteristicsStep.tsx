import { Radio, Stack, Title } from "@mantine/core";
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

  function changeMethod(value: string) {
    if (value === "rolled" || value === "point-buy") {
      setCharacteristicGenerationMethod(value);
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
      <Radio.Group
        label="Generation method"
        value={generation.drafts.method ?? ""}
        onChange={changeMethod}
      >
        <Stack gap="xs" mt="xs">
          <Radio value="rolled" label="Rolled" />
          <Radio value="point-buy" label="Point buy" />
        </Stack>
      </Radio.Group>
      <GenerationIssues issues={methodIssues} field="method" />
      {generation.drafts.method === "rolled" && (
        <RolledCharacteristics
          draft={generation.drafts.rolled}
          issues={generation.issues}
          rollDice={rollDice}
          submitCharacteristicRolls={submitCharacteristicRolls}
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
      <LuckRoll
        roll={generation.drafts.luck}
        issues={generation.issues}
        rollDice={rollDice}
        submitLuckRoll={submitLuckRoll}
      />
    </Stack>
  );
}
