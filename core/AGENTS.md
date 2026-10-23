# Core

## Schemas

- Place schemas in `core/schema/<gameconcept>Schema.ts`.
- Keep shared schemas separate from PC-specific statistics. Extend shared schemas
  in `pc`-prefixed modules for Luck, favored characteristics, and other PC statistics.
- Keep stored statistics separate from calculated results and aggregated modifier
  inputs. Schemas validate shapes; calculation functions will enforce formulas.
- Calculation functions, size categories, lucky/unlucky number selections, and
  NPC-specific statistics remain deferred.

## Validation

Run `pnpm --filter @wayshrine/core test` for schema validation tests.

Core includes DOM type declarations because Zod's declarations reference the
standard `URL` type; this does not add a browser runtime dependency.
