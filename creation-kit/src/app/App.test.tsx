import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { loadTestCatalog } from "../test/content";
import { navigationItems } from "../layouts/CreationKitLayout/navigation";

describe("Creation Kit navigation", () => {
  it("places the brand in the sidebar and creation steps inside the wizard", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/#/character-sheet");
    render(<App loadCatalog={loadTestCatalog} />);
    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");
    expect(main.className).toContain("forgeWorkspace");
    const brand = screen.getByText("Wayshrine Creation Kit");
    expect(brand.closest("#creation-kit-navigation")).not.toBeNull();
    expect(within(header).queryByText("Wayshrine Creation Kit")).toBeNull();
    expect(
      within(header).queryByRole("button", { name: "Select Race" }),
    ).toBeNull();
    await user.click(
      await screen.findByRole("button", { name: "Create Character" }),
    );
    const wizard = within(
      screen.getByRole("dialog", { name: "Create Character" }),
    );
    const breadcrumbs = within(
      wizard.getByRole("navigation", {
        name: "Character creation steps",
      }),
    );
    expect(breadcrumbs.getAllByRole("button")).toHaveLength(1);
    const currentStep = breadcrumbs.getByRole("button", {
      name: "Select Race",
    });
    expect(currentStep.getAttribute("aria-current")).toBe("step");
    await user.click(currentStep);
    expect(currentStep.getAttribute("aria-current")).toBe("step");
    expect(
      within(screen.getByRole("main")).queryByRole("button", {
        name: "Select Race",
      }),
    ).toBeNull();
    expect(
      wizard.getByRole("button", {
        name: "Next",
      }),
    ).toBeTruthy();
    expect(wizard.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(wizard.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    await user.click(
      screen.getByRole("button", { name: "Close character creation" }),
    );
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(main.className).not.toContain("forgeWorkspace");
    expect(
      within(header).queryByRole("button", { name: "Select Race" }),
    ).toBeNull();
  });

  it("opens Home from a direct hash URL and supports keyboard activation", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/#/");
    render(<App loadCatalog={loadTestCatalog} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Welcome",
    );
    const home = screen.getByRole("link", { name: "Home" });
    home.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(home);
    expect(window.location.hash).toBe("#/");
    await user.tab();
    for (const item of navigationItems.filter((item) => !item.available)) {
      expect(document.activeElement).not.toBe(
        screen.getByRole("button", { name: item.label }),
      );
    }
  });

  it("shows Home, Character Sheet, and five disabled tools without additional labels", async () => {
    const user = userEvent.setup();
    render(<App loadCatalog={loadTestCatalog} />);
    const navigation = within(
      screen.getByRole("navigation", { name: "Creation Kit" }),
    );

    expect(
      navigation
        .getByRole("link", { name: "Home" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      navigation.getByRole("link", { name: "Character Sheet" }),
    ).toBeTruthy();
    for (const item of navigationItems.filter((item) => !item.available)) {
      const button = navigation.getByRole("button", { name: item.label });
      expect(button).toHaveProperty("disabled", true);
      expect(button.textContent).toBe(item.label);
      await user.click(button);
    }
    expect(window.location.hash).toBe("");
    expect(screen.queryByText(/coming soon/i)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
      "Welcome",
    );
  });

  it("collapses to labeled icons and can expand again", async () => {
    const user = userEvent.setup();
    render(<App loadCatalog={loadTestCatalog} />);
    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" }),
    );
    const tool = screen.getByRole("link", { name: "Character Sheet" });
    expect(screen.getByLabelText("Wayshrine Creation Kit").textContent).toBe(
      "W",
    );
    expect(tool.textContent).toBe("");
    await user.hover(tool.parentElement!);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Character Sheet",
    );
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(tool.textContent).toBe("Character Sheet");
    expect(screen.getByText("Wayshrine Creation Kit")).toBeTruthy();
  });

  it.each(["/missing"])(
    "handles direct links to unsupported route %s",
    async (path) => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", `/#${path}`);
      render(<App loadCatalog={loadTestCatalog} />);
      expect(
        screen.getByRole("heading", { name: "Page not found" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Home" }).getAttribute("aria-current"),
      ).toBeNull();
      await user.click(screen.getByRole("link", { name: "Return home" }));
      expect(window.location.hash).toBe("#/");
      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
        "Welcome",
      );
      window.history.back();
      await waitFor(() =>
        expect(
          screen.getByRole("heading", { name: "Page not found" }),
        ).toBeTruthy(),
      );
      window.history.forward();
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
          "Welcome",
        ),
      );
    },
  );

  it.each(["/", "/missing", "/character-sheet", "/character-forge"])(
    "closes mobile navigation when returning Home from %s",
    async (path) => {
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      window.history.replaceState(null, "", `/#${path}`);
      render(<App loadCatalog={loadTestCatalog} />);
      // The alt layout lets the mobile navbar cover the header's close control.
      expect(
        screen
          .getByRole("banner")
          .closest(".mantine-AppShell-root")
          ?.getAttribute("data-layout"),
      ).toBe("default");
      expect(
        screen
          .getByText("Wayshrine Creation Kit")
          .closest("#creation-kit-navigation"),
      ).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
      expect(
        screen
          .getByRole("button", { name: "Close navigation" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
      fireEvent.click(
        screen.getByRole("link", {
          name: path === "/missing" ? "Return home" : "Home",
        }),
      );
      expect(
        screen
          .getByRole("button", { name: "Open navigation" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
    },
  );
});
