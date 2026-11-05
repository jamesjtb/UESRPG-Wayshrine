import type {
  CharacterCreationSnapshot,
  CharacteristicGenerationField,
  CharacteristicGenerationSnapshot,
} from "@wayshrine/core";
import type { UserAction } from "./components/ToContinue";

type RaceIndexStatus = "loading" | "error" | "empty" | "ready";

const raceSelectionLabels: Record<RaceIndexStatus, string> = {
  loading: "Loading available races",
  error: "Retry loading races",
  empty: "Resolve unavailable race content",
  ready: "Choose a race",
};

export function raceUserActions(
  snapshot: CharacterCreationSnapshot,
  raceIndexStatus: RaceIndexStatus,
): UserAction[] {
  const race = snapshot.steps.find((step) => step.id === "race");
  if (!race || race.complete) return [];

  const raceLoad = snapshot.contentLoads.find(
    (load) => load.operation.kind === "race",
  );
  // Retained choices cannot be edited until the race request is resolved.
  if (raceLoad) {
    return [
      {
        id: "race-content",
        label:
          raceLoad.status === "loading"
            ? "Loading race selection"
            : "Retry or cancel race selection",
        ...(raceLoad.status === "loading" ? { loading: true } : {}),
      },
    ];
  }

  const actions: UserAction[] = [];
  const globalIssues = race.issues.filter(
    (issue) => issue.choiceId === undefined,
  );
  if (globalIssues.some((issue) => issue.code === "race-required")) {
    actions.push({
      id: "race",
      label: raceSelectionLabels[raceIndexStatus],
      ...(raceIndexStatus === "loading" ? { loading: true } : {}),
    });
  } else if (globalIssues.length > 0) {
    actions.push({
      id: "race-content",
      label: "Review race selection or choose another race",
    });
  }

  for (const group of race.pendingChoices) {
    const load = snapshot.contentLoads.find(
      (candidate) =>
        candidate.operation.kind === "racial-bonus" &&
        candidate.operation.choiceId === group.id,
    );
    const unresolved = race.issues.some(
      (issue) =>
        issue.choiceId === group.id && issue.code === "content-unresolved",
    );
    let label = `Choose ${group.choose} racial ${group.choose === 1 ? "skill" : "skills"}`;
    if (load?.status === "loading") label = "Loading racial skills";
    else if (load?.status === "failed" || unresolved)
      label = "Retry racial skill selection";
    else if (
      race.issues.some(
        (issue) =>
          issue.choiceId === group.id && issue.code !== "selection-count",
      )
    ) {
      label = "Review racial skill selection";
    }
    actions.push({
      id: group.id,
      label,
      ...(load?.status === "loading" ? { loading: true } : {}),
    });
  }
  return actions;
}

const generationTasks: readonly {
  field: CharacteristicGenerationField;
  label: string;
}[] = [
  { field: "favored", label: "Choose two favored characteristics" },
  { field: "method", label: "Choose a generation method" },
  { field: "rolls", label: "Roll characteristic results" },
  { field: "assignments", label: "Assign all characteristic results" },
  { field: "allocations", label: "Allocate characteristic points" },
  { field: "luck", label: "Roll Luck" },
];

export function characteristicUserActions(
  generation: CharacteristicGenerationSnapshot,
  raceComplete: boolean,
): UserAction[] {
  const actions: UserAction[] = [];
  if (!raceComplete) {
    actions.push({
      id: "race",
      label: "Return to Select Race to resolve outstanding actions",
    });
  }
  for (const task of generationTasks) {
    if (generation.issues.some((issue) => issue.field === task.field)) {
      actions.push({ id: task.field, label: task.label });
    }
  }
  return actions;
}
