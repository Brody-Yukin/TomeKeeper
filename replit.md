# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### TomeKeeper (Mobile App) — `artifacts/bookshelf`
An Expo React Native mobile app for managing a personal book library.

**Features:**
- ISBN barcode scanning (expo-camera) to look up books via Google Books API
- Full book details: title, authors, description, page count, publisher, cover, categories
- Mark books as Unread, Currently Reading, or Finished
- Page progress tracking with visual progress bar
- Star ratings for finished books
- Library filtering by status (all / reading / read / unread)
- Sorting by date added, title, author, page count
- Grouping by status or category
- Stats page with reading totals
- All data persisted locally via AsyncStorage

**Key files:**
- `context/LibraryContext.tsx` — global state with AsyncStorage persistence
- `utils/googleBooks.ts` — Google Books API integration
- `app/(tabs)/index.tsx` — Library list with filter/sort/group
- `app/(tabs)/scanner.tsx` — ISBN barcode scanner
- `app/(tabs)/settings.tsx` — Stats overview
- `app/book/[id].tsx` — Book detail screen

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
