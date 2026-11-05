import { useEffect, useRef, useState } from "react";
import {
  CharacterCreator,
  Characteristic,
  validateCharacteristicGeneration,
} from "@wayshrine/core";
import type {
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationMethod,
  CharacteristicRoll,
  ContentCatalog,
  WizardResult,
} from "@wayshrine/core";
import { isBlockingContentIssue } from "./issues";
import type { CharacteristicRoller } from "./steps/characteristics/dice";

function createSession(catalog: ContentCatalog) {
  const creator = new CharacterCreator(catalog);
  creator.setCharacteristicGenerationMethod("rolled");
  return {
    creator,
    live: true,
    requests: new Map<string, object>(),
    errorOpened: false,
    pointBuySelected: false,
    poolSubmitted: false,
    unlimitedRerolls: false,
    rerollBatchSpent: false,
  };
}

type Session = ReturnType<typeof createSession>;

function acquireReplacementPool(
  previous: readonly CharacteristicRoll[],
  selected: ReadonlySet<string>,
  rollDice: CharacteristicRoller,
) {
  const originalIds = new Set(previous.map((roll) => roll.id));
  const rolls: CharacteristicRoll[] = [];
  for (const roll of previous) {
    if (!selected.has(roll.id)) {
      rolls.push(roll);
      continue;
    }
    const replacement = rollDice();
    if (originalIds.has(replacement.id)) return;
    rolls.push(replacement);
  }
  const issues = validateCharacteristicGeneration({ method: "rolled", rolls });
  if (issues.some((issue) => issue.field === "rolls")) return;
  return rolls;
}

function unaffectedAssignments(
  previous: CharacteristicAssignments,
  selected: ReadonlySet<string>,
) {
  const assignments = { ...previous };
  for (const key of Object.values(Characteristic)) {
    if (selected.has(assignments[key] ?? "")) delete assignments[key];
  }
  return assignments;
}

function initializePointBuy(session: Session) {
  if (session.pointBuySelected) return;
  session.pointBuySelected = true;
  const allocations =
    session.creator.getSnapshot().characteristicGeneration.drafts.pointBuy
      .allocations;
  if (Object.keys(allocations).length > 0) return;
  session.creator.setCharacteristicAllocations({
    str: 0,
    end: 0,
    ag: 0,
    int: 0,
    wp: 0,
    prc: 0,
    prs: 0,
  });
}

function readSession(session: Session) {
  return {
    snapshot: session.creator.getSnapshot(),
    preview: session.creator.getCharacterPreview(),
    errorOpened: session.errorOpened,
    unlimitedRerolls: session.unlimitedRerolls,
    rerollBatchSpent: session.rerollBatchSpent,
  };
}

export function useCharacterCreator(catalog: ContentCatalog) {
  const sessionRef = useRef<Session | undefined>(undefined);
  const [view, setView] = useState<ReturnType<typeof readSession>>();

  useEffect(() => {
    const session = createSession(catalog);
    sessionRef.current = session;
    setView(readSession(session));
    return () => {
      session.live = false;
      session.creator.dispose();
      sessionRef.current = undefined;
    };
  }, [catalog]);

  // Commands from this render stay bound to this session, including after await.
  const session = sessionRef.current;

  function refresh() {
    if (session?.live) setView(readSession(session));
  }

  async function select(
    operation: string,
    command: () => Promise<WizardResult>,
  ) {
    if (!session?.live) return;
    const request = {};
    session.requests.set(operation, request);
    session.errorOpened = false;
    const pending = command();
    refresh();
    const result = await pending;
    if (!session.live || session.requests.get(operation) !== request) return;
    reportBlockingIssues(result);
    refresh();
  }

  function reportBlockingIssues(result: WizardResult<unknown>) {
    if (!session?.live || result.ok) return;
    const failures = result.issues.filter(isBlockingContentIssue);
    if (failures.length === 0) return;
    // Core returns detached issues, not the adapter's original Error/cause.
    console.error("Character content selection failed.", failures);
    session.errorOpened = true;
  }

  function dismissError() {
    if (!session?.live) return;
    session.errorOpened = false;
    refresh();
  }

  function setName(name: string) {
    if (!session?.live) return;
    session.creator.setName(name);
    refresh();
  }

  function chooseRace(key: string) {
    if (!session?.live) return;
    session.requests.clear();
    void select("race", () => session.creator.chooseRace(key));
  }

  function setFavoredCharacteristics(favored: readonly Characteristic[]) {
    if (!session?.live) return;
    const result = session.creator.setFavoredCharacteristics(favored);
    refresh();
    return result;
  }

  function setCharacteristicGenerationMethod(
    method: CharacteristicGenerationMethod,
  ) {
    if (!session?.live) return;
    const result = session.creator.setCharacteristicGenerationMethod(method);
    if (result.ok && method === "point-buy") initializePointBuy(session);
    refresh();
    // This is the method command's result; full validation stays in the snapshot.
    return result;
  }

  function submitCharacteristicRolls(rolls: readonly CharacteristicRoll[]) {
    if (!session?.live || session.poolSubmitted) return;
    const result = session.creator.submitCharacteristicRolls(rolls);
    if (result.ok) session.poolSubmitted = true;
    refresh();
    return result;
  }

  function setUnlimitedRerolls(enabled: boolean) {
    if (!session?.live) return;
    session.unlimitedRerolls = enabled;
    refresh();
  }

  function rerollCharacteristics(
    ids: readonly string[],
    rollDice: CharacteristicRoller,
  ) {
    if (!session?.live || !session.poolSubmitted) return false;
    const drafts =
      session.creator.getSnapshot().characteristicGeneration.drafts;
    const selected = new Set(ids);
    const limit = session.unlimitedRerolls ? 7 : 3;
    if (
      drafts.method !== "rolled" ||
      selected.size === 0 ||
      selected.size !== ids.length ||
      selected.size > limit
    )
      return false;
    if (!session.unlimitedRerolls && session.rerollBatchSpent) return false;
    const previous = drafts.rolled;
    const poolIds = new Set(previous.rolls.map((roll) => roll.id));
    if (ids.some((id) => !poolIds.has(id))) return false;
    // Acquisition failures must not destroy answers or consume the session's batch.
    const rolls = acquireReplacementPool(previous.rolls, selected, rollDice);
    if (!rolls || !session.live) return false;
    const result = session.creator.submitCharacteristicRolls(rolls);
    if (!result.ok) {
      session.creator.submitCharacteristicRolls(previous.rolls);
      session.creator.setCharacteristicAssignments(previous.assignments);
      refresh();
      return false;
    }
    session.creator.setCharacteristicAssignments(
      unaffectedAssignments(previous.assignments, selected),
    );
    session.rerollBatchSpent = true;
    refresh();
    return true;
  }

  function setCharacteristicAssignments(
    assignments: CharacteristicAssignments,
  ) {
    if (!session?.live) return;
    const result = session.creator.setCharacteristicAssignments(assignments);
    refresh();
    return result;
  }

  function setCharacteristicAllocations(
    allocations: CharacteristicAllocations,
  ) {
    if (!session?.live) return;
    const result = session.creator.setCharacteristicAllocations(allocations);
    refresh();
    return result;
  }

  function submitLuckRoll(roll: CharacteristicRoll) {
    if (!session?.live) return;
    const result = session.creator.submitLuckRoll(roll);
    refresh();
    return result;
  }

  function cancelRaceSelection() {
    if (!session?.live) return;
    session.requests.delete("race");
    session.errorOpened = false;
    session.creator.cancelRaceSelection();
    refresh();
  }

  function chooseRacialBonus(id: string, selections: readonly string[]) {
    if (!session?.live) return;
    void select(id, () => session.creator.chooseRacialBonus(id, selections));
  }

  function next() {
    if (!session?.live) return;
    const result = session.creator.next();
    reportBlockingIssues(result);
    refresh();
  }

  function previous() {
    if (!session?.live) return;
    const result = session.creator.previous();
    reportBlockingIssues(result);
    refresh();
  }

  return {
    view,
    setName,
    setFavoredCharacteristics,
    setCharacteristicGenerationMethod,
    submitCharacteristicRolls,
    setUnlimitedRerolls,
    rerollCharacteristics,
    setCharacteristicAssignments,
    setCharacteristicAllocations,
    submitLuckRoll,
    chooseRace,
    cancelRaceSelection,
    chooseRacialBonus,
    dismissError,
    next,
    previous,
  };
}
