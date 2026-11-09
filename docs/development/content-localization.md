# Content localization contract

## Status and scope

This document records the content inventory and authoring/compilation contract.
English locale text is authored for traits, races, skills, and birthsigns. The
host-neutral build-time compiler is implemented in Core's dedicated
`@wayshrine/core/content-localization` subpath. Creation Kit integrates this compiler
and consumes language-scoped format-2 JSON artifacts, with English selected by default.

Cover all currently authored races, traits, skills, and birthsigns, including
birthsign authoring even though birthsigns are not a runtime `ContentCatalog` kind.
Do not expand that runtime catalog to deliver localization. UI localization,
language pickers, Foundry pack compilation, and birthsign rules/workflow expansion
are outside this scope.

English is authoritative. Contributors translate that source into their other
native languages. Transfer of remaining approved rules prose is not a
prerequisite for delivering the localization infrastructure. Until it is available,
use explicitly marked temporary text; never reconstruct rules from mechanical data
or invent prose to make coverage appear complete.

## Current implementation

- `core/content/` contains six YAML files. Top-level map keys identify definitions;
  filenames do not. `core/locales/en/traits/`, `core/locales/en/races/`,
  `core/locales/en/skills/`, and `core/locales/en/birthsigns/` contain English text;
  the build-only compiler resolves parsed display references. Race locale authoring includes staged entries
  without mechanical definitions; those entries are not playable content.
- `Race`, `Trait`, and `Birthsign` require `label` and `description`; `Skill` makes
  both optional. Trait parameter declarations are names only. Applied parameter
  values are `string | number`, without semantic categories.
- `core/src/content/schemas.ts` validates races, skills, and traits, but accepts
  display strings without interpreting references or template placeholders.
  `validateRaceContent.ts` checks skill/trait references and exact trait parameter
  names, not parameter meaning or display formatting. Birthsigns have domain types
  but no parser in `parseContentDefinition` or runtime catalog kind.
- `creation-kit/scripts/generate-content.ts` reads all four authored domains and all
  locale language/domain shards, rejects duplicate YAML keys before object conversion,
  and invokes the shared compiler once per explicitly selected language. It derives
  runtime `skillKey`, validates resolved definitions and racial references, and emits
  only race, skill, and trait JSON. Staged locale entries never add definitions.
- The static manifest contains `artifactFormat`, `version`, and `localization`;
  indexes and definitions repeat that identity. The browser adapter pins it and checks every response.
  `ContentVersion` is immutable for a catalog/creator lifetime. See
  [Core content access](../../core/README.md#shared-content-access) and
  [static content setup](../../README.md#creation-kit-static-content).
- Forge presents compiled labels/descriptions literally, without detecting or hiding
  `LOCALE` tokens. Its readable-key fallback serves genuinely optional missing labels,
  not mandatory content coverage or runtime English fallback. Trait instances still
  show readable keys and raw parameters; definition fetching and instance formatting
  are deferred.
- Foundry is a skeleton, with no content adapter or pack compiler.

## Authored inventory

Counts below describe definitions, not implemented game-system completeness.
Every existing display reference has the exact form
`{LOCALE.<domain>.<contentKey>.<field>}` with `field` equal to `label` or
`description`. There are no inline rules descriptions in these content files.
English locale values are authored for traits, races, skills, and birthsigns; reference
resolution is performed by the build-only compiler in the Creation Kit pipeline.

| Source under `core/content/` | Entries | Display fields today       | English key coverage            |
| ---------------------------- | ------: | -------------------------- | ------------------------------- |
| `races/core.yml`             |       2 | Both fields are references | 4 English keys                  |
| `traits/core.yml`            |      44 | Both fields are references | 88 English keys                 |
| `traits/racial.yml`          |       2 | Both fields are references | 4 English keys                  |
| `skills/standard.yml`        |      20 | Both fields are references | 40 English keys                 |
| `skills/spellcasting.yml`    |       7 | Both fields are references | 14 English keys                 |
| `birthsigns/core.yml`        |      12 | Both fields are references | 24 English keys, authoring only |

There are 174 existing label/description display references in total.
Canonical parameter-display terms are deferred.
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
not translation keys. No other mechanical race definitions are authored in this
inventory. Additional race locale entries stage approved book prose under
provisional keys; they do not add definitions. Imperial Colovian/Nibenese material
and the Khajiit overview/Suthay-Raht material remain within their parent race
descriptions. Variant implementation is future work, not a locale schema feature.

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
values `magic`, `poison`, or `fire`. English trait templates preserve declared
instance placeholders such as `{X}` for later applied formatting.

Do not infer that every `X` is numeric from its name, that every `type` shares one
vocabulary, or that `damage`/`range` are numbers, dice expressions, units, or free
text. Those categories are not specified by the current types or unused templates.

### Skills

Standard keys: `acrobatics`, `alchemy`, `athletics`, `combatStyle`, `command`,
`commerce`, `deceive`, `enchant`, `evade`, `investigate`, `logic`, `lore`, `navigate`,
`observe`, `persuade`, `profession`, `ride`, `stealth`, `subterfuge`, `survival`.

Spellcasting keys: `alteration`, `conjuration`, `destruction`, `illusion`,
`mysticism`, `necromancy`, `restoration`.

All 27 have explicit references for both display fields. Governing characteristic
references are mechanical keys. `combatStyle` and `profession` permit custom names;
`profession` also permits
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

## Authoring and compilation contract

### Locale authoring and explicit references

- Keep mechanical YAML under `core/content/<domain>/`. Author display fields as
  explicit full-field references, including newly added skill fields:
  `{LOCALE.races.altmer.label}`, `{LOCALE.traits.weakness.description}`,
  `{LOCALE.skills.alchemy.label}`, `{LOCALE.birthsigns.theWarrior.description}`.
  Do not replace these with implicit key derivation or rename stable content keys.
- Traits mirror their source split at
  `core/locales/<language>/traits/core.yml` and `traits/racial.yml`. Races use
  `core/locales/<language>/races/core.yml`, `races/furstocks.yml`, and
  `races/expanded.yml`. Skills mirror their source split at
  `core/locales/<language>/skills/standard.yml` and `skills/spellcasting.yml`.
  Birthsigns group each guardian with its three charges at
  `core/locales/<language>/birthsigns/warrior.yml`, `birthsigns/mage.yml`, and
  `birthsigns/thief.yml`.
  Merge each domain's shards into one logical domain, rejecting duplicate content
  keys across shards. Each file contains a map of
  content keys to `label`/`description` string leaves, without a domain wrapper.
  The file layout supplies the reference's domain; sharding does not change
  `{LOCALE.traits.<contentKey>.<field>}`, `{LOCALE.races.<contentKey>.<field>}`, or
  `{LOCALE.skills.<contentKey>.<field>}`, or
  `{LOCALE.birthsigns.<contentKey>.<field>}` references.
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
  Terminal-text validation recognizes a braced `LOCALE` prefix (case-insensitively,
  allowing whitespace after the opening brace), or a bare `LOCALE.` followed
  immediately by an identifier-start character, another dot, or an opening brace.
  These reference-shaped tokens fail even when their path or braces are malformed.
  The ordinary word “locale”, including sentence-final punctuation, remains valid
  prose; it is not globally reserved.
- English must contain every required display key for every authored definition,
  including skills and birthsigns, irrespective of runtime export kinds. Non-English
  files may be incomplete while contributors work. Reject duplicate YAML keys and
  invalid/non-string leaves. Coverage requirements apply to referenced authored
  content. Approved locale entries may be staged before their mechanical
  definitions exist, without a separate manifest or staged-entry schema. Validate
  their shape, syntax, and duplicate keys as usual; report unused entries
  informationally, not as publication errors. Staged entries do not become runtime
  definitions and are not exported as playable content. This does not permit
  mechanical references to target absent required definitions.

### Temporary text versus missing keys

A missing key is an authoring coverage error, not temporary prose. An empty string
does not satisfy required display coverage. A **present, visibly marked temporary
string** does satisfy key coverage while approved text is unavailable.

Use an unmistakable convention such as `[TEMPORARY: <contentKey> label pending]`
or `[TEMPORARY: <contentKey> approved description pending]`. These examples are
editorial notices, not rules text. Keep a machine-recognizable marker and report
temporary entries separately from missing keys. Temporary entries must stay visibly
marked in compiled text; do not rely only on comments or hide them behind an
apparently finished description. Forge displays these marked strings directly;
presentation suppression is not the temporary-text convention.

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

`compileContentLocalization` is exported only through
`@wayshrine/core/content-localization`, backed by `core/src/content-localization/`.
It is separate from the normal runtime index and has no filesystem or YAML-loader
dependency. It accepts parsed authored definitions (all four domains), parsed
locale shards, an exact canonical `language`, and `allowEnglishFallback` (default
`false`):

```ts
import { compileContentLocalization } from "@wayshrine/core/content-localization";

const result = compileContentLocalization({
  content: [
    { domain: "traits", source: "content/traits/core.yml", data: parsedTraits },
  ],
  locales: [
    {
      domain: "traits",
      language: "en",
      source: "locales/en/traits/core.yml",
      data: parsedEnglish,
    },
  ],
  language: "en",
});
if (result.success) {
  // Detached maps: races, traits, skills, birthsigns; no staged definitions.
  consumeResolvedDefinitions(result.definitions);
} else {
  reportDiagnostics(result.diagnostics); // No definitions on failure.
}
```

Inputs use source-file strings for diagnostic provenance; each `data` is unknown
until validated at the Zod boundary. Definitions have strict domain shapes, both
display fields are required (including authored skills), and content keys and trait
parameter names use `[A-Za-z_][A-Za-z0-9_-]*`. The own map key `__proto__` is a
reserved exception: the compiler rejects it before Zod parsing, including in
nested maps such as applied trait parameters, rather than silently dropping it.
Authored skills may omit `skillKey`;
if present it must match the enclosing key. Compilation preserves its presence or
absence. The authoring types in `core/interface/common/AuthoredContent.ts` include
birthsigns without changing runtime `ContentKind` or `parseContentDefinition`.
The cross-domain compiler contracts live in
`core/interface/common/ContentLocalization.ts` and are exported through the same
build-only subpath, not the runtime index.
The build-only birthsign schema validates the existing domain structure, not new
birthsign runtime behavior or cross-content mechanical references.

Each locale entry allows only optional nonempty `label`/`description` strings.
Missing leaves are checked against authored references; invalid present leaves
fail before fallback. Every supplied shard is shape/template validated, including
unrequested languages and staged entries. Staged trait templates receive syntax
validation, but parameter-name validation waits for a mechanical declaration.
All non-trait text permits no instance placeholders. Unconsumed locale leaves are
reported individually as informational `unused-entry` diagnostics. Temporary text
is recognized by a nonempty `[TEMPORARY: ...]` marker and reported separately.

Success returns detached resolved maps, diagnostics, and only
`metadata: { language, allowEnglishFallback }`. Failure returns diagnostics with
no publishable partial definitions. Array and source insertion order, mechanical
values, and literal instance placeholders are preserved. No input objects are
mutated or shared with the output.

Hosts own filesystem/YAML loading and artifact serialization. They must reject
duplicate keys **within a YAML document** while parsing (for example, YAML's
`uniqueKeys: true`): a parsed object cannot reveal keys already collapsed by its
parser. The compiler rejects duplicate content keys across content shards and
duplicate locale entry keys across shards of the same language/domain, even when
those shards provide disjoint fields. Canonical language spelling rejects aliases
and case variants rather than merging them.

Reference parsing, coverage, fallback, and placeholder validation belong behind
this shared interface. Canonical display tables and classification policy remain
deferred. Source/artifact hashing, `sourceRevision`, and transport metadata belong
to Creation Kit's host build tools, not the shared compiler or Core runtime.

Diagnostics need a stable code, severity, source file and field/key path, language,
and reference/placeholder where applicable. Distinguish malformed reference,
missing English key, missing target key, fallback used, temporary text, malformed
placeholder, unknown placeholder, and placeholder-set mismatch. Source adapters
can add YAML line/column information. Fatal diagnostics produce no publishable
result; authoring inspection can still report incomplete languages. Validate and
prepare all results before replacing generated output, as the current generator
does; do not claim transactional disk writes or live publication.

Creation Kit projects only `race`, `skill`, and `trait` into its
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
Use a separate artifact `localization` metadata record:

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
matching identity checked by the host adapter on every read. Creation Kit uses
`CONTENT_ARTIFACT_FORMAT = 2`; bump it for transport or compilation identity changes.
Core receives only its existing version pair and plain definitions. Revision-qualified
paths and safe definition filename encoding are retained.

A host selects a compiled artifact set before initializing its catalog. Changing
content language or revision requires a fresh catalog/runtime/creator as today.
Do not mutate active definitions, add automatic runtime fallback, polling, or a
picker as a consequence of this contract. Caching/deduplication and retry behavior
remain host responsibilities under the existing catalog interface.

### Creation Kit host pipeline and transport

`generateContent(sourceDirectory, outputDirectory, options)` returns one manifest
per requested language. Options are `languages` (default `["en"]`),
`allowEnglishFallback` (default `false`), `localeDirectory` (default the content
directory's sibling `locales/`), and `onDiagnostic`. The callback receives shared
compiler diagnostics, including informational unused/temporary leaves and per-leaf
fallback records. The CLI accepts repeatable `--language` and the explicit
`--allow-english-fallback` flag, printing fallback diagnostics with source paths.
All supplied shards are validated even if their languages are not requested.

Every requested language is compiled, runtime-validated, serialized, and held in
memory before the generated directory is removed. A compilation failure preserves
all previous output. Replacing files is not a transactional disk operation: an I/O
failure after removal can leave an incomplete directory. This is a pre-build step,
not live publication. Generation replaces old revisions and unselected languages.

The format-2 layout under `content/` is:

- `<language>/manifest.json`: `{ artifactFormat, version, localization }`.
- `<language>/<revision>/<kind>/index.json`: the same identity plus `kind` and
  lightweight `entries: [{ key, label }]`.
- `<language>/<revision>/<kind>/definitions/<encoded-key>.json`: the same identity
  plus `kind`, `key`, and a plain Core `definition`.

Kinds remain `race`, `skill`, and `trait`. Filenames use `encodeURIComponent` plus
encoding for dots and remaining URI punctuation (`!'()*`). HTTP consumers encode
that disk filename again as one path segment. The separate `definitions/` directory
avoids collisions with a definition named `index`. Shared authoring restricts keys
to its identifier grammar, while transport encoding remains safe for arbitrary
runtime catalog keys.

`sourceRevision` hashes the merged parsed authored maps for all four domains before
resolution, after successful validation; source paths and shard boundaries are
excluded. Localized revisions hash that identity, Core schema, artifact/compiler
format, language/fallback policy, all four resolved maps, and consumed translation
leaves. Consumed leaves are supplied leaves not marked `unused-entry` by the shared
compiler; this includes English used for coverage/parity and fallback. Temporary
status is encoded in the preserved text marker. Staged unused text is validated
but excluded from the localized hash and never emitted as playable definitions.
Sorted object keys make source filenames, mapping order, comments, and YAML
formatting irrelevant; meaningful array order remains significant.

`BrowserContentCatalog.create({ language })` defaults to `en`, validates exact
canonical spelling, and reads only that language's manifest. It pins an immutable
Core version pair and separate immutable localization metadata. Every response
must match language, source revision, artifact revision, fallback policy, and the
supported artifact/schema formats. No browser-locale discovery or runtime fallback
occurs. Only indexes remain cached; concurrent definition reads share a pending
request and release it on either outcome. Reads return detached values and failed
reads can be retried. The application-owned retryable catalog loader is shared
across consumers; switching content requires a fresh runtime/catalog/creator.

Filesystem access, SHA-256, YAML parsing, and the shared build-only compiler remain
outside the browser bundle and Core runtime.

## Follow-through constraints

The compiler is tested through its public subpath interface for:
complete English coverage of all four domains; incomplete non-English authoring;
strict publication versus explicit English fallback; visible temporary text versus
absent keys; effective-pair placeholder parity after fallback, including mixed
temporary/approved fields; malformed references and placeholder errors;
preservation of mechanics and deferred instance placeholders;
language/fallback metadata; detached outputs; and absence of unresolved references
in successful results. Host pipeline tests cover deterministic source/artifact
identity and resolved indexes/definitions without widening runtime kinds.

The host's file-backed pipeline integration also renders Forge with the real
browser catalog and Core creator, using actual English authoring and a small
test-only French shard with explicit English fallback. It checks resolved race
labels/descriptions, translated racial skill options and selected skills, staged
race exclusion, and retained choices across wizard dismissal and Back navigation.
This fixture does not establish production French translation coverage. Real-browser
checks remain necessary for reachability and desktop/mobile presentation.

Canonical-term coverage, classification policy, and display-table output are not
reference-compilation acceptance requirements. Revisit their design and any
necessary artifact identity changes only when an instance-formatting consumer
requires them; confirm unknown parameter semantics then without inventing prose.
Future hosts should settle their metadata envelopes and root layout together with
compatibility checks, without expanding reference compilation into instance formatting.
