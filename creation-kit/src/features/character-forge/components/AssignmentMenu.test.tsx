import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AssignmentMenu } from "./AssignmentMenu";

function renderMenu() {
  const onSelect = vi.fn();
  render(
    <MantineProvider env="test">
      <AssignmentMenu
        trigger={<button type="button">Choose option</button>}
        options={[
          { value: "alpha-key", label: "Alpha" },
          { value: "beta-key", label: "Beta" },
        ]}
        onSelect={onSelect}
      />
      <p>Outside menu</p>
    </MantineProvider>,
  );
  return {
    onSelect,
    user: userEvent.setup(),
    trigger: screen.getByRole("button", { name: "Choose option" }),
  };
}

it.each(["click", "touch"])(
  "presents only option labels and selects their values by %s",
  async (interaction) => {
    const { onSelect, user, trigger } = renderMenu();
    await user.click(trigger);
    const menu = screen.getByRole("menu", { name: "Choose option" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-controls")).toBe(menu.id);
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Alpha", "Beta"]);
    expect(menu.textContent).toBe("AlphaBeta");
    const option = within(menu).getByRole("menuitem", { name: "Beta" });
    if (interaction === "touch") {
      await user.pointer([
        { keys: "[TouchA>]", target: option },
        { keys: "[/TouchA]" },
      ]);
    } else {
      await user.click(option);
    }
    expect(onSelect).toHaveBeenCalledExactlyOnceWith("beta-key");
    expect(screen.queryByRole("menu")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  },
);

it("supports keyboard selection and dismissal without invoking callbacks", async () => {
  const { onSelect, user, trigger } = renderMenu();
  await user.tab();
  expect(document.activeElement).toBe(trigger);
  await user.keyboard("{Enter}{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(
    screen.getByRole("menuitem", { name: "Beta" }),
  );
  await user.keyboard("{Escape}");
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await user.click(trigger);
  await user.click(screen.getByText("Outside menu"));
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByRole("menu")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  await user.keyboard("{Enter}{ArrowDown}{ArrowDown}{Enter}");
  expect(onSelect).toHaveBeenCalledExactlyOnceWith("beta-key");
  expect(screen.queryByRole("menu")).toBeNull();
});
