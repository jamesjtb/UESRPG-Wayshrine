import { Button, Group, Paper, SimpleGrid, Stack, Title } from "@mantine/core";
import { useContentCatalog } from "../../app/ContentCatalogProvider";
import type { ContentCatalog } from "@wayshrine/core";
import { ToolBreadcrumbs } from "../../layouts/CreationKitLayout/ToolBreadcrumbs";
import { ToolHeader } from "../../layouts/CreationKitLayout/ToolHeader";
import { useCharacterCreator } from "./useCharacterCreator";
import { RaceStep } from "./RaceStep";
import { CharacterPreview } from "./CharacterPreview";
import { ErrorModal } from "../../components/ErrorModal";
import classes from "./CharacterForge.module.css";
import { readableLabel } from "./labels";

export function CharacterForge() {
  const content = useContentCatalog();
  return (
    <Stack className={classes.forge}>
      <Title order={1}>Character Forge</Title>
      <ToolHeader>
        <ToolBreadcrumbs
          steps={["Select Race"]}
          active={0}
          onStepClick={() => {}}
          label="Character creation steps"
        />
      </ToolHeader>
      {content.status === "ready" && <ForgeSession catalog={content.catalog} />}
    </Stack>
  );
}

function ForgeSession({ catalog }: { catalog: ContentCatalog }) {
  const {
    view,
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
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} className={classes.panes}>
      <Paper
        component="section"
        aria-label="Character editor"
        withBorder
        p="md"
        className={classes.pane}
      >
        <ErrorModal opened={view.errorOpened} onClose={dismissError} />
        <Stack className={classes.editorBody}>
          <RaceStep
            catalog={catalog}
            snapshot={view.snapshot}
            chooseRace={chooseRace}
            cancelRaceSelection={cancelRaceSelection}
            chooseRacialBonus={chooseRacialBonus}
          />
        </Stack>
        <Stack component="footer" className={classes.footer} pt="md">
          <Group
            component="nav"
            aria-label="Character creation navigation"
            justify="space-between"
          >
            <Button
              variant="default"
              disabled={!view.snapshot.canGoPrevious}
              onClick={previous}
              title="This is the first step."
            >
              Back
            </Button>
            <Button disabled={!view.snapshot.canGoNext} onClick={next}>
              Next
            </Button>
          </Group>
        </Stack>
      </Paper>
      <Paper
        component="section"
        aria-label="Character sheet"
        tabIndex={0}
        withBorder
        p="md"
        className={`${classes.pane} ${classes.sheet}`}
      >
        <CharacterPreview preview={view.preview} raceLabel={raceLabel} />
      </Paper>
    </SimpleGrid>
  );
}
