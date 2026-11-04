import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LimitedCheckboxGroup } from "./LimitedCheckboxGroup";

const presentation = {
  label: "Languages",
  description: "Choose your languages.",
  options: ["altmer", "dunmer", "bosmer"],
  optionLabels: { altmer: "Altmeris", dunmer: "Dunmeris", bosmer: "Bosmeris" },
  disabled: false,
};

describe("LimitedCheckboxGroup", () => {
  it("uses controlled selections, blocks additions at the limit, and allows removal and replacement", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function field(selections: readonly string[]) {
      return (
        <MantineProvider env="test">
          <LimitedCheckboxGroup
            {...presentation}
            selections={selections}
            limit={2}
            onChange={onChange}
          />
        </MantineProvider>
      );
    }
    const view = render(field(["altmer"]));
    expect(screen.getByRole("group", { name: "Languages" })).toBeTruthy();
    expect(screen.getByText("Choose your languages.")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Dunmeris" }));
    expect(onChange).toHaveBeenLastCalledWith(["altmer", "dunmer"]);
    expect(screen.getByRole("checkbox", { name: "Dunmeris" })).toHaveProperty(
      "checked",
      false,
    );
    view.rerender(field(["altmer", "dunmer"]));
    const unselected = screen.getByRole("checkbox", { name: "Bosmeris" });
    expect(unselected).toHaveProperty("disabled", true);
    await user.click(unselected);
    expect(onChange).toHaveBeenCalledTimes(1);
    const selected = screen.getByRole("checkbox", { name: "Altmeris" });
    expect(selected).toHaveProperty("disabled", false);
    await user.click(selected);
    expect(onChange).toHaveBeenLastCalledWith(["dunmer"]);
    view.rerender(field(["dunmer"]));
    expect(unselected).toHaveProperty("disabled", false);
    await user.click(unselected);
    expect(onChange).toHaveBeenLastCalledWith(["dunmer", "bosmer"]);
  });

  it("disables the whole field, including selected options", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MantineProvider env="test">
        <LimitedCheckboxGroup
          {...presentation}
          disabled
          selections={["altmer"]}
          limit={2}
          onChange={onChange}
        />
      </MantineProvider>,
    );
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveProperty("disabled", true);
      await user.click(checkbox);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables every option for an empty zero-limit group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MantineProvider env="test">
        <LimitedCheckboxGroup
          {...presentation}
          selections={[]}
          limit={0}
          onChange={onChange}
        />
      </MantineProvider>,
    );
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveProperty("disabled", true);
      await user.click(checkbox);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    "keeps externally over-limit selections removable with limit %s",
    async (limit) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <MantineProvider env="test">
          <LimitedCheckboxGroup
            {...presentation}
            selections={["altmer", "dunmer"]}
            limit={limit}
            onChange={onChange}
          />
        </MantineProvider>,
      );
      const altmer = screen.getByRole("checkbox", { name: "Altmeris" });
      const dunmer = screen.getByRole("checkbox", { name: "Dunmeris" });
      expect(altmer).toHaveProperty("disabled", false);
      expect(dunmer).toHaveProperty("disabled", false);
      expect(screen.getByRole("checkbox", { name: "Bosmeris" })).toHaveProperty(
        "disabled",
        true,
      );
      await user.click(altmer);
      expect(onChange).toHaveBeenLastCalledWith(["dunmer"]);
      expect(altmer).toHaveProperty("checked", true);
    },
  );
});
