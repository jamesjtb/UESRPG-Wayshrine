# Character Sheet roadmap

## Direction

Replace Character Forge's editor-and-preview layout with **Character Sheet**: a
character sheet as the primary interface, with a modal wizard guiding character
creation over it.

Development is **character-creation first**. The sheet will take shape as each
creation step is implemented. During-play functionality, such as resource tracking,
follows complete character creation.

This is a redesign of the experience, not a ground-up rewrite. Preserve existing
rules, state management, validation, content access, and suitable UI components.

## Experience principles

- The sheet and wizard present the same character state.
- Creation choices update the sheet as the player progresses.
- Players may dismiss the wizard to inspect the unfinished sheet, then resume at
  the current step without losing choices.
- Dismissing the wizard does not complete character creation.
- Core remains responsible for rules, calculations, validation, and progression
  guards. The interface presents its results.
- Each new creation step includes the corresponding sheet representation.
- Incomplete sheets should remain useful without implying that unfinished values
  are final.

## Milestone 1: Establish the Character Sheet experience

Rename the app section to **Character Sheet**, introduce the sheet shell and
creation modal, and adapt the two implemented steps:

1. Choose Race
2. Generate Characteristics

Reuse their existing behavior and validation. Move the relevant preview information
into the sheet rather than maintaining a separate competing preview.

Keep the creator session outside the modal so dismissing or changing wizard steps
does not discard it.

### Completion criteria

- Character Sheet opens onto the sheet-based interface.
- Both existing creation steps work inside the modal.
- Their results appear on the underlying sheet.
- Dismissing and reopening the modal preserves choices and the current step.
- Existing navigation, validation, loading, error handling, and answer-retention
  behavior remain intact.
- The modal is usable with keyboard navigation and on smaller screens.
- The interface does not claim that full character creation is available.

This milestone does not add Birthsign or during-play functionality.

## Milestone 2: Complete the creation sequence

Implement the remaining steps in order. Deliver each step alongside its rules,
content requirements, validation, and sheet representation.

| Step | Scope |
| --- | --- |
| 3. Determine Birthsign | Birthsign selection and its character effects |
| 4. Spend XP | Creation-time XP spending and resulting character changes |
| 5. Calculate Attributes | Required attribute calculations and their sheet presentation |
| 6. Purchase Gear | Creation-time purchasing and starting equipment |
| 7. Generate Lucky Numbers | Lucky-number generation and sheet presentation |
| 8. Fill Out Character Details | Remaining character information |
| 9. Bonds — optional | Optional bond entry and sheet presentation |
| 10. Character Traits — optional | Optional character-trait entry and sheet presentation |

The first two steps remain part of this sequence but are already implemented.

For each step:

- Confirm the applicable rules and acceptance criteria before implementation.
- Extend Core where rules or workflow support is missing.
- Add the wizard interface and corresponding sheet content together.
- Preserve navigation and answer retention.
- Define how changing earlier choices affects later answers and calculated results.
- Test rules in Core and user-facing behavior through integration tests.

Bonds and Character Traits must be explicitly skippable and must not block
completion when omitted.

## Milestone 3: Complete the creation lifecycle

Connect the full sequence into a coherent start-to-finish experience.

- Provide final review and a clear completion action.
- Require all mandatory steps to be valid before completion.
- Present the completed character on the sheet without requiring the wizard to
  remain open.
- Verify backward navigation and the effects of revising earlier choices across
  the full sequence.
- Resolve saving, reopening, and unfinished-character handling before declaring
  the creation experience complete.

Completing only the currently implemented steps must not be presented as
completing a character.

## Milestone 4: Support characters during play

After character creation is complete, extend the sheet with during-play
interactions, beginning with resource tracking.

Define the detailed scope separately. Creation-time calculations and starting
values belong in earlier milestones; consuming, restoring, and otherwise managing
resources during play do not.

## Delivery approach

- Agree on an implementation plan for each phase before beginning it.
- Deliver one authorized phase at a time, preserving unrelated work.
- Report changes, affected files, checks run, and deviations.
- Stop for review before starting the next phase.
- Update existing engineering documentation as the implemented architecture
  changes.

## Open decisions

Resolve these when needed for the relevant milestone:

- Detailed sheet layout and responsive behavior.
- Persistence and cross-session resumption of unfinished characters.
- Editing completed characters and its relationship to the creation wizard.
- Detailed rules and interactions for each unimplemented creation step.
- The scope and priority of during-play features.
