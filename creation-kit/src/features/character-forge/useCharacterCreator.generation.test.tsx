import { act, renderHook } from "@testing-library/react";
import { Characteristic } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { fixtureCatalog } from "./test/testCatalog";
import { useCharacterCreator } from "./useCharacterCreator";

it("projects independent valid groups and guards all-step finish eligibility from either step", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const catalog = fixtureCatalog();
  const { result } = renderHook(() => useCharacterCreator(catalog));
  const allocations = {
    str: 20,
    end: 20,
    ag: 20,
    int: 10,
    wp: 10,
    prc: 0,
    prs: 0,
  };
  act(() => {
    result.current.setCharacteristicGenerationMethod("point-buy");
    result.current.setCharacteristicAllocations(allocations);
    result.current.setFavoredCharacteristics(["str", "end"]);
    result.current.submitLuckRoll({ id: "luck", dice: [6, 7] });
  });
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  await act(async () => result.current.chooseRace("argonian"));

  function expectProjection(
    generated: boolean,
    favored: boolean,
    luck: number,
  ) {
    const preview = result.current.view!.preview;
    for (const key of Object.values(Characteristic)) {
      expect(preview.characteristics[key].rolled).toBe(
        generated ? allocations[key] : 0,
      );
      expect(preview.characteristics[key].favored).toBe(
        favored && ["str", "end"].includes(key),
      );
    }
    expect(preview.characteristics.lck).toMatchObject({
      baseline: 30,
      rolled: luck,
      favored: false,
    });
  }

  expectProjection(true, true, 13);
  expect(result.current.view!.snapshot.currentStep).toBe("race");
  expect(result.current.view!.snapshot.canFinish).toBe(true);
  act(() => result.current.setFavoredCharacteristics(["str", "str"]));
  expectProjection(true, false, 13);
  expect(
    result.current.view!.snapshot.characteristicGeneration.drafts.favored,
  ).toEqual(["str", "str"]);
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  act(() => result.current.next());
  expect(result.current.view!.snapshot.currentStep).toBe("characteristics");
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  act(() => result.current.setFavoredCharacteristics(["str", "end"]));
  expect(result.current.view!.snapshot.canFinish).toBe(true);
  act(() => result.current.submitLuckRoll({ id: "bad-luck", dice: [0, 11] }));
  expectProjection(true, true, 0);
  expect(
    result.current.view!.snapshot.characteristicGeneration.drafts.luck,
  ).toEqual({ id: "bad-luck", dice: [0, 11] });
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  act(() => result.current.previous());
  expect(result.current.view!.snapshot.currentStep).toBe("race");
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  act(() => result.current.submitLuckRoll({ id: "luck-fixed", dice: [6, 7] }));
  expectProjection(true, true, 13);
  expect(result.current.view!.snapshot.canFinish).toBe(true);
  act(() => result.current.next());

  await act(async () => result.current.chooseRace("altmer"));
  expect(result.current.view!.snapshot.currentStep).toBe("characteristics");
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  expectProjection(true, true, 13);
  await act(async () =>
    result.current.chooseRacialBonus("altmer/magic", ["alchemy"]),
  );
  expect(result.current.view!.snapshot.canFinish).toBe(true);
  await act(async () => result.current.chooseRacialBonus("altmer/magic", []));
  expect(result.current.view!.snapshot.currentStep).toBe("characteristics");
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  act(() => result.current.previous());
  expect(result.current.view!.snapshot.currentStep).toBe("race");
  expect(result.current.view!.snapshot.canFinish).toBe(false);
  expectProjection(true, true, 13);
  expect(result.current.view!.errorOpened).toBe(false);
  expect(console.error).not.toHaveBeenCalled();
});
