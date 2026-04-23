# Coding Conventions

**Analysis Date:** 2026-04-23

## Naming Patterns

**Files:**
- PascalCase for components: `GalleryHeader.tsx`, `PhotoItem.tsx`
- camelCase for utilities/hooks: `useLocalStorage.ts`, `useDebounce.ts`
- kebab-case for tests: `GalleryHeader.test.tsx`, `storage.test.ts`
- kebab-case for E2E specs: `home.spec.ts`, `admin-auth.spec.ts`
- PascalCase for stores: `galleryStore.ts`, `authStore.ts`

**Functions:**
- camelCase: `setSearchQuery`, `applyFilters`, `toggleImageSelection`
- PascalCase for React components only
- Verb-prefix for actions: `setImages`, `addImages`, `updateImage`, `removeImage`
- Question mark prefix for predicates: none observed

**Variables:**
- camelCase: `searchQuery`, `filteredImages`, `selectedImageIndex`
- PascalCase for type imports: `GalleryImage`, `PaginationState`
- SCREAMING_SNAKE_CASE for constants in `src/config/constants.ts`

**Types:**
- PascalCase type names: `GalleryState`, `PaginationState`, `SearchFilters`
- Interface without "I" prefix: `GalleryState` not `IGalleryState`
- Type aliases for unions: `type CreateGuestBookEntry = z.infer<...>`

## Code Style

**Formatting:**
- Tool: Prettier
- Config: `.prettierrc` with settings: semi: false, singleQuote: true, trailingComma: es5, printWidth: 100, tabWidth: 2
- JSX: single quotes for JSX attributes, `jsxSingleQuote: true`
- End of line: `lf`

**Linting:**
- Tool: ESLint flat config (`eslint.config.js`)
- Plugins: `@typescript-eslint`, `react`, `react-hooks`, `react-refresh`, `jsx-a11y`, `eslint-config-prettier`
- TypeScript parser with project: `./tsconfig.json`
- Key rules enforced: `prefer-const`, `no-var`, `object-shorthand`, `prefer-arrow-callback`, `prefer-template`
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-non-null-assertion`: warn
- `no-unused-vars`: varsIgnorePattern `^[A-Z_]` (allows CONSTANTS)

**Import Organization:**
1. Node built-ins
2. External packages (React, zustand, framer-motion, etc.)
3. Internal aliases (`@/...`)
4. Relative imports (`../`, `./`)
5. Grouped and sorted alphabetically within groups

**Path Aliases:**
- `@` maps to `./src/` (defined in `tsconfig.json` and `vitest.config.js`)

## Error Handling

**Patterns:**
- Try-catch with fallback values in utilities: `storage.ts` returns `defaultValue` on error
- `safeParse` for Zod validation: `createGuestBookEntrySchema.safeParse(data)`
- Error boundary component at `src/components/error/ErrorBoundary.tsx`
- Custom error classes: `RouteNotFoundError` in `src/components/error/RouteNotFoundError.tsx`
- Logger service with PII redaction in production: `src/utils/logger.ts`

**Error Logging:**
- Sentry integration via `ErrorLoggingService` (`src/services/ErrorLoggingService.ts`)
- Console logging in development, Supabase error_logs table in production
- PII redaction for sensitive keys: email, password, token, phone, address, key

## Logging

**Framework:** Custom logger in `src/utils/logger.ts`

**Patterns:**
- Development-only logging with `if (isDevelopment)` guards
- Console methods: `log`, `info`, `warn`, `error`, `debug`, `group`, `time`, `timeEnd`
- Production errors logged to Supabase `error_logs` table
- Sentry for production error tracking

## Comments

**When to Comment:**
- JSDoc for public APIs and validators: `src/validators/guestBookSchema.ts`
- Inline comments for complex logic: worker edge cases in `src/workers/__tests__/edge-cases.test.ts`
- `@ts-ignore` comments in tests only (edge case mocking)

**JSDoc/TSDoc:**
- Used for exported functions and types
- `@param`, `@returns` tags for functions
- Type exports documented

## Function Design

**Size:** Small, focused functions; complex filtering logic separated into `applyFilters()`

**Parameters:**
- Typed with TypeScript interfaces
- Optional parameters with defaults
- Object destructuring for props: `const { searchQuery, setSearchQuery, filter, ... } = props`

**Return Values:**
- Explicit return types for exported functions
- Zod schemas for validation return types

## Module Design

**Exports:**
- Named exports for utilities: `export function cn(...inputs: ClassValue[])`
- Default exports for React components: `export default GalleryHeader`
- Barrel files `index.ts` for composables, hooks, stores, types, components

**Barrel Files:**
- `src/composables/index.ts`
- `src/hooks/index.ts`
- `src/stores/index.ts`
- `src/types/index.ts`
- `src/components/ui/index.ts`
- `src/components/layout/index.ts`

---

*Convention analysis: 2026-04-23*
