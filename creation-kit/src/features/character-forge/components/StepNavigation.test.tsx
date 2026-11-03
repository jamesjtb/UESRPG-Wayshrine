import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepNavigation } from "./StepNavigation";

describe("StepNavigation", () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])(
    "delegates callbacks only when enabled (Back: %s, Next: %s)",
    async (canGoPrevious, canGoNext) => {
      const user = userEvent.setup();
      const onPrevious = vi.fn();
      const onNext = vi.fn();
      render(
        <MantineProvider env="test">
          <StepNavigation
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
            onPrevious={onPrevious}
            onNext={onNext}
          />
        </MantineProvider>,
      );
      expect(
        screen.getByRole("navigation", {
          name: "Character creation navigation",
        }),
      ).toBeTruthy();
      const back = screen.getByRole("button", { name: "Back" });
      const next = screen.getByRole("button", { name: "Next" });
      expect(back).toHaveProperty("disabled", !canGoPrevious);
      expect(next).toHaveProperty("disabled", !canGoNext);
      expect(back.getAttribute("title")).toBeNull();
      await user.click(back);
      await user.click(next);
      expect(onPrevious).toHaveBeenCalledTimes(Number(canGoPrevious));
      expect(onNext).toHaveBeenCalledTimes(Number(canGoNext));
    },
  );
});
