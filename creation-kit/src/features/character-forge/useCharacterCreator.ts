import { useEffect, useRef, useState } from "react";
import { CharacterCreator, Characteristic } from "@wayshrine/core";
import type {
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationMethod,
  CharacteristicRerollReplacement,
  CharacteristicRoll,
  ContentCatalog,
  WizardResult,
  BirthsignRoll,
  BirthsignSelection,
  ChoiceAnswer,
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
  };
}

type Session = ReturnType<typeof createSession>;

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
    if (!session?.live) return;
    const result = session.creator.submitCharacteristicRolls(rolls);
    refresh();
    return result;
  }

  function setUnlimitedCharacteristicRerolls(enabled: boolean) {
    if (!session?.live) return;
    const result = session.creator.setUnlimitedCharacteristicRerolls(enabled);
    refresh();
    return result;
  }

  function reportDiceAcquisitionFailure(error: unknown) {
    if (!session?.live) return;
    console.error("Characteristic dice acquisition failed.", error);
    session.errorOpened = true;
    refresh();
  }

  function rerollCharacteristics(
    ids: readonly string[],
    rollDice: CharacteristicRoller,
    rerollLuck = false,
  ) {
    if (!session?.live) return;
    const replacements: CharacteristicRerollReplacement[] = [];
    let luckReplacement: CharacteristicRoll | undefined;
    try {
      for (const targetRollId of ids) {
        replacements.push({ targetRollId, replacement: rollDice() });
        if (!session.live) return;
      }
      if (rerollLuck) luckReplacement = rollDice();
      if (!session.live) return;
    } catch (error) {
      reportDiceAcquisitionFailure(error);
      return;
    }
    const result = session.creator.rerollCharacteristics(
      replacements,
      luckReplacement,
    );
    refresh();
    return result;
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

  async function birthsignCommand(
    command: () => ReturnType<CharacterCreator["chooseBirthsign"]>,
  ) {
    if (!session?.live) return;
    const request = {};
    session.requests.set("birthsign", request);
    const pending = command();
    refresh();
    const result = await pending;
    if (!session.live || session.requests.get("birthsign") !== request) return;
    reportBlockingIssues(result);
    refresh();
    return result;
  }

  function submitBirthsignRoll(roll: BirthsignRoll) {
    return birthsignCommand(() => session!.creator.submitBirthsignRoll(roll));
  }

  function chooseBirthsignWithAnswers(
    selection: BirthsignSelection,
    answers: readonly ChoiceAnswer<string>[],
  ) {
    return birthsignCommand(() =>
      session!.creator.chooseBirthsignWithAnswers(selection, answers),
    );
  }

  function restoreOriginalBirthsign() {
    return birthsignCommand(() => session!.creator.restoreOriginalBirthsign());
  }

  function chooseBirthsignBonus(id: string, selections: readonly string[]) {
    if (!session?.live) return;
    const result = session.creator.chooseBirthsignBonus(id, selections);
    refresh();
    return result;
  }

  function setFreeBirthsignChoice(enabled: boolean) {
    if (!session?.live) return;
    const result = session.creator.setFreeBirthsignChoice(enabled);
    refresh();
    return result;
  }

  function quoteBirthsign(
    selection: BirthsignSelection,
    answers: readonly ChoiceAnswer<string>[],
  ) {
    if (!session?.live) return;
    return session.creator.quoteBirthsign(selection, answers);
  }

  function cancelBirthsignSelection() {
    if (!session?.live) return;
    session.requests.delete("birthsign");
    session.creator.cancelBirthsignSelection();
    refresh();
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
    setUnlimitedCharacteristicRerolls,
    rerollCharacteristics,
    reportDiceAcquisitionFailure,
    setCharacteristicAssignments,
    setCharacteristicAllocations,
    submitLuckRoll,
    chooseRace,
    cancelRaceSelection,
    chooseRacialBonus,
    dismissError,
    next,
    previous,
    submitBirthsignRoll,
    chooseBirthsignWithAnswers,
    chooseBirthsignBonus,
    restoreOriginalBirthsign,
    setFreeBirthsignChoice,
    quoteBirthsign,
    cancelBirthsignSelection,
  };
}
