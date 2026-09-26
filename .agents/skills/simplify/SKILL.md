---
name: simplify
description: Review changed code for reuse, quality, and efficiency, then fix any issues found.
argument-hint: <game-name-or-file-path>
---

# Simplify Game Code

Find redundant / dead / duplicated code in a Tinker game, then **fix every issue**. **Walk every checklist item below in order — do not skip any category.**

Comments (why/what) are handled by the **lint** skill, not this one.

## Arguments

- Game folder (e.g. `tinker-2048`) → all `.ts` / `.css` / `.html` under `packages/<name>/`
- Or one or more file paths (still load that game’s `src/lib/i18n.ts` when present for key checks)

## Checklist

Report each hit as `[Category] path:line — …`.

### 1. Unused exports
- Exported const / function / type / interface / class never imported elsewhere in the game
- Declared variables never read

### 2. Dead code
- Unreachable after `return` / `throw` / `break`
- Branches / `switch` cases that can never run given existing callers
- Conditions that are always `true` or always `false`
- Scene / GameObject methods never registered or called

### 3. Duplicate logic
- Identical or near-identical functions → merge
- Same expression / block in 2+ places → shared helper in `src/lib/` or `src/game/`

### 4. Duplicate types
- Interfaces / types with the same shape defined more than once → keep one
- Type aliases that only re-export another type with no added meaning → remove

### 5. Repeated inline patterns
- Copy-pasted Phaser / Three.js setup (cameras, lights, input binding, overlay UI) → extract
- Same tween / draw / layout math inlined in multiple scenes or gameObjects → shared helper
- Repeated DOM event wiring in `src/ui/` → shared helper

### 6. Unused i18n keys
- If `src/lib/i18n.ts` exists: collect keys from both `en` and `zh-CN` message maps (`Messages`, `copy`, or equivalent)
- Grep all `.ts` for `t('…')` / `t("…")` / `messages.…` / `copy[locale].…` / `strings.…` usage
- A key is unused only if it is referenced nowhere in the game — then remove from **both** locales (and from the type / interface if present)

## Output

```
[Category] file:line — description
```

No issues → **No redundancies found.** End with category totals.

## Steps

1. Glob / read targets; for i18n, always load `src/lib/i18n.ts` when it exists.
2. Cross-check exports↔imports; apply **all 6** checklist items.
3. Report findings; **fix every issue** — do not skip any.
4. Re-check changed files / IDE diagnostics for TypeScript errors and fix until clean.
