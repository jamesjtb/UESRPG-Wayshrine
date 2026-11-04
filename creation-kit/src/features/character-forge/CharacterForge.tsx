import { Stack, Title } from "@mantine/core";
import { useContentCatalog } from "../../app/ContentCatalogProvider";
import type { ContentCatalog } from "@wayshrine/core";
import { ToolBreadcrumbs } from "../../layouts/CreationKitLayout/ToolBreadcrumbs";
import { ToolHeader } from "../../layouts/CreationKitLayout/ToolHeader";
import { useCharacterCreator } from "./useCharacterCreator";
import { RaceStep } from "./steps/race/RaceStep";
import { CharacteristicsStep } from "./steps/characteristics/CharacteristicsStep";
import { CharacterSheet } from "./components/CharacterSheet";
import { ForgeWorkspace } from "./components/ForgeWorkspace";
import { StepNavigation } from "./components/StepNavigation";
import { ErrorModal } from "../../components/ErrorModal";
import classes from "./CharacterForge.module.css";
import { readableLabel } from "./labels";
import { rollCharacteristicDice } from "./steps/characteristics/dice";
import type { CharacteristicRoller } from "./steps/characteristics/dice";

export function CharacterForge({
  rollDice = rollCharacteristicDice,
}: {
  rollDice?: CharacteristicRoller;
}) {
  const content = useContentCatalog();
  return (
    <Stack className={classes.forge}>
      <Title order={1}>Character Sheet</Title>
      {content.status === "ready" && (
        <ForgeSession catalog={content.catalog} rollDice={rollDice} />
      )}
    </Stack>
  );
}

function ForgeSession({
  catalog,
  rollDice,
}: {
  catalog: ContentCatalog;
  rollDice: CharacteristicRoller;
}) {
  const {
    view,
    setName,
    chooseRace,
    cancelRaceSelection,
    chooseRacialBonus,
    dismissError,
    next,
    previous,
    setFavoredCharacteristics,
    setCharacteristicGenerationMethod,
    submitCharacteristicRolls,
    setCharacteristicAssignments,
    setCharacteristicAllocations,
    submitLuckRoll,
  } = useCharacterCreator(catalog);
  if (!view) return null;
  const raceLabel = readableLabel(
    view.snapshot.answers.raceKey ?? "Selected race",
    view.preview.race?.label,
  );
  const steps = view.snapshot.steps.map((step) => {
    if (step.id === "race") return "Select Race";
    if (step.id === "characteristics") return "Generate Characteristics";
    return readableLabel(step.id);
  });
  const active = view.snapshot.steps.findIndex(
    (step) => step.id === view.snapshot.currentStep,
  );
  return (
    <>
      <ToolHeader>
        <ToolBreadcrumbs
          steps={steps}
          active={active}
          onStepClick={() => {}}
          label="Character creation steps"
        />
      </ToolHeader>
      <ForgeWorkspace
        editor={
          <>
            <ErrorModal opened={view.errorOpened} onClose={dismissError} />
            {view.snapshot.currentStep === "race" && (
              <RaceStep
                catalog={catalog}
                snapshot={view.snapshot}
                chooseRace={chooseRace}
                cancelRaceSelection={cancelRaceSelection}
                chooseRacialBonus={chooseRacialBonus}
              />
            )}
            {view.snapshot.currentStep === "characteristics" && (
              <CharacteristicsStep
                generation={view.snapshot.characteristicGeneration}
                rollDice={rollDice}
                submitCharacteristicRolls={submitCharacteristicRolls}
                setCharacteristicAssignments={setCharacteristicAssignments}
                setCharacteristicAllocations={setCharacteristicAllocations}
                submitLuckRoll={submitLuckRoll}
                setFavoredCharacteristics={setFavoredCharacteristics}
                setCharacteristicGenerationMethod={
                  setCharacteristicGenerationMethod
                }
              />
            )}
          </>
        }
        navigation={
          <StepNavigation
            canGoPrevious={view.snapshot.canGoPrevious}
            canGoNext={view.snapshot.canGoNext}
            onPrevious={previous}
            onNext={next}
          />
        }
        sheet={
          <CharacterSheet
            preview={view.preview}
            raceLabel={raceLabel}
            onNameChange={setName}
          />
        }
      />
    </>
  );
}
