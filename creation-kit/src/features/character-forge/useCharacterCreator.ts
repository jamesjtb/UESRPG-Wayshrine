import { useEffect, useRef, useState } from "react";
import { CharacterCreator } from "@wayshrine/core";
import type { ContentCatalog, WizardResult } from "@wayshrine/core";
import { isBlockingContentIssue } from "./issues";

function createSession(catalog: ContentCatalog) {
  return {
    creator: new CharacterCreator(catalog),
    live: true,
    requests: new Map<string, object>(),
    errorOpened: false,
  };
}

type Session = ReturnType<typeof createSession>;

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

  function chooseRace(key: string) {
    if (!session?.live) return;
    session.requests.clear();
    void select("race", () => session.creator.chooseRace(key));
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
    chooseRace,
    cancelRaceSelection,
    chooseRacialBonus,
    dismissError,
    next,
    previous,
  };
}
