import { Accordion, MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToContinue } from "./ToContinue";
import type { UserAction } from "./ToContinue";

const actions = [
  { id: "race", label: "Choose a race" },
  { id: "skills", label: "Choose racial skills" },
  { id: "luck", label: "Roll Luck" },
] as const;

function toContinue(nextActions: readonly UserAction[] = actions) {
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
      <div data-testid="to-continue">
        <ToContinue actions={nextActions} />
      </div>
    </MantineProvider>
  );
}

describe("ToContinue", () => {
  it("defaults to the first action with a remaining count and no visible list", () => {
    render(toContinue());

    const control = screen.getByRole("button", {
      name: "Choose a race 3 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("Choose racial skills")).toBeNull();
    expect(screen.queryByText("Complete the following to continue")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(control.querySelector("button")).toBeNull();
    expect(control.getAttribute("data-chevron-position")).toBe("right");
    expect(control.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("expands the full ordered list without duplicating the first action and collapses", async () => {
    const user = userEvent.setup();
    render(toContinue());

    await user.click(screen.getByRole("button"));
    const control = screen.getByRole("button", {
      name: "Complete the following to continue 3 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("region", {
      name: "Complete the following to continue 3 remaining",
    });
    expect(panel.id).toBe(control.getAttribute("aria-controls"));
    expect(panel.getAttribute("aria-labelledby")).toBe(control.id);
    expect(
      within(panel)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(actions.map((action) => action.label));
    expect(screen.getAllByText("Choose a race")).toHaveLength(1);
    expect(screen.getByText("Complete the following to continue")).toBeTruthy();

    await user.click(control);
    expect(control.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Choose a race 3 remaining" }),
    ).toBeTruthy();
  });

  it("supports Tab, Enter and Space without moving focus from the control", async () => {
    const user = userEvent.setup();
    render(toContinue());
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
    render(toContinue([actions[1]]));

    expect(screen.getByText("Choose racial skills")).toBeTruthy();
    expect(screen.queryByText(/remaining/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen
        .getByTestId("to-continue")
        .querySelectorAll('svg[aria-hidden="true"]'),
    ).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders nothing for no actions", () => {
    const view = render(toContinue([]));
    expect(screen.getByTestId("to-continue").childNodes).toHaveLength(0);
    expect(view.container.querySelector(".mantine-Paper-root")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("uses the shared loading indicator for a single pending action", () => {
    render(
      toContinue([
        { id: "race", label: "Loading race selection", loading: true },
      ]),
    );
    const status = screen.getByRole("status", {
      name: "Loading race selection",
    });
    expect(status.querySelector(".mantine-Loader-root")).not.toBeNull();
    expect(screen.queryByText("Loading race selection")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders pending summaries and list entries with meaningful loading labels", async () => {
    const user = userEvent.setup();
    const pendingActions: readonly UserAction[] = [
      { id: "skills", label: "Loading racial skills", loading: true },
      { id: "other", label: "Choose another racial skill" },
    ];
    const view = render(toContinue(pendingActions));
    const control = screen.getByRole("button", {
      name: "Loading racial skills 2 remaining",
    });
    expect(
      within(control)
        .getByRole("status", { name: "Loading racial skills" })
        .querySelector(".mantine-Loader-root"),
    ).not.toBeNull();
    await user.click(control);
    const panel = screen.getByRole("region", {
      name: "Complete the following to continue 2 remaining",
    });
    expect(within(control).queryByRole("status")).toBeNull();
    expect(
      within(panel)
        .getByRole("status", { name: "Loading racial skills" })
        .querySelector(".mantine-Loader-root"),
    ).not.toBeNull();
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    view.rerender(
      toContinue([
        { id: "skills", label: "Retry racial skill selection" },
        pendingActions[1]!,
      ]),
    );
    expect(control.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      within(panel).getByText("Retry racial skill selection"),
    ).toBeTruthy();
    await user.click(control);
    expect(
      screen.getByRole("button", {
        name: "Retry racial skill selection 2 remaining",
      }),
    ).toBe(control);
  });

  it("updates collapsed summaries and preserves expansion while multiple actions remain", async () => {
    const user = userEvent.setup();
    const view = render(toContinue());
    view.rerender(toContinue([actions[2], actions[1]]));
    const control = screen.getByRole("button", {
      name: "Roll Luck 2 remaining",
    });
    expect(control.getAttribute("aria-expanded")).toBe("false");

    await user.click(control);
    view.rerender(
      toContinue([
        actions[1],
        { id: "luck", label: "Assign Luck" },
        { id: "favored", label: "Choose favored characteristics" },
      ]),
    );
    expect(control.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("button", {
        name: "Complete the following to continue 3 remaining",
      }),
    ).toBe(control);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "Choose racial skills",
      "Assign Luck",
      "Choose favored characteristics",
    ]);
    expect(screen.queryByText("Roll Luck")).toBeNull();

    view.rerender(toContinue([actions[1], actions[2]]));
    expect(control.getAttribute("aria-expanded")).toBe("true");
    view.rerender(toContinue([actions[2]]));
    expect(screen.getByText("Roll Luck")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    view.rerender(toContinue([]));
    expect(screen.getByTestId("to-continue").childNodes).toHaveLength(0);
  });
});
