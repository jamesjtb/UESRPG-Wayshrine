import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import type { ContentCatalog } from "@wayshrine/core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fixtureCatalog } from "../testCatalog";
import { useCharacterCreator } from "../useCharacterCreator";
import { CharacterPreview } from "./CharacterPreview";
import { ForgeWorkspace } from "./ForgeWorkspace";
import { StepNavigation } from "./StepNavigation";

function WorkspaceSession({ catalog }: { catalog: ContentCatalog }) {
  const { view, chooseRace, chooseRacialBonus, previous, next } =
    useCharacterCreator(catalog);
  const [replaced, setReplaced] = useState(false);
  if (!view) return null;
  let editor = (
    <button onClick={() => chooseRace("altmer")}>Select Altmer</button>
  );
  if (replaced) {
    editor = (
      <section aria-label="Replacement editor">
        <button onClick={() => chooseRacialBonus("altmer/magic", ["alchemy"])}>
          Select Alchemy
        </button>
      </section>
    );
  }
  return (
    <>
      <button onClick={() => setReplaced(true)}>Replace editor</button>
      <ForgeWorkspace
        editor={editor}
        navigation={
          <StepNavigation
            canGoPrevious={view.snapshot.canGoPrevious}
            canGoNext={view.snapshot.canGoNext}
            onPrevious={previous}
            onNext={next}
          />
        }
        preview={<CharacterPreview preview={view.preview} />}
      />
    </>
  );
}

describe("ForgeWorkspace composition", () => {
  it("keeps the frame, preview and Core session alive when the editor changes or is replaced", async () => {
    const user = userEvent.setup();
    const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
    const catalog = fixtureCatalog();
    const { unmount } = render(
      <MantineProvider env="test">
        <WorkspaceSession catalog={catalog} />
      </MantineProvider>,
    );
    const editorPane = screen.getByRole("region", { name: "Character editor" });
    const previewPane = screen.getByRole("region", { name: "Character sheet" });
    const heading = within(previewPane).getByRole("heading", {
      name: "Unnamed Character (Draft)",
    });
    const navigation = screen.getByRole("navigation", {
      name: "Character creation navigation",
    });
    expect(previewPane.tabIndex).toBe(0);
    expect(navigation.closest("footer")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Select Altmer" }));
    await within(previewPane).findByText("Int: 30");
    previewPane.scrollTop = 120;
    await user.click(screen.getByRole("button", { name: "Replace editor" }));
    expect(screen.queryByRole("button", { name: "Select Altmer" })).toBeNull();
    expect(
      within(editorPane).getByRole("region", { name: "Replacement editor" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Select Alchemy" }));
    await within(previewPane).findByText("Alchemy (Novice)");
    expect(screen.getByRole("region", { name: "Character editor" })).toBe(
      editorPane,
    );
    expect(screen.getByRole("region", { name: "Character sheet" })).toBe(
      previewPane,
    );
    expect(
      within(previewPane).getByRole("heading", {
        name: "Unnamed Character (Draft)",
      }),
    ).toBe(heading);
    expect(
      screen.getByRole("navigation", { name: "Character creation navigation" }),
    ).toBe(navigation);
    expect(previewPane.scrollTop).toBe(120);
    expect(dispose).not.toHaveBeenCalled();
    unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(await catalog.list("race")).toHaveLength(3);
  });
});
