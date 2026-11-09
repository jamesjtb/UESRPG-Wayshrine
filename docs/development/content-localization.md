# Content localization contract

## Status and scope

This document records the existing content inventory and the **proposed** authoring
and compilation contract. Localization is not implemented. No locale catalogs,
compiler changes, runtime changes, or translated rules text accompany this document.
Statements under “Proposed contract” describe later work, not current capabilities.

Cover all currently authored races, traits, skills, and birthsigns, including
birthsign authoring even though birthsigns are not a runtime `ContentCatalog` kind.
Do not expand that runtime catalog to deliver localization. UI localization,
language pickers, Foundry pack compilation, and birthsign rules/workflow expansion
are outside this scope.

English is authoritative. Contributors translate that source into their other
native languages. Transfer of actual approved rules prose is **later work**, not a
prerequisite for delivering the localization infrastructure. Until it is available,
use explicitly marked temporary text; never reconstruct rules from mechanical data
or invent prose to make coverage appear complete.

## Current implementation

- `core/content/` contains six YAML files. Top-level map keys identify definitions;
  filenames do not. There is no `core/locales/` directory or locale resolver.
- `Race`, `Trait`, and `Birthsign` require `label` and `description`; `Skill` makes
  both optional. Trait parameter declarations are names only. Applied parameter
  values are `string | number`, without semantic categories.
- `core/src/content/schemas.ts` validates races, skills, and traits, but accepts
  display strings without interpreting references or template placeholders.
  `validateRaceContent.ts` checks skill/trait references and exact trait parameter
  names, not parameter meaning or display formatting. Birthsigns have domain types
  but no parser in `parseContentDefinition` or runtime catalog kind.
- `creation-kit/scripts/generate-content.ts` reads only races, skills, and traits,
  derives `skillKey`, validates definitions and racial references, and emits JSON.
  It copies authored display references unchanged; skill index labels fall back to
  keys. The SHA-256 revision covers validated content, Core schema version, and
  artifact format, with sorted object keys and meaningful array ordering.
- The static manifest is `{ schemaVersion, revision }`; indexes and definitions
  carry that version. The browser adapter pins it and checks every response.
  `ContentVersion` is immutable for a catalog/creator lifetime. See
  [Core content access](../../core/README.md#shared-content-access) and
  [static content setup](../../README.md#creation-kit-static-content).
- Forge's `labels.ts` humanizes keys when labels contain `{LOCALE` and suppresses
  such descriptions. That is a presentation workaround, not localization or English
  fallback. It is not a policy for publishing unresolved content.
- Foundry is a skeleton, with no content adapter or pack compiler. Neither host
  currently provides the proposed content localization pipeline.

## Authored inventory

Counts below describe definitions, not implemented game-system completeness.
Every existing display reference has the exact form
`{LOCALE.<domain>.<contentKey>.<field>}` with `field` equal to `label` or
`description`. There are no inline rules descriptions in these files and no locale
values to resolve the references.

| Source under `core/content/` | Entries | Display fields today       | Proposed coverage                       |
| ---------------------------- | ------: | -------------------------- | --------------------------------------- |
| `races/core.yml`             |       2 | Both fields are references | 4 English keys                          |
| `traits/core.yml`            |      44 | Both fields are references | 88 English keys                         |
| `traits/racial.yml`          |       2 | Both fields are references | 4 English keys                          |
| `skills/standard.yml`        |      20 | Both fields absent         | Add 40 explicit references/English keys |
| `skills/spellcasting.yml`    |       7 | Both fields absent         | Add 14 explicit references/English keys |
| `birthsigns/core.yml`        |      12 | Both fields are references | 24 English keys, authoring only         |

There are 120 existing display references and 54 absent skill display fields:
174 label/description keys in total. Canonical parameter-display terms are deferred.
English key coverage does not mean approved rules prose has been transferred.

### Races and their references

- `altmer`: traits `diseaseResistance` (`X: 50`), `powerWell` (`X: 20`),
  `weakness` (`type: magic`, `X: 2`), and `mentalStrength`. Its
  `magical-training` choice selects one of `alchemy`, `alteration`, `conjuration`,
  `destruction`, `enchant`, `illusion`, `mysticism`, `necromancy`, `restoration`.
- `argonian`: traits `diseaseResistance` (`X: 75`), `immunity` (`type: poison`),
  `amphibious`, and `inscrutable`. No racial skill choice is authored.

The existing trait/skill targets are present. Baseline characteristic keys and
numbers, choice IDs, counts, option order, and trait references are mechanical data,
not translation keys. No other races are authored in this inventory.

### Traits and parameters

`traits/core.yml` contains:

`amphibious`, `bestial`, `blind`, `bound`, `climber`, `crawler`, `darkSight`,
`dawnCursed`, `deaf`, `diseaseResistance`, `diseased`, `flyer`, `frightening`,
`fromBeyond`, `immunity`, `incorporeal`, `naturalToughness`, `naturalWeapons`,
`powerWell`, `quadruped`, `regeneration`, `resistance`, `resistNormalWeapons`,
`runningOutOfLuck`, `savage`, `silverScarred`, `skeletal`, `spellAbsorption`,
`strongJaws`, `stuntedMagicka`, `summoned`, `sunScarred`, `swimmer`, `telepathy`,
`thickSkull`, `vicious`, `telekinesis`, `terrifying`, `tough`, `weakBones`, `weakness`,
`undead`, `undying`, `unnaturalSenses`.

`traits/racial.yml` adds `mentalStrength` and `inscrutable`, neither parameterized.
The 24 parameterized traits declare:

| Declaration               | Trait keys                                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X`                       | `climber`, `dawnCursed`, `diseaseResistance`, `diseased`, `flyer`, `frightening`, `naturalToughness`, `powerWell`, `regeneration`, `resistNormalWeapons`, `silverScarred`, `spellAbsorption`, `sunScarred`, `telepathy`, `vicious`, `telekinesis`, `terrifying`, `tough`, `weakBones` |
| `type`                    | `immunity`                                                                                                                                                                                                                                                                            |
| `type`, `X`               | `resistance`, `weakness`, `unnaturalSenses`                                                                                                                                                                                                                                           |
| `type`, `damage`, `range` | `naturalWeapons`                                                                                                                                                                                                                                                                      |

All other traits declare no parameters. Only `diseaseResistance`, `powerWell`,
`weakness`, `immunity`, and `spellAbsorption` have parameterized applications in the
authored races/birthsigns. Existing applications use numeric `X` and string `type`
values `magic`, `poison`, or `fire`. No actual locale template exists yet, so there
are no authored `{X}` occurrences to validate against these declarations.

Do not infer that every `X` is numeric from its name, that every `type` shares one
vocabulary, or that `damage`/`range` are numbers, dice expressions, units, or free
text. Those categories are not specified by the current types or unused templates.

### Skills

Standard keys: `acrobatics`, `alchemy`, `athletics`, `combatStyle`, `command`,
`commerce`, `deceive`, `enchant`, `evade`, `investigate`, `logic`, `lore`, `navigate`,
`observe`, `persuade`, `profession`, `ride`, `stealth`, `subterfuge`, `survival`.

Spellcasting keys: `alteration`, `conjuration`, `destruction`, `illusion`,
`mysticism`, `necromancy`, `restoration`.

All 27 lack both display fields. Governing characteristic references are mechanical
keys. `combatStyle` and `profession` permit custom names; `profession` also permits
a chosen governing characteristic. These player answers are not catalog prose to
translate. Do not infer skill descriptions from names or characteristics.

### Birthsigns and text gaps

Keys: `theWarrior`, `theLady`, `theSteed`, `theLord`, `theMage`, `theApprentice`,
`theAtronach`, `theRitual`, `theThief`, `theLover`, `theShadow`, `theTower`.
All have top-level display references and `starCursed` mechanical data. There is no
separate star-cursed display text or display field for choice groups/options.

- Trait targets: `weakness` (`type: fire`, `X: 2`; `type: magic`, `X: 2` or `3`),
  `powerWell` (`X: 10`, `25`, `50`, `75`), `spellAbsorption` (`X: 5`),
  `stuntedMagicka`, and `runningOutOfLuck`. All these trait keys exist.
- Power targets: `blessedTouch`, `blessedWord`, `marasGift`, `akaviriDangerSense`,
  `moonshadow`, `treasureSeeker`. No power definitions or power display prose are
  authored. Preserve these references; localization does not create a power catalog.
- Choice IDs: `theSteedPenalty`, `theMagePenalty`, `theAtronachPenalty`,
  `theRitualPower`, `theLoverPenalty`, `theShadowPenalty`, `theTowerPenalty`.
  Penalty options use characteristic IDs; Ritual options use power IDs.
- Characteristic targets (`str`, `end`, `ag`, `wp`, `prc`, `prs`, `lck`), attribute
  targets (`spMaximum`, `speed`), `naturalHealing`, bonus discriminants, lifecycle
  tokens, eligibility flags, counts, and all bonus values remain mechanical data.

The 12 signs are the entire authored set; do not add an unauthored sign for coverage.
Top-level descriptions may eventually contain approved variant explanation, but
this contract does not invent a new variant/option/power display schema or prose.
Those gaps remain visible for later birthsign work, without requiring runtime
birthsign catalog support now.

## Proposed contract

### Locale authoring and explicit references

- Keep mechanical YAML under `core/content/<domain>/`. Author display fields as
  explicit full-field references, including newly added skill fields:
  `{LOCALE.races.altmer.label}`, `{LOCALE.traits.weakness.description}`,
  `{LOCALE.skills.alchemy.label}`, `{LOCALE.birthsigns.theWarrior.description}`.
  Do not replace these with implicit key derivation or rename stable content keys.
- Store locale YAML at `core/locales/<language>/<domain>.yml`, using plural domain
  names `races`, `traits`, `skills`, and `birthsigns`. A file contains a map of
  content keys to `label`/`description` string leaves; the filename supplies the
  reference's domain. Both trait source files share `traits.yml`.
- Use canonical BCP 47 language tags for directory/artifact names: `en` is the
  authoritative source; examples of other names are `fr`, `pt-BR`, `zh-Hant`.
  Validate canonical spelling, reject aliases/case-colliding duplicates, and do not
  silently infer a language from a machine, browser, or Foundry setting.
- References are case-sensitive dot-separated paths with the literal `LOCALE`
  prefix and balanced single braces. Existing camelCase keys remain unchanged.
  For these display fields, reject inline reference interpolation, empty segments,
  extra braces, unknown domains/fields, and references to nonexistent definitions.
  Locale leaves are terminal strings, not references to other locale leaves;
  recursive resolution and cycles are not part of this contract.
- English must contain every required display key for every authored definition,
  including skills and birthsigns, irrespective of runtime export kinds. Non-English
  files may be incomplete while contributors work. Reject duplicate YAML keys and
  invalid/non-string leaves; report unreferenced keys to expose spelling mistakes.

### Temporary text versus missing keys

A missing key is an authoring coverage error, not temporary prose. An empty string
does not satisfy required display coverage. A **present, visibly marked temporary
string** does satisfy key coverage while approved text is unavailable.

Use an unmistakable convention such as `[TEMPORARY: <contentKey> label pending]`
or `[TEMPORARY: <contentKey> approved description pending]`. These examples are
editorial notices, not rules text. Keep a machine-recognizable marker and report
temporary entries separately from missing keys. Temporary entries must stay visibly
marked in compiled text; do not rely only on comments or hide them behind an
apparently finished description. Existing Forge suppression of `{LOCALE` is not
the temporary-text convention.

Do not translate fabricated rules or make temporary descriptions sound
authoritative. Contributors may supply an equally marked notice in their language
while retaining the recognizable marker. A temporary leaf can deliberately have
no instance placeholders; it does not establish which parameters the eventual
approved prose uses. Filling English keys with these notices is allowed, including
for descriptions, and approved-prose transfer does not block infrastructure work.
Track prose readiness separately from key coverage/translation completeness.

### Resolution and fallback

Resolve all display references at build time in a host-neutral compiler module.
Creation Kit and future Foundry compilation consume its per-language results;
neither host interprets authored `LOCALE` references at runtime.

Select one exact language per compilation. There is no implicit regional-parent
chain (`pt-BR` does not silently consult `pt`). Default publishing is strict:
non-English artifacts with missing required keys fail. An explicit compiler option
`allowEnglishFallback: true` permits missing target-language leaves to use `en`,
one leaf at a time. English itself must always be fully covered and cannot fall
back. Missing files are equivalent to missing keys for the requested domain.

A present temporary entry is not missing and must not silently fall back to a
different language. It remains a temporary entry in completeness diagnostics.
Malformed present strings, invalid placeholders, or invalid YAML never become
fallback candidates. Record each English fallback with its requested language,
reference, and source location. Incomplete authoring is permitted without producing
a publishable artifact; publishing with fallback must be a deliberate choice.

No successful result may contain an unresolved `LOCALE` reference. Fail before
publishing if any remains, including malformed `LOCALE`-like tokens. Never use a
humanized key as a substitute for mandatory English content coverage.

### Templates and applied parameters

Content compilation resolves `LOCALE` references, **not instance placeholders**.
A resolved trait template may still contain `{X}`, `{type}`, `{damage}`, or
`{range}`. Keep parameter names/case unchanged across translations. Apply values
only when formatting a particular applied trait later; reusable definitions and
compiled summaries cannot assume one race's or birthsign's values.

Validate balanced placeholder syntax and reject unknown names against the trait's
declared `params` in every field, including temporary notices. Evaluate parity on
the **effective label/description pair after per-leaf fallback**, not just the
authored target-language leaves:

- If both English fields and both effective fields are approved (non-temporary),
  the combined placeholder set of the effective pair must equal that of English.
  Placement, order, and repetition may differ; a parameter need not occur in both
  fields. Reject incompatible pairs even if the individual translated leaves
  would be valid with a different counterpart.
- If either pair contains a temporary field, compare placeholder sets per field
  wherever both the English field and its effective counterpart are approved.
  Those sets must match; moving placeholders between fields is not permitted in
  this partial comparison. A temporary field exempts only its own comparison,
  never an approved counterpart's syntax/name checks or applicable parity check.
  Temporary English leaves establish no parity requirement for their fields.

For example, suppose approved English uses `{X}` only in the label. A translated
label omits it, intending to move it into the description, but the description is
missing and falls back to English. The effective pair lacks `{X}` and must fail.
If instead the description is temporary, the approved translated label must still
match the approved English label's placeholder set and therefore also fails.

For temporary English leaves, leave that field's parity undetermined rather than
invent approved prose or parameter semantics. Non-parameterized content has no
instance placeholders under this contract. Diagnose missing/extra applied parameter
names separately, retaining Core's current reference validation.

Applied formatting must distinguish three cases rather than translate arbitrary
strings or mutate rule data:

| Category                     | Treatment                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Numeric value                | Keep the original number in content/character data; insert its display representation only during applied formatting. Do not infer units or percentages. |
| Literal text                 | Preserve supplied text, including player-authored names. Do not look it up merely because it is a string.                                                |
| Canonical translatable value | Keep the canonical token in mechanical data; use an explicitly associated locale display lookup during formatting.                                       |

The observed `type` tokens `magic`, `poison`, and `fire` remain unchanged in
`params`/`bonusParams`; any future translated display terms must not replace those
mechanical tokens. Do not assume every parameter named `type` means the same thing.
Current numeric applications of `X` can be preserved as observed; unused `X`,
`naturalWeapons.type/damage/range`, and other unused parameter meanings still need
approved rules input before assigning semantic categories. Never guess an
unclassified value into a translated category or add locale metadata to strict
Core definitions.

Defer canonical-term storage (including a possible
`core/locales/<language>/parameters.yml`), any classification registry/build-owned
display policy, companion display-table output, and mandatory canonical-term
coverage until a real instance-formatting consumer requires them. These are design
options for later formatting, not requirements or prerequisites for this project's
reference compilation. The compiler can resolve display references and preserve
instance placeholders and raw parameter data without any of them. No general rules
formatter or parameter-type system is implemented by this phase.

### Small compiler interface and host responsibilities

The proposed compiler seam accepts parsed authored definitions (all four domains),
locale maps, an exact canonical `language`, and `allowEnglishFallback` (default
`false`). It returns resolved content by authored domain, identity metadata, and
structured diagnostics. Canonical display tables and classification policy are
deferred, not compiler inputs or outputs required by this contract. Hosts own
filesystem/YAML loading and artifact serialization; reference parsing, coverage, fallback, and
placeholder validation belong behind this one shared interface, not duplicated
across hosts. Keep this build-time module host-neutral and out of browser/Core
runtime dependency paths; its exact file/package placement is later work.

Diagnostics need a stable code, severity, source file and field/key path, language,
and reference/placeholder where applicable. Distinguish malformed reference,
missing English key, missing target key, fallback used, temporary text, malformed
placeholder, unknown placeholder, and placeholder-set mismatch. Source adapters
can add YAML line/column information. Fatal diagnostics produce no publishable
result; authoring inspection can still report incomplete languages. Validate and
prepare all results before replacing generated output, as the current generator
does; do not claim transactional disk writes or live publication.

Creation Kit then projects only `race`, `skill`, and `trait` into its existing
indexes/definition artifacts and uses Core validators on resolved definitions.
Birthsign authoring is checked/resolved by the shared compiler, without adding
`birthsign` to `ContentDefinitions`, `ContentKind`, or `ContentCatalog`.
No new host runtime birthsign behavior is required.

Future Foundry compendiums receive already-translated labels/descriptions from the
same results. Foundry document IDs remain separate from mechanical keys. Foundry's
`game.i18n` is for UI localization, not resolving rules-content references or
rewriting compendium rules text at runtime. Pack formats, language selection, and
pack generation are deferred.

### Immutable identity and artifact evolution

Preserve `ContentVersion = { schemaVersion, revision }`. Do not add localization
properties to Core definitions or require a new runtime language operation.
Use a separate proposed artifact metadata record:

- `language`: the requested canonical tag, even when some leaves use English.
- `sourceRevision`: deterministic SHA-256 identity of normalized authored content
  across all four domains, before locale resolution, including mechanical data and
  explicit references. This is a content identity, not a Git commit or timestamp.
- `allowEnglishFallback`: the explicit policy used to compile this result.

The artifact `revision` must identify the complete localized build, not merely
mechanics: hash the source identity, Core schema version, artifact/compiler format,
language, fallback policy, resolved strings, and consumed locale
values/temporary status. English leaves consumed by fallback are included. A change
to published text, language, or fallback result must
change revision. Comments, YAML formatting, and filenames alone do not; keep
deterministic object ordering and preserve meaningful array order. Separate
`sourceRevision` lets hosts compare common authored sources without confusing two
languages with the same catalog revision.

Keep one immutable language/revision per published artifact set and catalog.
Transport manifests/envelopes may carry the separate localization metadata, with
matching identity checked by the host adapter on every read. This is a **planned
transport change**: the current schemas/layout do not support it. Bump
`CONTENT_ARTIFACT_FORMAT` and update transport validation together when implementing
it. Core receives only its existing version pair and plain definitions. Retain
revision-qualified paths and existing safe definition filename encoding; language
selection/root layout can be decided during host integration, not through an
in-session language switch.

A host selects a compiled artifact set before initializing its catalog. Changing
content language or revision requires a fresh catalog/runtime/creator as today.
Do not mutate active definitions, add automatic runtime fallback, polling, or a
picker as a consequence of this contract. Caching/deduplication and retry behavior
remain host responsibilities under the existing catalog interface.

## Follow-through constraints

Later implementation should test the compiler through its shared interface:
complete English coverage of all four domains; incomplete non-English authoring;
strict publication versus explicit English fallback; visible temporary text versus
absent keys; effective-pair placeholder parity after fallback, including mixed
temporary/approved fields; malformed references and placeholder errors;
preservation of mechanics and deferred instance placeholders;
deterministic language/source/artifact identity;
and absence of unresolved references in successful results. Host pipeline tests
should verify resolved indexes and definitions without widening runtime kinds.

Canonical-term coverage, classification policy, and display-table output are not
reference-compilation acceptance requirements. Revisit their design and any
necessary artifact identity changes only when an instance-formatting consumer
requires them; confirm unknown parameter semantics then without inventing prose.
Before publishing localized host artifacts,
settle their metadata envelopes and root layout together with compatibility checks.
These are implementation seams requiring attention, not reasons to invent rules,
block temporary text, or extend the authorized documentation-only work.
