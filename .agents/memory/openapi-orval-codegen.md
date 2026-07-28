---
name: OpenAPI/orval codegen gotchas
description: Naming pitfalls when editing lib/api-spec/openapi.yaml and regenerating clients
---

Inline (anonymous) request-body schemas in `openapi.yaml` generate a zod const and a TypeScript type with the same operation-derived name (e.g. `ImportLibraryBooksBody`), which collide when `lib/api-zod/src/index.ts` re-exports both `generated/api` and `generated/types`.

**Why:** orval names inline bodies after the operationId in both outputs; named component schemas get distinct type names.

**How to apply:** always define request bodies as named schemas under `components/schemas` and `$ref` them; then run `pnpm --filter @workspace/api-spec run codegen` (includes lib typecheck).
