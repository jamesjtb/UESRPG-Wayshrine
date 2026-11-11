import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "@wayshrine/core";
import type {
  Characteristic,
  CharacteristicAssignments,
} from "@wayshrine/core";
import { controlledReads } from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";
import { useCharacterCreator } from "./useCharacterCreator";

const zeroAllocations = {
  str: 0,
  end: 0,
  ag: 0,
  int: 0,
  wp: 0,
  prc: 0,
  prs: 0,
};

describe("useCharacterCreator command boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("exposes only detached presentation data and named commands", () => {
    const catalog = fixtureCatalog();
    const { result } = renderHook(() => useCharacterCreator(catalog));
    expect(Object.keys(result.current).sort()).toEqual([
      "cancelBirthsignSelection",
      "cancelRaceSelection",
      "chooseBirthsignBonus",
      "chooseBirthsignWithAnswers",
      "chooseRace",
      "chooseRacialBonus",
      "dismissError",
      "next",
      "previous",
      "quoteBirthsign",
      "reportDiceAcquisitionFailure",
      "rerollCharacteristics",
      "restoreOriginalBirthsign",
      "setCharacteristicAllocations",
      "setCharacteristicAssignments",
      "setCharacteristicGenerationMethod",
      "setFavoredCharacteristics",
      "setFreeBirthsignChoice",
      "setName",
      "setUnlimitedCharacteristicRerolls",
      "submitBirthsignRoll",
      "submitCharacteristicRolls",
      "submitLuckRoll",
      "view",
    ]);
    expect(Object.keys(result.current.view!).sort()).toEqual([
      "errorOpened",
      "preview",
      "snapshot",
    ]);
  });

  it("initializes rolled generation through Core for every new session without changing Core defaults", () => {
    const catalog = fixtureCatalog();
    const coreCreator = new CharacterCreator(catalog);
    expect(
      coreCreator.getSnapshot().characteristicGeneration.drafts.method,
    ).toBeUndefined();
    coreCreator.dispose();
    const method = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicGenerationMethod",
    );
    const { result, rerender } = renderHook(
      ({ content }) => useCharacterCreator(content),
      { initialProps: { content: catalog }, wrapper: StrictMode },
    );
    expect(method).toHaveBeenCalledWith("rolled");
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts,
    ).toEqual({
      method: "rolled",
      favored: [],
      luck: undefined,
      rolled: { rolls: [], assignments: {} },
      pointBuy: { allocations: {} },
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.complete,
    ).toBe(false);
    act(() => result.current.setCharacteristicGenerationMethod("point-buy"));
    method.mockClear();
    rerender({ content: fixtureCatalog() });
    expect(method).toHaveBeenCalledExactlyOnceWith("rolled");
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.method,
    ).toBe("rolled");
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({});
  });

  it("publishes immediate pending and settled snapshots for race and bonus commands", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const race = reads.hold("race", "altmer");
    const skill = reads.hold("skill", "alchemy");
    const { result } = renderHook(() => useCharacterCreator(catalog));
    act(() => result.current.chooseRace("altmer"));
    expect(result.current.view!.snapshot.contentLoads).toEqual([
      expect.objectContaining({ status: "loading" }),
    ]);
    expect(result.current.view!.preview.race).toBeUndefined();
    await act(async () => race.resolve());
    expect(result.current.view!.snapshot.contentLoads).toEqual([]);
    expect(result.current.view!.snapshot.answers.raceKey).toBe("altmer");
    expect(result.current.view!.preview.race).toBeDefined();
    act(() => result.current.chooseRacialBonus("altmer/magic", ["alchemy"]));
    expect(result.current.view!.snapshot.contentLoads).toEqual([
      expect.objectContaining({ status: "loading" }),
    ]);
    expect(result.current.view!.preview.skills).toEqual([]);
    await act(async () => skill.resolve());
    expect(result.current.view!.snapshot.contentLoads).toEqual([]);
    expect(result.current.view!.preview.skills[0]?.skill.skillKey).toBe(
      "alchemy",
    );
  });

  it("initializes point buy only on its first selection and preserves partial and cleared drafts", () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const allocations = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAllocations",
    );
    const { result } = renderHook(() => useCharacterCreator(catalog), {
      wrapper: StrictMode,
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({});
    act(() => result.current.setCharacteristicGenerationMethod("rolled"));
    expect(allocations).not.toHaveBeenCalled();
    act(() => {
      expect(
        result.current.setCharacteristicGenerationMethod("point-buy"),
      ).toEqual({ ok: true, value: undefined });
    });
    expect(allocations).toHaveBeenCalledExactlyOnceWith(zeroAllocations);
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual(zeroAllocations);
    expect(
      result.current.view!.snapshot.characteristicGeneration.complete,
    ).toBe(false);
    act(() => result.current.setCharacteristicGenerationMethod("point-buy"));
    expect(allocations).toHaveBeenCalledTimes(1);
    act(() => {
      result.current.setCharacteristicAllocations({ str: 4 });
      result.current.setCharacteristicGenerationMethod("rolled");
      result.current.setCharacteristicGenerationMethod("point-buy");
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({ str: 4 });
    act(() => {
      result.current.setCharacteristicAllocations({});
      result.current.setCharacteristicGenerationMethod("rolled");
      result.current.setCharacteristicGenerationMethod("point-buy");
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({});
    expect(allocations).toHaveBeenCalledTimes(3);
    expect(reads.get).not.toHaveBeenCalled();
    expect(result.current.view!.errorOpened).toBe(false);
  });

  it.each([{ str: 7 }, { str: -1 }])(
    "preserves prepopulated inactive point-buy draft %j on first selection",
    (draft) => {
      const catalog = fixtureCatalog();
      const allocations = vi.spyOn(
        CharacterCreator.prototype,
        "setCharacteristicAllocations",
      );
      const { result } = renderHook(() => useCharacterCreator(catalog));
      act(() => result.current.setCharacteristicAllocations(draft));
      expect(
        result.current.view!.snapshot.characteristicGeneration.drafts.method,
      ).toBe("rolled");
      act(() => result.current.setCharacteristicGenerationMethod("point-buy"));
      expect(allocations).toHaveBeenCalledExactlyOnceWith(draft);
      expect(
        result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
          .allocations,
      ).toEqual(draft);
      act(() => {
        result.current.setCharacteristicAllocations({});
        result.current.setCharacteristicGenerationMethod("rolled");
        result.current.setCharacteristicGenerationMethod("point-buy");
      });
      expect(
        result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
          .allocations,
      ).toEqual({});
      expect(result.current.view!.errorOpened).toBe(false);
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it("binds first-selection tracking to each session and ignores stale initialization callbacks", () => {
    const allocations = vi.spyOn(
      CharacterCreator.prototype,
      "setCharacteristicAllocations",
    );
    const { result, rerender, unmount } = renderHook(
      ({ catalog }) => useCharacterCreator(catalog),
      {
        initialProps: { catalog: fixtureCatalog() },
        wrapper: StrictMode,
      },
    );
    const oldCommands = result.current;
    act(() => oldCommands.setCharacteristicGenerationMethod("point-buy"));
    expect(allocations).toHaveBeenCalledTimes(1);
    rerender({ catalog: fixtureCatalog() });
    const replacementView = result.current.view;
    act(() => oldCommands.setCharacteristicGenerationMethod("point-buy"));
    expect(result.current.view).toBe(replacementView);
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({});
    act(() => result.current.setCharacteristicGenerationMethod("point-buy"));
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual(zeroAllocations);
    expect(allocations).toHaveBeenCalledTimes(2);
    const retained = result.current.setCharacteristicGenerationMethod;
    unmount();
    act(() => expect(retained("point-buy")).toBeUndefined());
    expect(allocations).toHaveBeenCalledTimes(2);
  });

  it("refreshes generation drafts and previews while preserving invalid and inactive edits", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pending = reads.hold("race", "argonian");
    const { result, unmount } = renderHook(() => useCharacterCreator(catalog));
    const keys: Characteristic[] = [
      "str",
      "end",
      "ag",
      "int",
      "wp",
      "prc",
      "prs",
    ];
    const rolls = keys.map((key) => ({ id: key, dice: [5, 6] }));
    const assignments: CharacteristicAssignments = {
      str: "str",
      end: "end",
      ag: "ag",
      int: "int",
      wp: "wp",
      prc: "prc",
      prs: "prs",
    };
    act(() => {
      const invalid = result.current.submitCharacteristicRolls([
        { id: "bad-roll", dice: [0, 11] },
      ]);
      expect(invalid).toMatchObject({ ok: false });
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.rolled
        .rolls,
    ).toEqual([{ id: "bad-roll", dice: [0, 11] }]);
    act(() => {
      result.current.setFavoredCharacteristics(["str", "end"]);
      result.current.setCharacteristicGenerationMethod("rolled");
      result.current.submitCharacteristicRolls(rolls);
      result.current.setCharacteristicAssignments(assignments);
      result.current.submitLuckRoll({ id: "luck", dice: [6, 7] });
    });
    expect(reads.get).not.toHaveBeenCalled();
    expect(
      result.current.view!.snapshot.characteristicGeneration.complete,
    ).toBe(true);
    expect(result.current.view!.preview.characteristics.str.rolled).toBe(0);
    act(() => result.current.chooseRace("argonian"));
    act(() => result.current.setCharacteristicAllocations({ str: -1 }));
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.pointBuy
        .allocations,
    ).toEqual({ str: -1 });
    expect(
      result.current.view!.snapshot.characteristicGeneration.complete,
    ).toBe(true);
    await act(async () => pending.resolve());
    expect(result.current.view!.preview.characteristics.str).toMatchObject({
      rolled: 11,
      favored: true,
    });
    expect(result.current.view!.preview.characteristics.lck.rolled).toBe(13);
    act(() => result.current.setCharacteristicGenerationMethod("point-buy"));
    expect(
      result.current.view!.snapshot.characteristicGeneration.issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "allocations",
          characteristic: "str",
        }),
      ]),
    );
    expect(result.current.view!.preview.characteristics.str.rolled).toBe(0);
    act(() => result.current.setCharacteristicGenerationMethod("rolled"));
    expect(result.current.view!.preview.characteristics.str.rolled).toBe(11);
    act(() => result.current.setCharacteristicAssignments({ str: "missing" }));
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.rolled
        .assignments,
    ).toEqual({ str: "missing" });
    expect(result.current.view!.preview.characteristics.str.rolled).toBe(0);
    act(() => result.current.setCharacteristicAssignments(assignments));
    act(() => {
      expect(result.current.submitCharacteristicRolls(rolls)).toMatchObject({
        ok: false,
        issues: [{ code: "pool-initialized" }],
      });
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.rolled
        .assignments,
    ).toEqual(assignments);
    act(() => {
      result.current.setFavoredCharacteristics(["str", "str"]);
      result.current.setUnlimitedCharacteristicRerolls(true);
      result.current.submitLuckRoll({ id: "bad-luck", dice: [0, 11] });
    });
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.favored,
    ).toEqual(["str", "str"]);
    expect(
      result.current.view!.snapshot.characteristicGeneration.drafts.luck,
    ).toEqual({ id: "bad-luck", dice: [0, 11] });
    expect(result.current.view!.preview.characteristics.str.favored).toBe(
      false,
    );
    expect(result.current.view!.preview.characteristics.lck.rolled).toBe(0);
    expect(result.current.view!.errorOpened).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
    const retained = result.current;
    unmount();
    act(() => {
      retained.setFavoredCharacteristics([]);
      retained.setCharacteristicGenerationMethod("rolled");
      retained.submitCharacteristicRolls([]);
      retained.setCharacteristicAssignments({});
      retained.setCharacteristicAllocations({});
      retained.submitLuckRoll({ id: "late", dice: [1, 1] });
    });
  });

  it("publishes name edits immediately without disturbing pending or failed loads", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const race = reads.hold("race", "altmer");
    const { result, unmount } = renderHook(() => useCharacterCreator(catalog));
    for (const name of ["N", "Ne", ""]) {
      act(() => result.current.setName(name));
      expect(result.current.view!.snapshot.answers.name).toBe(name);
      expect(result.current.view!.preview.name).toBe(name);
    }
    expect(reads.get).not.toHaveBeenCalled();
    act(() => result.current.chooseRace("altmer"));
    act(() => result.current.setName("Pending"));
    expect(result.current.view!.preview.name).toBe("Pending");
    expect(result.current.view!.snapshot.contentLoads[0]?.status).toBe(
      "loading",
    );
    await act(async () => race.reject(new Error("offline")));
    act(() => result.current.setName("Failed"));
    expect(result.current.view!.preview.name).toBe("Failed");
    expect(result.current.view!.snapshot.contentLoads[0]?.status).toBe(
      "failed",
    );
    expect(result.current.view!.errorOpened).toBe(true);
    act(() => result.current.cancelRaceSelection());
    await act(async () => result.current.chooseRace("argonian"));
    expect(result.current.view!.preview.name).toBe("Failed");
    const retained = result.current.setName;
    unmount();
    act(() => retained("After unmount"));
  });

  it.each(["success", "failure"])(
    "ignores retained callbacks and pending %s after catalog replacement",
    async (outcome) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const oldRead = reads.hold("race", "altmer");
      const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
      const { result, rerender } = renderHook(
        ({ content }) => useCharacterCreator(content),
        { initialProps: { content: catalog }, wrapper: StrictMode },
      );
      const oldCommands = result.current;
      act(() => {
        oldCommands.setFavoredCharacteristics(["str", "end"]);
        oldCommands.setCharacteristicGenerationMethod("rolled");
        oldCommands.submitCharacteristicRolls([
          { id: "old-draft", dice: [5, 6] },
        ]);
        oldCommands.setCharacteristicAssignments({ str: "old-draft" });
        oldCommands.setCharacteristicAllocations({ str: 8 });
        oldCommands.submitLuckRoll({ id: "old-luck", dice: [6, 7] });
      });
      act(() => oldCommands.chooseRace("altmer"));
      const disposalsBeforeReplacement = dispose.mock.calls.length;
      const replacement = fixtureCatalog();
      rerender({ content: replacement });
      expect(dispose.mock.calls.length).toBe(disposalsBeforeReplacement + 1);
      expect(result.current.view!.snapshot.answers.raceKey).toBeUndefined();
      expect(
        result.current.view!.snapshot.characteristicGeneration.drafts,
      ).toEqual({
        method: "rolled",
        favored: [],
        luck: undefined,
        rolled: { rolls: [], assignments: {} },
        pointBuy: { allocations: {} },
      });
      await act(async () => result.current.chooseRace("argonian"));
      expect(result.current.view!.preview.characteristics.str).toMatchObject({
        baseline: 25,
        rolled: 0,
        favored: false,
      });
      expect(result.current.view!.preview.characteristics.lck).toMatchObject({
        baseline: 30,
        rolled: 0,
      });
      act(() => {
        result.current.setFavoredCharacteristics(["ag", "wp"]);
        result.current.setCharacteristicGenerationMethod("point-buy");
        result.current.setCharacteristicAllocations({
          str: 20,
          end: 20,
          ag: 20,
          int: 10,
          wp: 10,
          prc: 0,
          prs: 0,
        });
        result.current.submitLuckRoll({ id: "fresh-luck", dice: [3, 4] });
      });
      const replacementView = result.current.view;
      await act(async () => {
        oldCommands.chooseRace("unknown");
        oldCommands.chooseRacialBonus("obsolete/group", []);
        oldCommands.cancelRaceSelection();
        oldCommands.dismissError();
        oldCommands.next();
        oldCommands.previous();
        oldCommands.setName("Obsolete name");
        oldCommands.setFavoredCharacteristics(["str", "end"]);
        oldCommands.setCharacteristicGenerationMethod("point-buy");
        oldCommands.submitCharacteristicRolls([{ id: "old", dice: [5, 5] }]);
        oldCommands.setCharacteristicAssignments({ str: "old" });
        oldCommands.setCharacteristicAllocations({ str: 20 });
        oldCommands.submitLuckRoll({ id: "old-luck", dice: [5, 5] });
        if (outcome === "success") oldRead.resolve();
        else oldRead.reject(new Error("obsolete catalog read"));
      });
      expect(result.current.view).toBe(replacementView);
      expect(result.current.view!.preview.race?.label).toBe("Argonian");
      expect(result.current.view!.preview.characteristics.str).toMatchObject({
        baseline: 25,
        rolled: 20,
        favored: false,
      });
      expect(result.current.view!.preview.characteristics.ag.favored).toBe(
        true,
      );
      expect(result.current.view!.preview.characteristics.lck).toMatchObject({
        baseline: 30,
        rolled: 7,
      });
      expect(console.error).not.toHaveBeenCalled();
      expect(await catalog.list("race")).toHaveLength(3);
      expect(await replacement.list("race")).toHaveLength(3);
    },
  );

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

  it("delegates guarded navigation and all-step finish eligibility to Core", async () => {
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
    expect(result.current.view!.snapshot.canGoNext).toBe(true);
    expect(result.current.view!.snapshot.canFinish).toBe(false);
    const answers = result.current.view!.snapshot.answers;
    act(() => result.current.next());
    expect(next.mock.results.at(-1)?.value.ok).toBe(true);
    expect(result.current.view!.snapshot.currentStep).toBe("characteristics");
    expect(result.current.view!.snapshot.canGoPrevious).toBe(true);
    expect(result.current.view!.snapshot.canGoNext).toBe(false);
    expect(result.current.view!.snapshot.canFinish).toBe(false);
    act(() => result.current.previous());
    expect(result.current.view!.snapshot.currentStep).toBe("race");
    expect(result.current.view!.snapshot.answers).toEqual(answers);
    act(() => {
      result.current.setFavoredCharacteristics(["str", "end"]);
      result.current.setCharacteristicGenerationMethod("point-buy");
      result.current.setCharacteristicAllocations({
        str: 20,
        end: 20,
        ag: 20,
        int: 10,
        wp: 10,
        prc: 0,
        prs: 0,
      });
      result.current.submitLuckRoll({ id: "luck", dice: [5, 6] });
    });
    expect(result.current.view!.snapshot.canFinish).toBe(false);
    act(() => result.current.next());
    expect(result.current.view!.snapshot.currentStep).toBe("characteristics");
    expect(result.current.view!.snapshot.canFinish).toBe(false);
    act(() => result.current.next());
    expect(result.current.view!.snapshot.currentStep).toBe("birthsign");
    act(() => result.current.next());
    expect(next.mock.results.at(-1)?.value).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "birthsign-required" })],
    });
    expect(result.current.view!.snapshot.currentStep).toBe("birthsign");
    expect(result.current.view!.errorOpened).toBe(false);
    expect(result.current.view!.preview.skills).toHaveLength(1);
    expect(finish).not.toHaveBeenCalled();
  });
});
