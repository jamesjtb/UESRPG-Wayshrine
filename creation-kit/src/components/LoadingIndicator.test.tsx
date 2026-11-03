import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LoadingIndicator } from "./LoadingIndicator";

it("announces loading once without visible duplicate text", () => {
  render(
    <MantineProvider env="test">
      <LoadingIndicator label="Loading content" />
    </MantineProvider>,
  );
  const status = screen.getByRole("status", { name: "Loading content" });
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(status.textContent).toBe("");
  expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
});
