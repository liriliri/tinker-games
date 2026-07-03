import { COLORS, DIALOG_BACKDROP_ALPHA } from '../game/constants'

const PAGE_BACKDROP_ID = 'sudoku-page-backdrop'

function backdropCssColor() {
  const color = COLORS.backdrop
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r}, ${g}, ${b}, ${DIALOG_BACKDROP_ALPHA})`
}

function ensurePageBackdrop() {
  let backdrop = document.getElementById(
    PAGE_BACKDROP_ID,
  ) as HTMLDivElement | null
  if (backdrop) return backdrop

  backdrop = document.createElement('div')
  backdrop.id = PAGE_BACKDROP_ID
  backdrop.style.cssText = [
    'position: fixed',
    'inset: 0',
    'display: none',
    `background: ${backdropCssColor()}`,
    'z-index: 0',
  ].join(';')
  document.body.prepend(backdrop)
  return backdrop
}

export function showPageBackdrop(onDismiss: () => void) {
  const backdrop = ensurePageBackdrop()
  backdrop.style.display = 'block'
  backdrop.onclick = onDismiss
}

export function hidePageBackdrop() {
  const backdrop = document.getElementById(PAGE_BACKDROP_ID)
  if (!backdrop) return

  backdrop.style.display = 'none'
  backdrop.onclick = null
}
