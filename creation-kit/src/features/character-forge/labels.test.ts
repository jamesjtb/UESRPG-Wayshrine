import { describe, expect, it } from "vitest";
import { plainDescription, readableLabel } from "./labels";

describe("compiled content presentation", () => {
  it("preserves supplied labels and descriptions literally", () => {
    expect(readableLabel("alchemy", "Alchimie")).toBe("Alchimie");
    expect(readableLabel("custom", "My {LOCALE} name")).toBe(
      "My {LOCALE} name",
    );
    expect(plainDescription("A description with {X}.")).toBe(
      "A description with {X}.",
    );
    expect(plainDescription("Literal {LOCALE} text")).toBe(
      "Literal {LOCALE} text",
    );
  });

  it("humanizes keys only when an optional label is absent", () => {
    expect(readableLabel("combatStyle")).toBe("Combat Style");
    expect(readableLabel("some-skill_key", "")).toBe("Some skill key");
    expect(plainDescription("")).toBeUndefined();
  });
});
