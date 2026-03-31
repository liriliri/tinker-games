# CLAUDE.md

Guidelines for developing TINKER game plugins.

## Project layout

Monorepo with npm workspaces. Each game is a separate package under `packages/`.

```
packages/
  tinker-xxx/
    src/
      main.ts       # Entry point
      scenes/       # Phaser scenes (2D) or game/ (3D)
    index.html
    icon.png        # 200x200 px
    package.json
    vite.config.ts
```

## Adding a new game

1. Create `packages/tinker-xxx/`.
2. Copy structure from an existing game (tinker-2048 for Phaser 2D, tinker-cube for Three.js 3D).
3. Update `package.json`: name, description, tinker.name, tinker.locales.
4. Replace `icon.png` (200x200 px).
5. Implement game logic.
6. Run `npm install` from root to link workspaces.

## Naming convention

- Directory name and npm package name both use: `tinker-xxx` (e.g., `tinker-2048`, `tinker-cube`)

## TINKER configuration

Declare `tinker` field in each game's `package.json`:

```json
"tinker": {
  "name": "Game Name",
  "main": "dist/index.html",
  "icon": "icon.png",
  "locales": { "zh-CN": { "name": "游戏名" } }
}
```

## Build commands (per game)

```bash
npm run dev      # Browser dev server (Vite HMR)
npm run build    # Build (dist/)
```

## Tech stack

- 2D games: Phaser 3
- 3D games: Three.js
- Build: Vite 5
- Language: TypeScript 5

## Notes

- Games are pure web pages. They run identically in Tinker and browsers.
- No Tinker API is used — games rely only on standard web APIs.
