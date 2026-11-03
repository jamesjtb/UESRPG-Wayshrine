import { Button, Group, Select, Stack, Text, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import type {
  CharacterCreationSnapshot,
  ContentCatalog,
  ContentSummary,
} from "@wayshrine/core";
import { readableLabel } from "./labels";
import { RacialSkillChoices } from "./RacialSkillChoices";
import { ErrorModal } from "../../components/ErrorModal";
import { isBlockingContentIssue } from "./issues";
import { LoadingIndicator } from "../../components/LoadingIndicator";

type RaceIndex =
  | { status: "loading" }
  | { status: "ready"; entries: readonly ContentSummary[] }
  | { status: "error"; acknowledged: boolean };

interface RaceStepProps {
  catalog: ContentCatalog;
  snapshot: CharacterCreationSnapshot;
  chooseRace: (key: string) => void;
  cancelRaceSelection: () => void;
  chooseRacialBonus: (id: string, selections: readonly string[]) => void;
}

export function RaceStep({
  catalog,
  snapshot,
  chooseRace,
  cancelRaceSelection,
  chooseRacialBonus,
}: RaceStepProps) {
  const [index, setIndex] = useState<RaceIndex>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setIndex({ status: "loading" });
    function ready(entries: readonly ContentSummary[]) {
      if (live) setIndex({ status: "ready", entries });
    }
    function failed(error: unknown) {
      if (!live) return;
      console.error("Race index loading failed.", error);
      setIndex({ status: "error", acknowledged: false });
    }
    void Promise.resolve()
      .then(() => catalog.list("race"))
      .then(ready, failed);
    return () => {
      live = false;
    };
  }, [catalog, attempt]);

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
      issue.code !== "content-loading" &&
      !isBlockingContentIssue(issue),
  );

  return (
    <Stack>
      <Title order={2}>Select Race</Title>
      {index.status === "loading" && <LoadingIndicator label="Loading races" />}
      {index.status === "error" && (
        <Stack gap="xs">
          <ErrorModal
            opened={!index.acknowledged}
            onClose={() => setIndex({ status: "error", acknowledged: true })}
          />
          <Button variant="default" onClick={() => setAttempt(attempt + 1)}>
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
