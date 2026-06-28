# tinker-spider-solitaire

Classic Spider Solitaire card game for [TINKER](https://github.com/liriliri/tinker), rebuilt with Phaser 3.

## Highlights

- **Three difficulty levels** — Easy (1 suit), Medium (2 suits), Hard (4 suits)
- **Classic rules** — 10 columns, stock deals, complete K→A same-suit runs to win
- **Drag and drop** — move valid same-suit stacks between columns
- **Score tracking** — starting score, move counter, bonus for completed suits
- **Bilingual** — English and Chinese (zh-CN)

## Development

```bash
npm run dev    # Vite dev server
npm run build  # Production build to dist/
```

## How to Play

1. Choose a difficulty to start a new game
2. Drag face-up cards to build descending sequences (any suit)
3. Move same-suit K→A stacks to the foundation automatically when complete
4. Click the stock pile to deal one card to each column (no empty columns allowed)
5. Complete all 8 suits to win

Based on the reference implementation in `references/Spider-master`.
