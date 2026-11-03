import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";
import { loadTestCatalog } from "../test/content";

describe("Character Forge route", () => {
  it("opens from the sidebar and keeps only Select Race active", async () => {
    const user = userEvent.setup();
    render(<App loadCatalog={loadTestCatalog} />);
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
    const navigation = within(
      screen.getByRole("navigation", { name: "Character creation steps" }),
    );
    expect(
      navigation.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Select Race"]);
    expect(navigation.getByRole("button").getAttribute("aria-current")).toBe(
      "step",
    );
    expect(await screen.findByText("No races available.")).toBeTruthy();
    const stepNavigation = within(
      screen.getByRole("navigation", { name: "Character creation navigation" }),
    );
    expect(stepNavigation.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(stepNavigation.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      stepNavigation.getByRole("button", { name: "Next" }).closest("footer"),
    ).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Finalize Character" }),
    ).toBeNull();
    expect(
      screen.queryByText(/Not implemented|Character creation is incomplete/),
    ).toBeNull();
    expect(
      stepNavigation
        .getByRole("button", { name: "Next" })
        .getAttribute("title"),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirm race choices" }),
    ).toBeNull();
  });
});
