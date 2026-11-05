import { Accordion, MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RemainingActions } from "./RemainingActions";

const actions = [
  { id: "race", label: "Choose a race" },
  { id: "skills", label: "Choose racial skills" },
  { id: "luck", label: "Roll Luck" },
] as const;

function remainingActions(
  nextActions: readonly { id: string; label: string }[] = actions,
) {
  return (
    <MantineProvider
      env="test"
      theme={{
        components: {
          Accordion: Accordion.extend({
            defaultProps: { transitionDuration: 0 },
          }),
        },
      }}
    >
      <div data-testid="remaining-actions">
        <RemainingActions actions={nextActions} />
      </div>
    </MantineProvider>
  );
}

describe("RemainingActions", () => {
  it("defaults to the first action with a remaining count and no visible list", () => {
    render(remainingActions());

    const control = screen.getByRole("button", {
      name: "Choose a race 3 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("Choose racial skills")).toBeNull();
    expect(screen.queryByText("Before you continue")).toBeNull();
    expect(control.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("expands the full ordered list without duplicating the first action and collapses", async () => {
    const user = userEvent.setup();
    render(remainingActions());

    await user.click(screen.getByRole("button"));
    const control = screen.getByRole("button", {
      name: "Before you continue 3 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", {
      name: "Before you continue 3 remaining",
    });
    expect(panel.id).toBe(control.getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(control.id);
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(actions.map((action) => action.label));
    expect(screen.getAllByText("Choose a race")).toHaveLength(1);

    await user.click(control);
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Choose a race 3 remaining" }),
    ).toBeTruthy();
  });

  it("supports Tab, Enter and Space without moving focus from the control", async () => {
    const user = userEvent.setup();
    render(remainingActions());
    const control = screen.getByRole("button");
    expect(document.activeElement).not.toBe(control);

    await user.tab();
    expect(document.activeElement).toBe(control);
    await user.keyboard("{Enter}");
    expect(control.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(control);
    await user.keyboard(" ");
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(control);
  });

  it("renders one action without a count, list or toggle", () => {
    render(remainingActions([actions[1]]));

    expect(screen.getByText("Choose racial skills")).toBeTruthy();
    expect(screen.queryByText(/remaining/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("renders nothing for no actions", () => {
    const view = render(remainingActions([]));
    expect(screen.getByTestId("remaining-actions").childNodes).toHaveLength(0);
    expect(view.container.querySelector(".mantine-Paper-root")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("updates collapsed summaries and preserves expansion while multiple actions remain", async () => {
    const user = userEvent.setup();
    const view = render(remainingActions());
    view.rerender(remainingActions([actions[2], actions[1]]));
    const control = screen.getByRole("button", {
      name: "Roll Luck 2 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("false");

    await user.click(control);
    view.rerender(
      remainingActions([
        actions[1],
        { id: "luck", label: "Assign Luck" },
        { id: "favored", label: "Choose favored characteristics" },
      ]),
    );
    expect(control.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Before you continue 3 remaining" }),
    ).toBe(control);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "Choose racial skills",
      "Assign Luck",
      "Choose favored characteristics",
    ]);
    expect(screen.queryByText("Roll Luck")).toBeNull();

    view.rerender(remainingActions([actions[1], actions[2]]));
    expect(control.getAttribute("aria-expanded")).toBe("true");
    view.rerender(remainingActions([actions[2]]));
    expect(screen.getByText("Roll Luck")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    view.rerender(remainingActions([]));
    expect(screen.getByTestId("remaining-actions").childNodes).toHaveLength(0);
  });
});
