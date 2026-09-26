---
name: lint
description: Check code against Tinker game plugin coding standards
argument-hint: <game-name-or-file-path>
---

# Lint Game Code

Check a Tinker game against `AGENTS.md` standards. **Walk every checklist item below in order — do not skip any category** (Comments and Licia are easy to miss).

## Arguments

- Game folder (e.g. `tinker-2048`) → all `.ts` / `.css` / `.html` under `packages/<name>/`
- Or a single file path

## Checklist

Report each hit as `[Category] path:line — …`.

### 1. Naming
- Package dir + npm name: `tinker-*` kebab-case
- Scene / GameObject / class files + identifiers: PascalCase (e.g. `GameScene.ts`, `Board.ts`)
- Functions/vars: camelCase; constants: `UPPER_SNAKE`; types/interfaces: PascalCase
- Scene keys / string constants: dedicated module (e.g. `scenes/keys.ts`) when shared

### 2. Layout
- Required: `src/main.ts`, `index.html`, `icon.png` (200×200), `package.json`, `vite.config.ts`
- Phaser 2D: `src/scenes/` (+ optional `src/gameObjects/`, `src/game/`)
- Three.js / canvas 3D: `src/game/` (+ optional `src/ui/`)
- Shared helpers: `src/lib/`; DOM/CSS UI helpers: `src/ui/`
- Never `utils/` / `helpers/` folders

### 3. Package
- Root `description`: short English blurb of what the game does — **the only English description**
- Do **not** set `tinker.description` (Tinker falls back to root `description`)
- `keywords`: always `["tinker", "game"]`
- `tinker` field: `name`, `main` (`dist/index.html`), `icon`, `category` (`entertainment` for games), `locales.zh-CN` (`name` + `description`)
- Scripts: `dev`, `build`, `format` (Prettier on `src/**/*.ts` and root html/json/ts)
- Shared libs (`phaser`, `three`, `licia`, `howler`, `planck`, `vite`, …) live at monorepo root — do not re-add in the game package
- Game-specific deps only in that package (prefer `devDependencies`)

### 4. Lib
- Pure helpers in `src/lib/` (scale, storage, input, i18n, audio, …)
- No `lib/index.ts` barrel; name files by purpose
- Tiny one-offs → `lib/util.ts`; only split when the domain is large enough
- Game rules / engine logic → `src/game/`, not mixed into scenes or UI

### 5. TypeScript
- No `any` — use proper / union types
- Prefer types next to their domain (`game/`, `scenes/`, …); shared cross-cutting types → `src/types.ts` only when needed
- Import types from the definition site — never re-export-only

### 6. i18n
- In-game UI strings via `src/lib/i18n.ts` (`t()` or a `copy` / messages map) — not scattered string literals in `.ts` **or** `index.html` HUD labels
- Both `en` and `zh-CN` required when the game has UI text
- Prefer reading locale from `tinker.getLanguage()` when available, with `navigator.language` fallback
- Package listing copy: root `description` + `tinker.locales.zh-CN.description` (not this check’s in-game strings)

### 7. Comments
- English only
- **Why, not what** — delete comments that restate the next line / function name
- Keep non-obvious rationale (engine quirks, math, tradeoffs, upstream bugs)

### 8. Fonts & assets
- System / bundled local fonts only — no remote font URLs (`fonts.google`, CDN `@import`, …)
- Games are pure web pages; rely on standard web APIs (optional `tinker` for locale/theme only)

### 9. Dependencies & stack
- 2D → Phaser 3; 3D → Three.js; build → Vite 5; language → TypeScript 5
- Prefer `licia/*` over hand-rolled helpers (see Licia below)
- Do not introduce React / MobX / Tailwind unless the game already uses them

### 10. Licia
- Prefer `licia/*` over hand-rolled helpers (map/each/isStr/trim/clamp, etc.)
- `import x from 'licia/x'` (per-module) — do not reimplement what licia already has

## Output

```
[Category] file:line — description
```

No issues → **No violations found.** End with category totals.

## Steps

1. Glob / read target sources; check **all 10** categories.
2. Report violations; **fix** clear ones (especially Comments / Licia / i18n).
3. From the game package dir:

```bash
npm run format && npm run build
```

Then from repo root:

```bash
npx tsc --noEmit
```

4. Only edit git-tracked files — never `references/` or gitignored paths. Fix this game’s TS errors and re-run until clean.
