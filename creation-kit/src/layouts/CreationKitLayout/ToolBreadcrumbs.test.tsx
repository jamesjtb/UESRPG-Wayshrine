import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolBreadcrumbs } from "./ToolBreadcrumbs";

const steps = ["Race", "Characteristics", "Birthsign", "Lucky Numbers"];

function mockLayout(initialWidth: number) {
  let width = initialWidth;
  let notifyResize = () => {};

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const itemWidth = this.classList.contains("mantine-OverflowList-root")
        ? width
        : this.querySelector('[aria-label="Show earlier steps"]')
          ? 40
          : 100;
      return new DOMRect(0, 0, itemWidth, 24);
    },
  );

  vi.spyOn(globalThis, "ResizeObserver").mockImplementation(
    class implements ResizeObserver {
      observe: (target: Element) => void;

      constructor(callback: ResizeObserverCallback) {
        this.observe = (target) => {
          notifyResize = () =>
            callback(
              [
                {
                  target,
                  contentRect: new DOMRect(0, 0, width, 24),
                  borderBoxSize: [{ inlineSize: width, blockSize: 24 }],
                  contentBoxSize: [{ inlineSize: width, blockSize: 24 }],
                  devicePixelContentBoxSize: [],
                },
              ],
              this,
            );
        };
      }

      unobserve() {}
      disconnect() {}
    },
  );

  return (nextWidth: number) => {
    width = nextWidth;
    act(() => notifyResize());
  };
}

function renderBreadcrumbs(onStepClick = vi.fn()) {
  return render(
    <MantineProvider env="test">
      <ToolBreadcrumbs
        steps={steps}
        active={3}
        onStepClick={onStepClick}
        label="Creation steps"
      />
    </MantineProvider>,
  );
}

describe("Tool breadcrumbs", () => {
  it("collapses earlier steps on overflow and restores them when resized", async () => {
    const resize = mockLayout(160);
    renderBreadcrumbs();
    expect(
      screen.getByRole("button", { name: "Show earlier steps" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Race" })).toBeNull();
    expect(screen.getByRole("button", { name: "Birthsign" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Lucky Numbers" })
        .getAttribute("aria-current"),
    ).toBe("step");

    resize(800);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Show earlier steps" }),
      ).toBeNull();
      expect(screen.getByRole("button", { name: "Race" })).toBeTruthy();
    });

    resize(160);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Show earlier steps" }),
      ).toBeTruthy(),
    );
  });

  it("allows keyboard navigation to steps in the overflow menu", async () => {
    mockLayout(160);
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    renderBreadcrumbs(onStepClick);
    screen.getByRole("button", { name: "Show earlier steps" }).focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menuitem", { name: "Race" })).toBeTruthy();
    expect(
      screen.getByRole("menuitem", { name: "Characteristics" }),
    ).toBeTruthy();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
