import { Stack, Title } from "@mantine/core";
import { useContentCatalog } from "../../app/ContentCatalogProvider";
import type { ContentCatalog } from "@wayshrine/core";
import { ToolBreadcrumbs } from "../../layouts/CreationKitLayout/ToolBreadcrumbs";
import { ToolHeader } from "../../layouts/CreationKitLayout/ToolHeader";
import { useCharacterCreator } from "./useCharacterCreator";
import { RaceStep } from "./steps/race/RaceStep";
import { CharacterPreview } from "./components/CharacterPreview";
import { ForgeWorkspace } from "./components/ForgeWorkspace";
import { StepNavigation } from "./components/StepNavigation";
import { ErrorModal } from "../../components/ErrorModal";
import classes from "./CharacterForge.module.css";
import { readableLabel } from "./labels";

export function CharacterForge() {
  const content = useContentCatalog();
  return (
    <Stack className={classes.forge}>
      <Title order={1}>Character Forge</Title>
      {content.status === "ready" && <ForgeSession catalog={content.catalog} />}
    </Stack>
  );
}

function ForgeSession({ catalog }: { catalog: ContentCatalog }) {
  const {
    view,
    setName,
    chooseRace,
    cancelRaceSelection,
    chooseRacialBonus,
    dismissError,
    next,
    previous,
  } = useCharacterCreator(catalog);
  if (!view) return null;
  const raceLabel = readableLabel(
    view.snapshot.answers.raceKey ?? "Selected race",
    view.preview.race?.label,
  );
  const steps = view.snapshot.steps.map((step) => {
    if (step.id === "race") return "Select Race";
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
            <RaceStep
              catalog={catalog}
              snapshot={view.snapshot}
              chooseRace={chooseRace}
              cancelRaceSelection={cancelRaceSelection}
              chooseRacialBonus={chooseRacialBonus}
            />
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
        preview={
          <CharacterPreview
            preview={view.preview}
            raceLabel={raceLabel}
            onNameChange={setName}
          />
        }
      />
    </>
  );
}
