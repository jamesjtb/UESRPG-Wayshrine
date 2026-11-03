import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "@wayshrine/core";
import { controlledReads } from "./forgeTestHelpers";
import { fixtureCatalog } from "./testCatalog";
import { useCharacterCreator } from "./useCharacterCreator";

describe("useCharacterCreator command boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("acknowledges an unknown choice without changing committed answers", async () => {
    // Unknown IDs cannot be entered through the snapshot-driven checkbox controls.
    const catalog = fixtureCatalog();
    const { result } = renderHook(() => useCharacterCreator(catalog), {
      wrapper: StrictMode,
    });
    await act(async () => result.current.chooseRace("altmer"));
    await act(async () =>
      result.current.chooseRacialBonus("altmer/magic", ["alchemy"]),
    );
    const answers = result.current.view!.snapshot.answers;
    await act(async () =>
      result.current.chooseRacialBonus("obsolete/group", ["alchemy"]),
    );
    expect(result.current.view!.errorOpened).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      [{ code: "unknown-choice", message: "Unknown racial bonus choice." }],
    );
    expect(result.current.view!.snapshot.answers).toEqual(answers);
    expect(
      result.current.view!.preview.skills.map(
        (training) => training.skill.skillKey,
      ),
    ).toEqual(["alchemy"]);
    act(() => result.current.dismissError());
    expect(result.current.view!.errorOpened).toBe(false);
    expect(result.current.view!.snapshot.answers).toEqual(answers);
  });

  it("does not publish an older transient unknown-choice result after a newer race command", async () => {
    const catalog = fixtureCatalog();
    const { result } = renderHook(() => useCharacterCreator(catalog));
    await act(async () => result.current.chooseRace("altmer"));
    await act(async () => {
      result.current.chooseRacialBonus("obsolete/group", []);
      result.current.chooseRace("argonian");
    });
    expect(result.current.view!.snapshot.answers.raceKey).toBe("argonian");
    expect(result.current.view!.errorOpened).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it("reports only the latest unknown-race result and preserves the committed answer", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const old = reads.hold("race", "unknown");
    const { result } = renderHook(() => useCharacterCreator(catalog));
    await act(async () => result.current.chooseRace("altmer"));
    await act(async () => {
      result.current.chooseRace("unknown");
      result.current.chooseRace("argonian");
    });
    await act(async () => old.resolve());
    expect(result.current.view!.snapshot.answers.raceKey).toBe("argonian");
    expect(result.current.view!.errorOpened).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
    await act(async () => result.current.chooseRace("unknown"));
    expect(result.current.view!.snapshot.answers.raceKey).toBe("argonian");
    expect(result.current.view!.preview.race?.label).toBe("Argonian");
    expect(result.current.view!.errorOpened).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      [{ code: "unknown-race", message: "Unknown race." }],
    );
  });

  it("retains committed answers internally while a race change is pending and failed, then restores them on cancel", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const race = reads.hold("race", "argonian");
    const { result } = renderHook(() => useCharacterCreator(catalog));
    await act(async () => result.current.chooseRace("altmer"));
    await act(async () =>
      result.current.chooseRacialBonus("altmer/magic", ["alchemy"]),
    );
    const answers = result.current.view!.snapshot.answers;
    act(() => result.current.chooseRace("argonian"));
    expect(result.current.view!.snapshot.answers).toEqual(answers);
    expect(result.current.view!.preview.race).toBeUndefined();
    expect(result.current.view!.preview.skills).toEqual([]);
    await act(async () => race.reject(new Error("offline")));
    expect(result.current.view!.snapshot.answers).toEqual(answers);
    expect(result.current.view!.preview.race).toBeUndefined();
    expect(result.current.view!.preview.skills).toEqual([]);
    act(() => result.current.dismissError());
    expect(result.current.view!.snapshot.contentLoads[0]?.status).toBe(
      "failed",
    );
    act(() => result.current.cancelRaceSelection());
    expect(result.current.view!.snapshot.answers).toEqual(answers);
    expect(result.current.view!.snapshot.contentLoads).toEqual([]);
    expect(
      result.current.view!.preview.skills.map(
        (training) => training.skill.skillKey,
      ),
    ).toEqual(["alchemy"]);
    expect(result.current.view!.errorOpened).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("delegates navigation to the real race-only creator without advancing or finishing in any state", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pending = reads.hold("race", "altmer");
    const failed = reads.hold("skill", "alchemy");
    const next = vi.spyOn(CharacterCreator.prototype, "next");
    const previous = vi.spyOn(CharacterCreator.prototype, "previous");
    const finish = vi.spyOn(CharacterCreator.prototype, "finish");
    const { result } = renderHook(() => useCharacterCreator(catalog));

    function expectBlockedNavigation(code: string) {
      const before = result.current.view!.snapshot.answers;
      act(() => result.current.previous());
      expect(previous.mock.results.at(-1)?.value).toEqual({
        ok: false,
        issues: [{ code: "first-step", message: "Already at the first step." }],
      });
      act(() => result.current.next());
      expect(next.mock.results.at(-1)?.value).toMatchObject({
        ok: false,
        issues: expect.arrayContaining([expect.objectContaining({ code })]),
      });
      expect(result.current.view!.snapshot.currentStep).toBe("race");
      expect(result.current.view!.snapshot.canGoPrevious).toBe(false);
      expect(result.current.view!.snapshot.canGoNext).toBe(false);
      expect(result.current.view!.snapshot.answers).toEqual(before);
    }

    expectBlockedNavigation("race-required");
    act(() => result.current.chooseRace("altmer"));
    expectBlockedNavigation("content-loading");
    await act(async () => pending.resolve());
    await act(async () =>
      result.current.chooseRacialBonus("altmer/magic", [
        "alchemy",
        "alteration",
      ]),
    );
    expectBlockedNavigation("selection-count");
    expect(result.current.view!.errorOpened).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
    act(() => result.current.chooseRacialBonus("altmer/magic", ["alchemy"]));
    expectBlockedNavigation("content-loading");
    await act(async () => failed.reject(new Error("offline")));
    expectBlockedNavigation("content-unavailable");
    act(() => result.current.dismissError());
    await act(async () =>
      result.current.chooseRacialBonus("altmer/magic", ["alchemy"]),
    );
    await waitFor(() =>
      expect(result.current.view!.snapshot.canFinish).toBe(true),
    );
    expectBlockedNavigation("last-step");
    expect(result.current.view!.errorOpened).toBe(false);
    expect(result.current.view!.preview.skills).toHaveLength(1);
    expect(finish).not.toHaveBeenCalled();
  });
});
