# UESRPG Wayshrine

UESRPG Wayshrine is a monorepo that is intended to house all digital tools available for UESRPG, a community-created TTRPG set in the Elder Scrolls universe.

**UESRPG Wayshrine is a Work-in-Progress.**

## Development

### Requirements

- Node.js 24 LTS (also specified in `.node-version`).
- pnpm 12.14.0, pinned in the root `package.json`.

From the repository root:

```sh
pnpm install
pnpm typecheck
pnpm format:check
pnpm start:wck dev
```

Run `pnpm format` to apply formatting.
Run `pnpm --filter @wayshrine/creation-kit test` for Creation Kit navigation,
routing, and static content compiler tests.

### Mantine type compatibility

`patches/@mantine__core@9.7.3.patch` aligns Mantine's shared input and close-button
declarations with React's optional HTML properties under `exactOptionalPropertyTypes`.
pnpm applies this declaration-only patch on install; no runtime code is changed.
When upgrading Mantine, check whether the patch is still needed by running
`pnpm typecheck` without it.

Creation Kit also includes `ES2025.Collection` types because Mantine Hooks references
`ReadonlySetLike`. The JavaScript target remains ES2022; this adds type declarations,
not runtime polyfills. Strict checking remains enabled, including dependency declarations.

### Workspaces

| Path           | Package                   | Responsibility                                                                                                                        |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `vtt/foundry`  | `@wayshrine/foundry`      | Foundry system skeleton. The target Foundry version, manifest, typings, and bundling are deferred; this is not yet a loadable system. |
| `core`         | `@wayshrine/core`         | Platform-independent TypeScript domain types for UESRPG 3ev4. No server or separate build.                                            |
| `creation-kit` | `@wayshrine/creation-kit` | React + Vite browser application, initially a placeholder shell. No backend or game workflows are implemented.                        |

Both applications depend on Core through `workspace:*`. Import domain types from
`@wayshrine/core` using `import type`. Domain interfaces live in `core/interface/`,
and enums live in `core/src/enum/`. Import enums as values when using their members.
Runtime boundary validation can be added when needed.
Core must remain independent of React, Foundry,
and both application workspaces so that Creation Kit can work without a VTT and
other VTT integrations remain possible.

### Core creation workflows

Core exports a headless `Wizard`, shared choice types and `validateChoice`, and
`CharacterCreator`. Run `pnpm --filter @wayshrine/core test` for model checks and
runtime workflow tests. Test-runner environment types are isolated from Core's
platform-independent source checks.

`CharacterCreator` takes race and skill catalogs. Call `chooseRace(raceKey)`, then
use `getSnapshot().racialBonusChoices` to display each group's stable, source-scoped
ID, `choose` requirement, options, and current selections. Submit selections with
`chooseRacialBonus(choiceId, selections)`. Each selected skill grants Novice training;
overlapping grants produce only one skill entry. The current catalog's Altmer group
requires one skill.

Snapshots include resolved groups for editing, pending choices, and validation
issues. Invalid bonus answers remain visible for correction but grant no effects.
Changing race clears its bonus answers and rebuilds baselines, traits, and skills;
selecting the same race preserves its answers. `getCharacterPreview()` returns a
detached preview. Catalogs and returned data cannot mutate the creator's stored state.

The shared wizard evaluates ordered steps on every operation. Evaluators must be
pure and tolerate an incomplete draft. `next()` checks all steps through the current
one, `previous()` preserves answers, and `finish()` validates every registered step.
Operations return `{ ok, value }` or `{ ok, issues }`; a rejected bonus answer is
stored for correction, while an unknown race or choice leaves answers unchanged.
Only the race step is implemented so far; characteristic generation remains future
work. Future steps should retain their inputs, reevaluate validity after upstream
edits, and apply only valid effects. Evaluation must never generate or reroll dice.

### Creation Kit source layout

Creation Kit uses a hybrid, feature-grouped React layout under `creation-kit/src/`:

- `app/`: application composition, providers, routing, and application tests.
- `layouts/`: persistent page framing and navigation, grouped by layout.
- `pages/`: general route-level screens such as Home and Not Found.
- `test/`: shared test setup and helpers.

Add the following folders when code needs them, rather than creating empty placeholders:

- `features/<tool>/`: each tool's pages, components, hooks, and model logic.
- `components/`: UI shared across tools.
- `hooks/`: React behavior shared across tools.
- `lib/`: shared non-React functionality and browser integrations.
- `assets/` and `styles/`: application assets and shared styles.

Keep code with the feature that owns it; move it into shared folders only when
there is a genuine shared use. Keep pages thin and colocate tests and styles with
the code they exercise. Use Mantine directly instead of wrapping every control.
Keep types with their owning module; cross-application contracts belong in Core.

### Creation Kit deployment

```sh
pnpm --filter @wayshrine/creation-kit build
pnpm --filter @wayshrine/creation-kit preview
```

The build produces `creation-kit/dist/`, which can be served by any static host
without a dedicated application server. Relative asset paths support hosting in
a subdirectory. The preview command is for checking the build locally, not for
production hosting.

Creation Kit uses hash routes (for example, `/#/`) so direct links work on static
hosts without URL rewrite rules. The responsive left navigation supports an
icon-only desktop mode and a mobile menu. Home is currently the only available
page; all six planned tools remain disabled until their workflows are implemented.

### Creation Kit static content

`dev` and `build` first run `pnpm --filter @wayshrine/creation-kit generate:content`.
The compiler reads sorted `.yml` and `.yaml` files directly in
`core/content/{races,skills,traits}/`, rejects malformed or duplicate definitions,
and uses Core's definition, choice, and reference validators. These are the only
content inputs; top-level map keys are stable definition keys, not filenames.
Restart the dev server after editing YAML; there is no content watcher yet.

Generated files live in ignored `creation-kit/public/content/` and are copied to
`dist/content/` by Vite, with no YAML parser or authored YAML in the browser bundle:

- `manifest.json`: `{ schemaVersion, revision }`.
- `<revision>/<kind>/index.json`: `{ version, kind, entries }`, where `version` is
  the manifest shape and entries contain only `{ key, label }`.
- `<revision>/<kind>/definitions/<encoded-key>.json`:
  `{ version, kind, key, definition }`, with a plain Core definition.

Kinds are `race`, `skill`, and `trait`. Definition filenames use `encodeURIComponent`
with dots and remaining URI punctuation (`!'()*`) additionally percent-encoded.
HTTP consumers must URL-encode the resulting filename as one path segment (so
literal percent signs in filenames survive URL decoding). The `definitions/`
directory prevents a key named `index` from colliding with the browse index.
Labels remain authored localization placeholders, falling back to the key when
absent; there is no translation infrastructure.

The SHA-256 revision covers validated content, Core's schema version, and the
artifact-format version. Object keys and definition ordering are canonicalized;
array order remains significant. Filenames, comments, and YAML formatting do not
affect revisions. Shared transport schemas live in
`creation-kit/src/lib/content/artifacts.ts`; bump `CONTENT_ARTIFACT_FORMAT` if the
transport layout or filename encoding changes.

The compiler validates all content and prepares every JSON file before changing
output. On success it deletes and recreates `creation-kit/public/content/`.
This directory is entirely generated: any files placed there are removed, including
old revisions. A validation failure leaves previous output untouched; a disk-write
failure can leave incomplete output. This is a pre-dev/pre-build step, not runtime-safe
hot publication. Restart/reload after a content update. Keeping one build revision
on disk is separate from any future browser catalog's memory-retention policy.

The shared definition envelope schema validates transport metadata only. Content
readers must explicitly call Core's `parseContentDefinition` for its payload;
the generator already does this when loading YAML.

The browser catalog initializes from the manifest and pins all later reads to that
revision. It validates response metadata and uses Core to validate each requested
definition. Only lightweight indexes remain cached; concurrent definition reads
share a pending request, then release it on success or failure. Returned values are
detached, and indexed files that fail to load are errors, not absent keys.

`main.tsx` owns one retryable catalog loader for the application runtime and injects
it through the app providers. Consumers share that catalog independently of their
mount/unmount lifetimes. Loading and retryable initialization errors do not block
Home or navigation. Content changes require a fresh runtime/catalog/creator, not
polling or swapping an active session's revision. Character Forge's existing shell
is unchanged; race editing and character preview integration remain future work.

Node types and YAML/TS execution dependencies are isolated to build-script checks,
outside Core runtime and Creation Kit's browser TypeScript configuration.

## Project Goals

### Project Longevity

To ensure the longevity of this project, it must pass the "Bus Test". Passing the Bus Test is simple: you ask the question "if the maintainer of this project is hit by a bus, does it all fall apart?". If the answer is yes, then the project has failed the Bus Test.

### Decouple Digital Tooling from the VTT

Digital tools that provide workflows like character creation/advancement, crafting tools, etc should not require the purchase of Foundry for UESRPG players to gain access. The decoupled digital tools provided by this project should have an option for free and easy rehosting. Furthermore each digital tool should provide multiple exports of the results of their workflows that can be used at any physical table or VTT.

Currently planned formats: PDF documents for editable form-filled .pdfs, images for uneditable, aesthetically pleasing character/item cards, and Foundry VTT with the door left open for other VTT exports.

## Services

### Wayshrine Creation Kit (WCK)

Provide guided game prep workflows and some gameplay workflows for both GMs and Players.

#### Planned Tools

These are the planned tools for the project's full release. Additional features may be implemented post-release.

- [ ] Character Forge - Covers character creation and advancement
- [ ] NPC Profile Editor[^1] - Covers creation and editing of NPC Profiles
- [ ] Unconventional Spell Creator[^1] - Covers the creation of unconventional spells
- [ ] Enchantment Creator[^1] - Covers constant, strike, and cast enchantments
- [ ] Alchemist Workflows[^1] - Covers potion and poison creation (including toxins)
- [ ] Loot Generator[^1] - Covers procedural generation of artifacts, equipment, enchanted items, spell scrolls and tomes, and potions and poisons. Achieved by automating workflows established by other tools to create items that follow the official rules of the game, and can be opened in the relevant tool for editing where possible.

[^1]: Name TBD

### Wayshrine Core

Wayshrine Core is responsible for facilitating communication between the Wayshrine Creation Kit and the Foundry System Module (and other potential VTTs). This includes providing shared Typescript types between the two services.

#### Phases

Wayshrine Core will be deployed in two stages:

- [ ] shared types - this is the invisible compatibility layer between the VTT and WCK. Users will need to manually import the results from WCK into the VTT, likely by way of copy+paste to start.
- [ ] true integration - the current goal is to fully integrate Foundry and WCK so that WCK tools can be rendered from within the foundry system. This is subject to change and is likely the final priority to tackle before 1.0. The first attempt at this will shed light on how realistic "true integration" between WCK and foundry truly is, so temper expectations.

### Foundry System Module

Provide a system module for Foundry VTT to facilitate moment-to-moment gameplay.

This is the planned scope for the project's full release. Additional features may be implemented post-release. Items that have been checked off have been implemented, but are still subject to drastic change until full release.

#### System Module Scope

##### Rules Compendium

Presented in order of appearance in the Rules Compendium, not in planned order of release.

**Chapter 1**

- [ ] basic gameplay
  - [ ] tests
    - [ ] standard tests
    - [ ] simple tests
    - [ ] opposed tests
    - [ ] extended tests
    - [ ] characteristic tests
    - [ ] skill tests
  - [ ] tests and other die rolls triggered by automated workflows prompt the relevant player before the roll is made
- [ ] player character sheet
  - [ ] Sheet layout, including sections for:
    - [ ] characteristics
    - [ ] attributes
    - [ ] skills
    - [ ] talents
    - [ ] traits
    - [ ] magic
    - [ ] items & encumbrance
    - [ ] active effects
  - [ ] stamina point abilities with automatic SP expenditure
  - [ ] luck
    - [ ] luck point abilities
    - [ ] burning luck
  - [ ] long & short rests
  - [ ] import character advancement results from Character Forge

**Chapter 2**

- [ ] import character creation results from Character Forge

**Chapter 3**

- [ ] skill item sheet
- [ ] provide official skills as compendium items

**Chapter 4**

- [ ] talents
  - [ ] talent item sheet
  - [ ] provide official talents as compendium items
- [ ] traits
  - [ ] trait item sheet
  - [ ] provide official traits as compendium items

**Chapter 5**

- [ ] combat workflows
  - [ ] initiative
  - [ ] attacking and defending (incl. hit location resolution)
  - [ ] action economy automation
  - [ ] death
  - [ ] apply the relevant penalties/bonuses to attacks based on the size of the target of the attack
- [ ] rollable tables in the compendium
  - [ ] hit locations
  - [ ] fear tables
  - [ ] diseases
- [ ] diseases
  - [ ] disease item sheet
  - [ ] provide official diseases as compendium items (curses will be covered alongside elite advances)

**Chapter 6**

- [ ] spellcasting
  - [ ] spell item sheet
  - [ ] conventional spell compendium items
  - [ ] import created unconventional spells from the spellcrafting tool
  - [ ] ritual item sheet
  - [ ] spellcasting workflow
  - [ ] MP cost deduction, including restraint
  - [ ] automatically apply spell damage and effects (including required rolls)
- [ ] alchemy
  - [ ] potion/poison/toxin item sheets
  - [ ] import crafted potion/poison/toxin from alchemy
- [ ] include rollable mishap tables in compendium
- [ ] enchanting
  - [ ] enchantment item sheets applied to equipment item sheets
  - [ ] import created enchantments from the enchanting tool

**Chapter 7**

- [ ] Item Sheets
  - [ ] good - defined in the "Goods & Services" section
  - [ ] soul gem - dedicated sheet type or just another good with extra values?
  - [ ] spell tome - ""
  - [ ] alchemical ingredient - ""
  - [ ] weapon
  - [ ] armor
  - [ ] shield
  - [ ] assign prices to previously implemented item sheets where necessary (potions, enchantments, etc)

**Chapter 8**

TBA - likely after 1.0
