# Character Forge engineering notes

Character Forge is a race-only editor backed by Core's headless creator. See the
[Core contract](../../core/README.md#character-creation) for selection rules,
content validation, answer retention, and preview semantics. The browser UI
presents those rules rather than implementing a second rules model.

## Ownership and lifetime

- `creation-kit/src/main.tsx` owns the retryable catalog loader. The shared
  `ContentCatalogProvider` exposes initialization state independently of Forge
  sessions, so leaving the Forge does not discard the application catalog.
- `useCharacterCreator.ts` creates a fresh Core `CharacterCreator` in its effect
  and disposes it during cleanup. React StrictMode effect replay creates a new
  creator rather than reusing the disposed instance.
- `CharacterForge.tsx` owns the editor and draft-preview panes. Core snapshots
  supply control values, choice groups, issues, and navigation availability;
  `getCharacterPreview()` supplies the displayed effects.
- `RaceStep.tsx` owns race browsing, including its independent loading, empty,
  and retry states. Browsing reads summaries, not all race definitions.
  Application initialization notices remain in the shared shell.

The feature files above live in `creation-kit/src/features/character-forge/`;
the provider lives in `creation-kit/src/app/`.

## Asynchronous behavior and feedback

The hook refreshes the snapshot when a selection starts and settles. Session
liveness and per-operation request identities prevent obsolete or unmounted
completions from refreshing the UI, logging failures, or opening a modal. A new
race intent invalidates outstanding bonus operations; different bonus groups can
resolve independently. Core owns which answers and effects remain valid.

A pending or failed race change disables bonus editing and suppresses the old
preview, but leaves race browsing available. Cancel restores the committed race;
retained unresolved bonus selections require resubmission. Resolved groups stay
editable, and invalid answers remain visible without granting effects. An
individual skill load does not hide unrelated valid grants or racial baselines.

Shared accessible spinners are scoped to catalog initialization, race browsing,
race selection, or the individual skill group. Content failures are logged and
shown through the generic “Something went wrong!” modal, not technical inline
messages. Selection logs contain Core's detached issues, not the adapter's original
error or cause. OK acknowledges the failure without clearing Core's failed state;
retry and cancel controls remain available. A new failed retry can open the modal
again. Ordinary choice validation and superseded results do not trigger operational
error feedback. The bold “Choose N” label replaces redundant selection-count
messages, but Core still enforces that requirement.

## Testing strategy

Integration tests use the real `CharacterCreator` with small injectable catalogs.
`testCatalog.ts` supplies content fixtures; `forgeTestHelpers.tsx` supplies shared
rendering helpers and explicitly released deferred reads. Request ordering is
controlled without timer sleeps or mocked rule results.

The Forge tests exercise observable selections, preview effects, scoped loading,
acknowledgment/retry behavior, invalid content, and late completions across route
exit and fresh sessions. Browser-catalog tests cover transport validation and
request sharing; provider tests cover shared initialization across remounts.
Hook tests exercise transient unknown-choice results that snapshot-driven controls
cannot submit, retained internal answers, and actual navigation handler results.
Core tests remain responsible for the shared mechanics themselves.

Run `pnpm --filter @wayshrine/creation-kit test` for browser integration and content
compiler tests, and `pnpm --filter @wayshrine/core test` for the shared rules.

## Limitations and extension boundaries

Only the race step is registered. Back and Next use Core's guards and remain
disabled even with valid race answers; their handlers delegate to `previous()`
and `next()`. The UI does not call `finish()` or claim character completion.
Additional registered steps will need navigation tests through the actual UI and
hook boundaries, not placeholder steps added solely for testing.

The “Unnamed Character (Draft)” preview renders Race, Characteristics, Traits,
and Skills from Core data. It shows nonzero baselines, trait keys and parameters,
and resolved skill ranks, not rolled characteristics or calculated final statistics.
There is no localization system: unresolved labels fall back to readable keys and
placeholder descriptions are omitted.

There is no characteristic generation or Foundry integration. Content is pinned
to the application catalog's revision; updates require a fresh runtime/catalog
and creator rather than swapping content within an active session. See the
[static content maintenance instructions](../../README.md#creation-kit-static-content)
for generation and reload behavior.
