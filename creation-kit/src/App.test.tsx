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
import { navigationItems } from "./navigation";

describe("Creation Kit navigation", () => {
  it("opens Home from a direct hash URL and supports keyboard activation", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/#/");
    render(<App />);
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

  it("shows Home and all six disabled tools without additional labels", async () => {
    const user = userEvent.setup();
    render(<App />);
    const navigation = within(
      screen.getByRole("navigation", { name: "Creation Kit" }),
    );

    expect(
      navigation
        .getByRole("link", { name: "Home" })
        .getAttribute("aria-current"),
    ).toBe("page");
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
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" }),
    );
    const tool = screen.getByRole("button", { name: "Character Forge" });
    expect(tool).toHaveProperty("disabled", true);
    expect(tool.textContent).toBe("");
    await user.hover(tool.parentElement!);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Character Forge",
    );
    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(tool.textContent).toBe("Character Forge");
  });

  it.each(["/missing", "/character-forge"])(
    "handles direct links to unsupported route %s",
    async (path) => {
      const user = userEvent.setup();
      window.history.replaceState(null, "", `/#${path}`);
      render(<App />);
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

  it.each(["/", "/missing"])(
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
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
      expect(
        screen
          .getByRole("button", { name: "Close navigation" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
      fireEvent.click(
        screen.getByRole("link", {
          name: path === "/" ? "Home" : "Return home",
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
