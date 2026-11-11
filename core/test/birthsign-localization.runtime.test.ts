import { describe, expect, it } from "vitest";
import { compileContentLocalization } from "@wayshrine/core/content-localization";
import type { LocalizationInput } from "@wayshrine/core/content-localization";

function fixture(): LocalizationInput {
  return {
    language: "fr",
    allowEnglishFallback: true,
    content: [
      {
        domain: "birthsigns",
        source: "signs.yml",
        data: {
          sign: {
            label: "{LOCALE.birthsigns.sign.label}",
            description: "{LOCALE.birthsigns.sign.description}",
            bonuses: [
              {
                bonusType: "choice",
                choiceGroup: {
                  id: "power",
                  prompt: "{LOCALE.birthsigns.sign.choices.power.prompt}",
                  choose: 1,
                  options: [
                    {
                      id: "gift",
                      effects: [{ bonusType: "power", bonusTargetKey: "gift" }],
                    },
                  ],
                },
                lifecycle: {
                  selection: "recurring",
                  chooseAt: "longRest",
                  expiresAt: "nextLongRest",
                },
              },
            ],
            starCursed: {
              description: "{LOCALE.birthsigns.sign.starCursed.description}",
              overwriteBaseBonuses: false,
              bonuses: [],
            },
          },
        },
      },
    ],
    locales: [
      {
        domain: "birthsigns",
        language: "en",
        source: "en.yml",
        data: {
          sign: {
            label: "Sign",
            description: "Lore only",
            starCursed: { description: "Variant explanation" },
            choices: {
              power: { prompt: "Choose a power until the next long rest." },
            },
          },
        },
      },
      {
        domain: "birthsigns",
        language: "fr",
        source: "fr.yml",
        data: {
          sign: { label: "Signe", starCursed: { description: "Variante" } },
        },
      },
    ],
  };
}

function english(input: LocalizationInput) {
  return (
    input.locales[0]!.data as Record<
      string,
      {
        label: string;
        description: string;
        starCursed: { description?: string };
        choices: Record<string, { prompt: string }>;
      }
    >
  ).sign!;
}

describe("declared nested birthsign display localization", () => {
  it("resolves and detaches nested text with per-leaf fallback, provenance and used-leaf diagnostics", () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = compileContentLocalization(input);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.definitions.birthsigns.sign!.description).toBe("Lore only");
    expect(result.definitions.birthsigns.sign!.starCursed.description).toBe(
      "Variante",
    );
    expect(result.definitions.birthsigns.sign!.bonuses[0]).toMatchObject({
      choiceGroup: { prompt: "Choose a power until the next long rest." },
    });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "fallback-used",
        source: "signs.yml",
        language: "fr",
        path: ["sign", "choices", "power", "prompt"],
        reference: "{LOCALE.birthsigns.sign.choices.power.prompt}",
      }),
    );
    expect(
      result.diagnostics.filter((item) => item.code === "unused-entry"),
    ).toEqual([]);
    result.definitions.birthsigns.sign!.starCursed.description = "Changed";
    expect(input).toEqual(before);
  });

  it("requires English nested leaves even when translated and never silently falls back in strict mode", () => {
    const input = fixture();
    delete english(input).starCursed.description;
    let result = compileContentLocalization(input);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-english-key",
        path: ["sign", "starCursed", "description"],
      }),
    );
    const strict = fixture();
    strict.allowEnglishFallback = false;
    result = compileContentLocalization(strict);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-target-key",
        path: ["sign", "choices", "power", "prompt"],
      }),
    );
  });

  it.each(["{X}", "{LOCALE.birthsigns.sign.label}", "broken {text"])(
    "rejects invalid nested terminal text %s without fallback",
    (prompt) => {
      const input = fixture();
      english(input).choices.power!.prompt = prompt;
      const result = compileContentLocalization(input);
      expect(result.success).toBe(false);
      expect(result.diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "error",
          source: "en.yml",
          path: ["sign", "choices", "power", "prompt"],
        }),
      );
    },
  );

  it("keeps temporary nested leaves visible and reports unused staged nested text", () => {
    const input = fixture();
    english(input).choices.power!.prompt = "[TEMPORARY: prompt pending]";
    english(input).choices.unused = { prompt: "Staged choice" };
    const result = compileContentLocalization(input);
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.definitions.birthsigns.sign!.bonuses[0]).toMatchObject({
        choiceGroup: { prompt: "[TEMPORARY: prompt pending]" },
      });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "temporary-text",
        path: ["sign", "choices", "power", "prompt"],
      }),
    );
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "unused-entry",
        path: ["sign", "choices", "unused", "prompt"],
      }),
    );
  });

  it("rejects undeclared nested locale fields rather than accepting arbitrary trees", () => {
    const input = fixture();
    Reflect.set(english(input).starCursed, "label", "Not declared");
    expect(compileContentLocalization(input).success).toBe(false);
  });

  it("rejects choice references with unknown IDs", () => {
    const input = fixture();
    const content = input.content[0]!.data as {
      sign: { starCursed: { description: string } };
    };
    content.sign.starCursed.description =
      "{LOCALE.birthsigns.sign.choices.missing.prompt}";
    const result = compileContentLocalization(input);
    expect(result.success).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "malformed-reference" }),
    );
  });
});
