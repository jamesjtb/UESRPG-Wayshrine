import { describe, expect, it } from "vitest";
import Wizard from "../src/wizards/Wizard";

describe("Wizard", () => {
  function workflow() {
    const answers = { race: "", skill: "", rolls: [10, 12] };
    const wizard = new Wizard(
      [
        {
          id: "race",
          evaluate: () => ({
            pendingChoices: [],
            issues: answers.race
              ? []
              : [{ code: "race-required", message: "Choose a race." }],
          }),
        },
        {
          id: "training",
          evaluate: () => ({
            pendingChoices: answers.skill === answers.race ? [] : ["training"],
            issues: [],
          }),
        },
        { id: "review", evaluate: () => ({ pendingChoices: [], issues: [] }) },
      ],
      () => ({ ...answers, rolls: [...answers.rolls] }),
    );
    return { answers, wizard };
  }

  it("blocks next and finish and returns reasons", () => {
    const { wizard } = workflow();
    expect(wizard.next()).toMatchObject({
      ok: false,
      issues: [{ code: "race-required" }],
    });
    expect(wizard.finish().ok).toBe(false);
    expect(wizard.getSnapshot()).toMatchObject({
      currentStep: "race",
      canGoNext: false,
      canFinish: false,
    });
    expect(wizard.previous().ok).toBe(false);
  });

  it("revalidates downstream answers without clearing them or stored rolls", () => {
    const { answers, wizard } = workflow();
    answers.race = "altmer";
    expect(wizard.next().ok).toBe(true);
    expect(wizard.next()).toMatchObject({
      ok: false,
      issues: [{ code: "unresolved-choices" }],
    });
    answers.skill = "altmer";
    expect(wizard.next().ok).toBe(true);
    expect(wizard.finish().ok).toBe(true);
    wizard.previous();
    wizard.previous();
    answers.race = "argonian";
    expect(answers.skill).toBe("altmer");
    expect(answers.rolls).toEqual([10, 12]);
    expect(wizard.getSnapshot().steps[1]?.complete).toBe(false);
    expect(wizard.finish().ok).toBe(false);
    wizard.next();
    expect(wizard.next().ok).toBe(false);
    answers.skill = "argonian";
    expect(wizard.next().ok).toBe(true);
    expect(wizard.finish()).toEqual({ ok: true, value: answers });
  });

  it("checks preceding steps even when editing from a later position", () => {
    const { answers, wizard } = workflow();
    answers.race = "altmer";
    answers.skill = "altmer";
    wizard.next();
    answers.race = "";
    expect(wizard.getSnapshot().canGoNext).toBe(false);
    expect(wizard.next()).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "race-required" }),
      ]),
    });
  });

  it("does not advance automatically or wrap past the last step", () => {
    const { answers, wizard } = workflow();
    answers.race = "altmer";
    answers.skill = "altmer";
    expect(wizard.getSnapshot().currentStep).toBe("race");
    wizard.next();
    wizard.next();
    expect(wizard.next()).toMatchObject({
      ok: false,
      issues: [{ code: "last-step" }],
    });
  });

  it("rejects empty and duplicate step definitions", () => {
    expect(() => new Wizard([], () => null)).toThrow();
    const step = {
      id: "race",
      evaluate: () => ({ pendingChoices: [], issues: [] }),
    };
    expect(() => new Wizard([step, step], () => null)).toThrow();
  });
});
