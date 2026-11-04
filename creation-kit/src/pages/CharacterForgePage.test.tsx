import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";
import { loadTestCatalog } from "../test/content";

describe("Character Sheet route", () => {
  it("replaces the legacy history entry rather than adding a redirect entry", async () => {
    window.history.replaceState(null, "", "/#/");
    window.history.pushState(null, "", "/#/character-forge");
    render(<App loadCatalog={loadTestCatalog} />);
    await screen.findByRole("region", { name: "Character sheet" });
    expect(window.location.hash).toBe("#/character-sheet");
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe("#/"));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Welcome",
    );
  });

  it.each(["/character-sheet", "/character-forge"])(
    "opens %s at the canonical sheet URL with one primary sheet",
    async (path) => {
      window.history.replaceState(null, "", `/#${path}`);
      render(<App loadCatalog={loadTestCatalog} />);
      const sheet = await screen.findByRole("region", {
        name: "Character sheet",
      });
      expect(window.location.hash).toBe("#/character-sheet");
      expect(
        screen.getAllByRole("region", { name: "Character sheet" }),
      ).toHaveLength(1);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("In progress")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Create Character" }),
      ).toBeTruthy();
      expect(
        within(sheet).getByRole("textbox", { name: "Character name" }),
      ).toBeTruthy();
      expect(screen.queryByText("Character Forge")).toBeNull();
      expect(
        screen.queryByRole("button", { name: /finish|finalize/i }),
      ).toBeNull();
      expect(
        screen
          .getByRole("link", { name: "Character Sheet" })
          .getAttribute("aria-current"),
      ).toBe("page");
    },
  );

  it("opens from the sidebar and keeps only Select Race active", async () => {
    const user = userEvent.setup();
    render(<App loadCatalog={loadTestCatalog} />);
    await user.click(screen.getByRole("link", { name: "Character Sheet" }));
    expect(window.location.hash).toBe("#/character-sheet");
    expect(
      screen.getByRole("heading", { name: "Character Sheet" }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Character Sheet" })
        .getAttribute("aria-current"),
    ).toBe("page");
    await user.click(
      await screen.findByRole("button", { name: "Create Character" }),
    );
    const navigation = within(
      await screen.findByRole("navigation", {
        name: "Character creation steps",
      }),
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
