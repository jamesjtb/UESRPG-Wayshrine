# Wayshrine Core

Core owns platform-independent rules and headless workflows. Creation Kit and
Foundry must use the same `CharacterCreator` and `Wizard`; their content adapters
and presentation live outside this package.

## Shared content access

`ContentCatalog` has two asynchronous operations:

- `list(kind)` returns lightweight `{ key, label }` entries.
- `get(kind, key)` returns one plain Core definition, or `undefined` for an absent
  key. Loading, access, malformed-content, and compatibility failures reject with
  `ContentError`.

Kinds currently supported are `race`, `skill`, and `trait`. Keys are stable within
their kind. Host document IDs must never become Core content keys or rule inputs.

The host initializes one catalog instance per application runtime and supplies it
to its tools. Core does not initialize a global singleton or inspect host globals.
Catalog initialization failures should remain retryable. There are no production
adapters in Core.

Every catalog represents an immutable `{ schemaVersion, revision }`. The schema
version must match `CONTENT_SCHEMA_VERSION`. A creator pins the revision when it is
constructed and checks it before and after content reads. Adapters must also check
their response/pack revision; Core cannot detect a mismatched response if an adapter
silently reports the wrong metadata. Updating content means starting a new runtime
catalog and creator, not replacing definitions during an active session.

Adapters should deduplicate in-flight reads without retaining complete definition
catalogs. Browser HTTP caching and Foundry's own compendium retention belong to
their respective hosts; persistent browser storage is not required.

## Character creation

```ts
import { CharacterCreator } from "@wayshrine/core";
import type { ContentCatalog } from "@wayshrine/core";

function startCreator(catalog: ContentCatalog) {
  return new CharacterCreator(catalog);
}

async function selectAltmer(creator: CharacterCreator) {
  const race = await creator.chooseRace("altmer");
  if (!race.ok) return race;

  return creator.chooseRacialBonus("altmer/magical-training", ["alchemy"]);
}
```

Only selection commands do content I/O. `getSnapshot()`, `getCharacterPreview()`,
`next()`, `previous()`, and `finish()` remain synchronous and never fetch or roll
dice. Only the race step exists; finishing it is not a complete implementation of
all character-creation rules. Characteristic generation is not implemented.

Selecting a race loads its definition and, if needed, the lightweight skill index.
Every offered skill key must exist, including unselected options. Racial trait
definitions are loaded individually to validate references and parameters, then
released. The complete skill index is also released; the creator keeps only the
current race's offered summaries and reference-validation results.

Full skill definitions load only for submitted valid selections. The creator keeps
the selected race, selected skills, and its answers—not complete catalogs. Content
is detached from adapter-owned objects when read; snapshots, previews, results, and
issues are also detached from creator state.

### Editing and failures

- Choice groups each specify `choose`; `validateChoice` supplies shared mechanics.
- Racial skills grant only Novice training, deduplicating overlapping grants.
- Invalid or unresolved groups grant no effects. Invalid answers stay visible for
  correction. An invalid racial trait reference/parameter prevents all racial
  effects until the content is corrected in a new session.
- Selecting the same race preserves its answers without reloading. Changing race
  clears only race-owned answers. Future downstream steps must retain their inputs,
  revalidate them, and apply only still-valid effects.
- The latest command for a race or bonus group wins. Independent bonus groups can
  resolve concurrently. Obsolete completions return a `superseded` issue and cannot
  overwrite current answers or errors.
- `contentLoads` identifies pending or failed operations. Pending/failed required
  content blocks finishing. Resubmit the command to retry a loading failure.
- Unknown races and choices leave committed answers unchanged. Failed race loads
  also preserve the last committed answers, but suppress the preview while the
  requested change is unresolved. `cancelRaceSelection()` restores that committed
  preview. Reselecting the committed race also cancels the change.
- Starting a different race request invalidates pending bonus loads. If that race
  change is canceled, unresolved retained bonus answers need resubmission; resolved
  bonus answers remain usable.
- `dispose()` releases session-owned content and answers and invalidates pending
  commands. It does not dispose the host's shared catalog.

## Content validation

`parseContentDefinition(kind, key, value)` validates external definitions with Zod,
checks skill-key consistency, and returns detached data. Definition schemas reject
unknown fields, including host metadata. `validateRaceContent` performs pure choice
and reference checks using caller-supplied skill keys and trait definitions.

Skill definitions either supply governing characteristic keys or explicitly allow
a player-selected characteristic. Custom names and chosen characteristics belong
to `SkillTraining`, not the shared definition. Optional skill display text can be
resolved by the host; browsing labels may fall back to content keys.

YAML under `content/` remains the authoring source. Its top-level map keys identify
definitions. Creation Kit's build-time compiler derives `skillKey` from that key
and rejects contradictory authored values. It validates definitions and race
references with these shared Core validators before publishing static JSON.
YAML parsing stays in host build scripts and tests, never in Core runtime code.
See the root README for artifact generation, layout, and Creation Kit's browser
catalog adapter. Version-specific Foundry pack generation is not implemented yet.

## Checks

Run `pnpm --filter @wayshrine/core test` for compile-time checks and runtime tests,
including validation of the actual YAML catalogs and their race references.
Node/test-runner types stay isolated from Core's platform-independent source check.
