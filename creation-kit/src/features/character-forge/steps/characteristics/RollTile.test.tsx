import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { RollTile } from "./RollTile";

it.each(["hover", "focus"])(
  "discloses die faces on %s without showing internal identity",
  async (interaction) => {
    const user = userEvent.setup();
    render(
      <MantineProvider env="test">
        <RollTile
          roll={{ id: "private-roll-id", dice: [6, 7] }}
          label="Roll 1"
          assignment="Strength"
          onClick={vi.fn()}
        />
      </MantineProvider>,
    );
    const tile = screen.getByRole("button", {
      name: "Roll 1, total 13, assigned Strength",
    });
    expect(tile.textContent).toBe("13Strength");
    expect(screen.queryByText(/private-roll-id|2d10/)).toBeNull();
    if (interaction === "hover") await user.hover(tile);
    else await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toBe("2d10: 6 + 7 = 13");
    expect(tile.getAttribute("aria-describedby")).toBe(tooltip.id);
  },
);
