import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChoiceState } from "@wayshrine/core";
import { describe, expect, it, vi } from "vitest";
import { ChoiceGroupField } from "./ChoiceGroupField";

const group: ChoiceState<string> = {
  id: "languages",
  choose: 1,
  options: ["altmer", "dunmer", "bosmer"],
  selections: [],
};

const presentation = {
  optionLabels: { altmer: "Altmeris", dunmer: "Dunmeris", bosmer: "Bosmeris" },
  disabled: false,
  loading: false,
  loadingLabel: "Loading languages",
  visibleIssues: [],
  retryLabel: "Retry languages",
};

describe("ChoiceGroupField", () => {
  it.each([0, 1, 2])("renders a bold Choose %s label", (choose) => {
    render(
      <MantineProvider env="test">
        <ChoiceGroupField
          {...presentation}
          group={{ ...group, choose }}
          onChange={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(
      screen.getByRole("group", { name: `Choose ${choose}` }),
    ).toBeTruthy();
    expect(screen.getByText(`Choose ${choose}`).tagName).toBe("STRONG");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables unselected options at the limit and re-enables them after deselection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function field(selections: readonly string[]) {
      return (
        <MantineProvider env="test">
          <ChoiceGroupField
            {...presentation}
            group={{ ...group, choose: 2, selections }}
            onChange={onChange}
          />
        </MantineProvider>
      );
    }
    const view = render(field(["altmer"]));
    expect(screen.getByRole("checkbox", { name: "Bosmeris" })).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(screen.getByRole("checkbox", { name: "Dunmeris" }));
    expect(onChange).toHaveBeenLastCalledWith(["altmer", "dunmer"]);
    expect(screen.getByRole("checkbox", { name: "Dunmeris" })).toHaveProperty(
      "checked",
      false,
    );
    view.rerender(field(["altmer", "dunmer"]));
    expect(screen.getByRole("checkbox", { name: "Altmeris" })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", { name: "Dunmeris" })).toHaveProperty(
      "checked",
      true,
    );
    await user.click(screen.getByRole("checkbox", { name: "Bosmeris" }));
    expect(screen.getByRole("checkbox", { name: "Bosmeris" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: "Altmeris" })).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(screen.getByRole("checkbox", { name: "Altmeris" }));
    expect(onChange).toHaveBeenLastCalledWith(["dunmer"]);
    view.rerender(field(["dunmer"]));
    expect(screen.getByRole("checkbox", { name: "Altmeris" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(screen.getByRole("checkbox", { name: "Bosmeris" })).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(screen.getByRole("checkbox", { name: "Bosmeris" }));
    expect(onChange).toHaveBeenLastCalledWith(["dunmer", "bosmer"]);
  });

  it.each([0, 1])(
    "allows existing over-limit answers to be corrected when choose is %s",
    async (choose) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <MantineProvider env="test">
          <ChoiceGroupField
            {...presentation}
            group={{ ...group, choose, selections: ["altmer", "dunmer"] }}
            onChange={onChange}
          />
        </MantineProvider>,
      );
      const selected = screen.getByRole("checkbox", { name: "Altmeris" });
      expect(selected).toHaveProperty("disabled", false);
      expect(screen.getByRole("checkbox", { name: "Dunmeris" })).toHaveProperty(
        "disabled",
        false,
      );
      expect(screen.getByRole("checkbox", { name: "Bosmeris" })).toHaveProperty(
        "disabled",
        true,
      );
      await user.click(selected);
      expect(onChange).toHaveBeenCalledWith(["dunmer"]);
      expect(selected).toHaveProperty("checked", true);
    },
  );

  it("disables all unselected options for zero choices without disabling retry", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRetry = vi.fn();
    render(
      <MantineProvider env="test">
        <ChoiceGroupField
          {...presentation}
          group={{ ...group, choose: 0 }}
          onChange={onChange}
          onRetry={onRetry}
        />
      </MantineProvider>,
    );
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveProperty("disabled", true);
      await user.click(checkbox);
    }
    const retry = screen.getByRole("button", { name: "Retry languages" });
    expect(retry).toHaveProperty("disabled", false);
    await user.click(retry);
    expect(onChange).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("lets global disabled override selected options at the limit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRetry = vi.fn();
    render(
      <MantineProvider env="test">
        <ChoiceGroupField
          {...presentation}
          group={{ ...group, selections: ["altmer"] }}
          disabled
          onChange={onChange}
          onRetry={onRetry}
        />
      </MantineProvider>,
    );
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).toHaveProperty("disabled", true);
      await user.click(checkbox);
    }
    const retry = screen.getByRole("button", { name: "Retry languages" });
    expect(retry).toHaveProperty("disabled", true);
    await user.click(retry);
    expect(onChange).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "respects global disabled %s below the selection limit",
    async (disabled) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onRetry = vi.fn();
      render(
        <MantineProvider env="test">
          <ChoiceGroupField
            {...presentation}
            group={group}
            disabled={disabled}
            onChange={onChange}
            onRetry={onRetry}
          />
        </MantineProvider>,
      );
      for (const checkbox of screen.getAllByRole("checkbox")) {
        expect(checkbox).toHaveProperty("disabled", disabled);
        await user.click(checkbox);
      }
      const retry = screen.getByRole("button", { name: "Retry languages" });
      expect(retry).toHaveProperty("disabled", disabled);
      await user.click(retry);
      expect(onChange).toHaveBeenCalledTimes(disabled ? 0 : 3);
      expect(onRetry).toHaveBeenCalledTimes(disabled ? 0 : 1);
      if (!disabled) expect(onRetry).toHaveBeenCalledWith();
    },
  );

  it("scopes its supplied loading indicator without disabling either field", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onOtherChange = vi.fn();
    render(
      <MantineProvider env="test">
        <section aria-label="Pending choice">
          <ChoiceGroupField
            {...presentation}
            group={group}
            loading
            onChange={onChange}
          />
        </section>
        <section aria-label="Other choice">
          <ChoiceGroupField
            {...presentation}
            group={{ ...group, id: "other" }}
            onChange={onOtherChange}
          />
        </section>
      </MantineProvider>,
    );
    const pending = within(
      screen.getByRole("region", { name: "Pending choice" }),
    );
    const other = within(screen.getByRole("region", { name: "Other choice" }));
    expect(
      pending.getAllByRole("status", { name: "Loading languages" }),
    ).toHaveLength(1);
    expect(other.queryByRole("status")).toBeNull();
    await user.click(pending.getByRole("checkbox", { name: "Altmeris" }));
    await user.click(other.getByRole("checkbox", { name: "Dunmeris" }));
    expect(onChange).toHaveBeenCalledWith(["altmer"]);
    expect(onOtherChange).toHaveBeenCalledWith(["dunmer"]);
  });

  it("presents supplied visible issues verbatim as statuses without adapting them", () => {
    render(
      <MantineProvider env="test">
        <ChoiceGroupField
          {...presentation}
          group={group}
          visibleIssues={[
            "Choose exactly one language.",
            "Retry this language.",
          ]}
          onChange={vi.fn()}
        />
      </MantineProvider>,
    );
    expect(
      screen.getAllByRole("status").map((status) => status.textContent),
    ).toEqual(["Choose exactly one language.", "Retry this language."]);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
