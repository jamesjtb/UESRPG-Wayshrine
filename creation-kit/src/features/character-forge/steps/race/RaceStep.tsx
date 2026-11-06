import { Button, Group, Select, Stack, Text, Title } from "@mantine/core";
import type {
  CharacterCreationSnapshot,
  ContentCatalog,
} from "@wayshrine/core";
import { readableLabel } from "../../labels";
import { RacialSkillChoices } from "./RacialSkillChoices";
import { ErrorModal } from "../../../../components/ErrorModal";
import { isBlockingContentIssue } from "../../issues";
import { LoadingIndicator } from "../../../../components/LoadingIndicator";
import { useContentSummaries } from "../../hooks/useContentSummaries";
import { ToContinue } from "../../components/ToContinue";
import { raceUserActions } from "../../userActions";

interface RaceStepProps {
  catalog: ContentCatalog;
  snapshot: CharacterCreationSnapshot;
  chooseRace: (key: string) => void;
  cancelRaceSelection: () => void;
  chooseRacialBonus: (id: string, selections: readonly string[]) => void;
  errorModalStackId?: string;
  onErrorExit?: () => void;
}

export function RaceStep({
  catalog,
  snapshot,
  chooseRace,
  cancelRaceSelection,
  chooseRacialBonus,
  errorModalStackId,
  onErrorExit,
}: RaceStepProps) {
  const index = useContentSummaries(catalog, "race");
  const indexStatus =
    index.status === "ready" && index.entries.length === 0
      ? "empty"
      : index.status;

  const raceLoad = snapshot.contentLoads.find(
    (load) => load.operation.kind === "race",
  );
  const requestedKey =
    raceLoad?.operation.kind === "race"
      ? raceLoad.operation.raceKey
      : undefined;
  const selectedKey = requestedKey ?? snapshot.answers.raceKey;
  const globalIssues = snapshot.issues.filter(
    (issue) =>
      issue.choiceId === undefined &&
      issue.code !== "race-required" &&
      issue.code !== "content-loading" &&
      !isBlockingContentIssue(issue),
  );

  return (
    <Stack>
      <Title order={2}>Select Race</Title>
      <ToContinue actions={raceUserActions(snapshot, indexStatus)} />
      {index.status === "loading" && <LoadingIndicator label="Loading races" />}
      {index.status === "error" && (
        <Stack gap="xs">
          <ErrorModal
            stackId={errorModalStackId}
            opened={!index.acknowledged}
            onClose={index.acknowledge}
            onExitTransitionEnd={onErrorExit}
          />
          <Button variant="default" onClick={index.retry}>
            Retry races
          </Button>
        </Stack>
      )}
      {index.status === "ready" && index.entries.length === 0 && (
        <Text>No races available.</Text>
      )}
      {index.status === "ready" && index.entries.length > 0 && (
        <Select
          label="Race"
          placeholder="Choose a race"
          searchable
          allowDeselect={false}
          value={selectedKey ?? null}
          data={index.entries.map((entry) => ({
            value: entry.key,
            label: readableLabel(entry.key, entry.label),
          }))}
          onChange={(key) => {
            if (key !== null) chooseRace(key);
          }}
        />
      )}
      {globalIssues.map((issue, index) => (
        <Text key={`${issue.code}/${index}`} role="status">
          {issue.message}
        </Text>
      ))}
      {raceLoad?.status === "loading" && (
        <LoadingIndicator label="Loading race" />
      )}
      {raceLoad && (
        <Group>
          {raceLoad.status === "failed" && requestedKey !== undefined && (
            <Button onClick={() => chooseRace(requestedKey)}>
              Retry race selection
            </Button>
          )}
          <Button variant="default" onClick={cancelRaceSelection}>
            Cancel race selection
          </Button>
        </Group>
      )}
      <RacialSkillChoices
        snapshot={snapshot}
        disabled={raceLoad !== undefined}
        chooseRacialBonus={chooseRacialBonus}
      />
    </Stack>
  );
}
