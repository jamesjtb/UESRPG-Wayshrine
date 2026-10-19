import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

const steps = [
  "Select Race",
  "Generate Characteristics",
  "Determine Birthsign",
  "Generate Lucky Numbers",
  "Bonds (Optional)",
  "Character Traits (Optional)",
  "Character Details",
];

function renderForge() {
  window.history.replaceState(null, "", "/#/character-forge");
  render(<App />);
}

function expectActiveStep(label: string) {
  expect(
    screen.getByRole("button", { name: label }).getAttribute("aria-current"),
  ).toBe("step");
}

describe("Character Forge", () => {
  it("opens from the sidebar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Character Forge" }));
    expect(window.location.hash).toBe("#/character-forge");
    expect(
      screen.getByRole("heading", { name: "Character Forge" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Character Forge" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("opens directly with only the first step and Back disabled", () => {
    renderForge();
    const stepButtons = within(
      screen.getByRole("navigation", { name: "Character creation steps" }),
    ).getAllByRole("button");
    expect(stepButtons.map((button) => button.textContent)).toEqual([steps[0]]);
    for (const button of stepButtons) {
      expect(button.querySelector("svg")).toBeNull();
    }
    expectActiveStep("Select Race");
    expect(screen.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      screen.queryByRole("button", { name: "Finalize Character" }),
    ).toBeNull();
  });

  it("walks through every step and finalizes without displaying a character", async () => {
    const user = userEvent.setup();
    renderForge();
    for (const label of steps.slice(0, -1)) {
      expectActiveStep(label);
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    expectActiveStep("Character Details");
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Finalize Character" }),
    );
    expect(
      screen.queryByRole("button", { name: "Finalize Character" }),
    ).toBeNull();
    expect(document.querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expectActiveStep("Character Details");
  });

  it("shows the path through the current step and allows revisiting earlier steps", async () => {
    const user = userEvent.setup();
    renderForge();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expectActiveStep("Determine Birthsign");
    expect(
      within(
        screen.getByRole("navigation", { name: "Character creation steps" }),
      )
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(steps.slice(0, 3));
    expect(
      screen.queryByRole("button", { name: "Generate Lucky Numbers" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expectActiveStep("Generate Characteristics");
    const race = screen.getByRole("button", { name: "Select Race" });
    race.focus();
    await user.keyboard("{Enter}");
    expectActiveStep("Select Race");
  });
});
