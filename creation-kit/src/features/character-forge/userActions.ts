import type {
  CharacterCreationSnapshot,
  CharacteristicGenerationField,
  CharacteristicGenerationSnapshot,
} from "@wayshrine/core";
import type { UserAction } from "./components/ToContinue";

type RaceIndexStatus = "loading" | "error" | "empty" | "ready";

const raceSelectionLabels: Record<RaceIndexStatus, string> = {
  loading: "loading races",
  error: "retry loading races",
  empty: "race content unavailable",
  ready: "choose a race",
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
            ? "loading race selection"
            : "retry or cancel race selection",
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
      label: "review race selection or choose another race",
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
    let label = `choose ${group.choose} ${group.choose === 1 ? "skill" : "skills"}`;
    if (load?.status === "loading") label = "loading available skills";
    else if (load?.status === "failed" || unresolved)
      label = "there is a problem with the selected skill";
    else if (
      race.issues.some(
        (issue) =>
          issue.choiceId === group.id && issue.code !== "selection-count",
      )
    ) {
      label = "review skill selection";
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
  { field: "favored", label: "choose two favored characteristics" },
  { field: "rolls", label: "make a characteristic roll" },
  { field: "assignments", label: "assign all characteristic rolls" },
  { field: "allocations", label: "allocate characteristic points" },
  { field: "luck", label: "roll Luck" },
];

export function characteristicUserActions(
  generation: CharacteristicGenerationSnapshot,
  raceComplete: boolean,
): UserAction[] {
  const actions: UserAction[] = [];
  if (!raceComplete) {
    actions.push({
      id: "race",
      label: "resolve issues in previous step(s)",
    });
  }
  for (const task of generationTasks) {
    if (generation.issues.some((issue) => issue.field === task.field)) {
      actions.push({ id: task.field, label: task.label });
    }
  }
  return actions;
}
