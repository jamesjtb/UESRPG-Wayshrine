# Core

## Domain model

- Place domain interfaces and type aliases in `core/interface/<domain>/<Concept>.ts`.
- Keep related types together in the same concept module.
- Place shared cross-domain types in `core/interface/common/`.
- Place enums in `core/src/enum/`.
- Place YAML content catalogs in `core/content/<domain>/`.
- Keep shared and PC/NPC-specific types distinct, co-locating related definitions
  in the same concept module.
- Keep stored statistics separate from calculated results and aggregated modifier
  inputs. Use plain numbers for numeric fields; boundary schemas can validate
  value constraints when needed, and calculation functions will enforce formulas.
- Introduce Zod schemas at external boundaries when runtime validation is needed.

## Validation

Run `pnpm --filter @wayshrine/core test` for compile-time model checks.
