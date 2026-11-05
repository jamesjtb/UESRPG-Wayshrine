import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useContentCatalog } from "../../app/ContentCatalogProvider";
import type { ContentCatalog } from "@wayshrine/core";
import { ToolBreadcrumbs } from "../../layouts/CreationKitLayout/ToolBreadcrumbs";
import { useCharacterCreator } from "./useCharacterCreator";
import { RaceStep } from "./steps/race/RaceStep";
import { CharacteristicsStep } from "./steps/characteristics/CharacteristicsStep";
import { CharacterSheet } from "./components/CharacterSheet";
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
  const [wizardOpened, setWizardOpened] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const smallScreen = useMediaQuery("(max-width: 48em)");
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
    setUnlimitedCharacteristicRerolls,
    rerollCharacteristics,
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
  function openWizard() {
    setEverOpened(true);
    setWizardOpened(true);
  }

  function closeWizard() {
    setWizardOpened(false);
  }

  function returnToLauncher() {
    // The stack deactivates this modal's focus trap as it closes.
    if (!wizardOpened && !view?.errorOpened) launcherRef.current?.focus();
  }

  return (
    <>
      <Group>
        <Button ref={launcherRef} onClick={openWizard}>
          Create Character
        </Button>
        {everOpened && !wizardOpened && (
          <Group gap="xs">
            <Badge variant="light" color="gray" size="sm">
              In progress
            </Badge>
            <Text size="sm" c="dimmed">
              Resume: {steps[active]}
            </Text>
          </Group>
        )}
      </Group>
      <Paper component="section" aria-label="Character sheet" withBorder p="md">
        <CharacterSheet
          preview={view.preview}
          raceLabel={raceLabel}
          onNameChange={setName}
        />
      </Paper>
      <Modal.Stack>
        <Modal
          stackId="creation-wizard"
          opened={wizardOpened}
          onClose={closeWizard}
          onExitTransitionEnd={returnToLauncher}
          title="Create Character"
          closeButtonProps={{ "aria-label": "Close character creation" }}
          size="xl"
          fullScreen={smallScreen}
          keepMounted
          keepMountedMode="display-none"
        >
          {everOpened && (
            <Stack component="section" aria-label="Character editor">
              <ToolBreadcrumbs
                steps={steps}
                active={active}
                onStepClick={() => {}}
                label="Character creation steps"
              />
              {view.snapshot.currentStep === "race" && (
                <RaceStep
                  catalog={catalog}
                  snapshot={view.snapshot}
                  chooseRace={chooseRace}
                  cancelRaceSelection={cancelRaceSelection}
                  chooseRacialBonus={chooseRacialBonus}
                  errorModalStackId="race-index-error"
                  onErrorExit={returnToLauncher}
                />
              )}
              {view.snapshot.currentStep === "characteristics" && (
                <CharacteristicsStep
                  generation={view.snapshot.characteristicGeneration}
                  rollDice={rollDice}
                  submitCharacteristicRolls={submitCharacteristicRolls}
                  setUnlimitedCharacteristicRerolls={
                    setUnlimitedCharacteristicRerolls
                  }
                  rerollCharacteristics={rerollCharacteristics}
                  setCharacteristicAssignments={setCharacteristicAssignments}
                  setCharacteristicAllocations={setCharacteristicAllocations}
                  submitLuckRoll={submitLuckRoll}
                  setFavoredCharacteristics={setFavoredCharacteristics}
                  setCharacteristicGenerationMethod={
                    setCharacteristicGenerationMethod
                  }
                />
              )}
              <footer>
                <StepNavigation
                  canGoPrevious={view.snapshot.canGoPrevious}
                  canGoNext={view.snapshot.canGoNext}
                  onPrevious={previous}
                  onNext={next}
                />
              </footer>
            </Stack>
          )}
        </Modal>
        <ErrorModal
          stackId="creator-error"
          opened={view.errorOpened}
          onClose={dismissError}
          onExitTransitionEnd={returnToLauncher}
        />
      </Modal.Stack>
    </>
  );
}
