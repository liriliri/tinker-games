import $class from 'licia/$class'
import clamp from 'licia/clamp'
import each from 'licia/each'
import { t, tankLevelName } from '../lib/i18n'
import { STAGES } from '../game/stages'
import type { TankLevel } from '../game/types'

export interface HudCallbacks {
  onStart(playerCount: 1 | 2, stageIndex: number): void
  /** Dev-only: load stage terrain with no gameplay. */
  onPreview?(stageIndex: number): void
  onRestart(): void
  onMenu(): void
  onResume(): void
}

interface PlayerStats {
  lives: number
  score: number
  level: TankLevel
}

/** Drives the DOM overlay: menu, HUD read-outs and the end-of-stage screens. */
export class Hud {
  private readonly hud = document.getElementById('hud') as HTMLElement
  private readonly overlay = document.getElementById('overlay') as HTMLElement
  private readonly curtain = document.getElementById('curtain') as HTMLElement
  private readonly curtainText = document.getElementById(
    'curtain-text',
  ) as HTMLElement
  private readonly stageGrid = document.getElementById(
    'stage-grid',
  ) as HTMLElement

  private readonly panels = {
    menu: document.getElementById('panel-menu') as HTMLElement,
    pause: document.getElementById('panel-pause') as HTMLElement,
    clear: document.getElementById('panel-clear') as HTMLElement,
    over: document.getElementById('panel-over') as HTMLElement,
  }

  private readonly stageNumber = document.getElementById(
    'stage-number',
  ) as HTMLElement
  private readonly enemyCount = document.getElementById(
    'enemy-count',
  ) as HTMLElement
  private readonly playerCards = [
    document.getElementById('player-card-1') as HTMLElement,
    document.getElementById('player-card-2') as HTMLElement,
  ]
  private readonly playerLives = [
    document.getElementById('p1-lives') as HTMLElement,
    document.getElementById('p2-lives') as HTMLElement,
  ]
  private readonly playerScores = [
    document.getElementById('p1-score') as HTMLElement,
    document.getElementById('p2-score') as HTMLElement,
  ]
  private readonly playerLevels = [
    document.getElementById('p1-level') as HTMLElement,
    document.getElementById('p2-level') as HTMLElement,
  ]
  private readonly clearDetail = document.getElementById(
    'clear-detail',
  ) as HTMLElement
  private readonly overDetail = document.getElementById(
    'over-detail',
  ) as HTMLElement

  private selectedStage = 0
  private playerCount = 1
  private readonly stageButtons: HTMLButtonElement[] = []
  private readonly previewButton = document.getElementById(
    'button-preview',
  ) as HTMLButtonElement | null
  private readonly previewChip = document.getElementById(
    'preview-chip',
  ) as HTMLElement | null
  private readonly enemiesChip = document.querySelector(
    '.chip--enemies',
  ) as HTMLElement | null

  constructor(callbacks: HudCallbacks) {
    this.buildStageGrid()

    document
      .getElementById('button-one-player')!
      .addEventListener('click', () => {
        callbacks.onStart(1, this.selectedStage)
      })
    document
      .getElementById('button-two-players')!
      .addEventListener('click', () => {
        callbacks.onStart(2, this.selectedStage)
      })
    if (import.meta.env.DEV && this.previewButton && callbacks.onPreview) {
      this.previewButton.hidden = false
      this.previewButton.addEventListener('click', () => {
        callbacks.onPreview?.(this.selectedStage)
      })
    }
    document.getElementById('button-restart')!.addEventListener('click', () => {
      callbacks.onRestart()
    })
    document
      .getElementById('button-over-menu')!
      .addEventListener('click', () => {
        callbacks.onMenu()
      })
    document.getElementById('button-resume')!.addEventListener('click', () => {
      callbacks.onResume()
    })
    document
      .getElementById('button-pause-menu')!
      .addEventListener('click', () => {
        callbacks.onMenu()
      })

    this.applyTranslations()
  }

  private buildStageGrid() {
    this.stageGrid.replaceChildren()
    this.stageButtons.length = 0
    for (let i = 0; i < STAGES.length; i += 1) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'stage-cell'
      button.textContent = String(i + 1)
      button.setAttribute('role', 'option')
      button.setAttribute('aria-label', `${t('stage')} ${i + 1}`)
      button.addEventListener('click', () => this.selectStage(i))
      this.stageGrid.appendChild(button)
      this.stageButtons.push(button)
    }
    this.selectStage(this.selectedStage)
  }

  private selectStage(index: number) {
    this.selectedStage = clamp(index, 0, STAGES.length - 1)
    for (let i = 0; i < this.stageButtons.length; i += 1) {
      if (i === this.selectedStage)
        $class.add(this.stageButtons[i], 'is-selected')
      else $class.remove(this.stageButtons[i], 'is-selected')
      this.stageButtons[i].setAttribute(
        'aria-selected',
        i === this.selectedStage ? 'true' : 'false',
      )
    }
  }

  /** Fills every static label with the active language. */
  applyTranslations() {
    each(document.querySelectorAll('[data-i18n]'), (element) => {
      const key = element.getAttribute('data-i18n') as Parameters<typeof t>[0]
      element.textContent = t(key)
    })
    each(this.stageButtons, (button, i) => {
      button.setAttribute('aria-label', `${t('stage')} ${i + 1}`)
    })
  }

  setPlayerCount(count: number) {
    this.playerCount = count
    this.playerCards[1].hidden = count < 2
  }

  showHud(options?: { preview?: boolean }) {
    this.hud.hidden = false
    const preview = !!options?.preview
    if (this.previewChip) this.previewChip.hidden = !preview
    if (this.enemiesChip) this.enemiesChip.hidden = preview
    this.playerCards[0].hidden = preview
    this.playerCards[1].hidden = preview || this.playerCount < 2
  }

  hideHud() {
    this.hud.hidden = true
    if (this.previewChip) this.previewChip.hidden = true
  }

  setStage(stage: number) {
    this.stageNumber.textContent = String(stage)
  }

  setEnemyCount(remaining: number) {
    this.enemyCount.textContent = String(remaining)
  }

  setPlayerStats(index: 0 | 1, stats: PlayerStats) {
    this.playerLives[index].textContent = String(stats.lives)
    this.playerScores[index].textContent = String(stats.score)
    this.playerLevels[index].textContent = tankLevelName(stats.level)
  }

  showCurtain(text: string) {
    this.curtainText.textContent = text
    $class.add(this.curtain, 'is-visible')
  }

  hideCurtain() {
    $class.remove(this.curtain, 'is-visible')
  }

  private showPanel(name: keyof Hud['panels']) {
    this.overlay.hidden = false
    for (const [key, panel] of Object.entries(this.panels)) {
      panel.hidden = key !== name
    }
  }

  private hidePanels() {
    this.overlay.hidden = true
    for (const panel of Object.values(this.panels)) {
      panel.hidden = true
    }
  }

  showMenu() {
    this.selectStage(this.selectedStage)
    this.showPanel('menu')
  }

  showPause() {
    this.showPanel('pause')
  }

  showStageClear(stage: number, score: number) {
    this.clearDetail.textContent = `${t('nextStage')} ${stage + 1} · ${t('score')} ${score}`
    this.showPanel('clear')
  }

  showGameOver(reason: 'eagle' | 'dead' | 'victory', score: number) {
    const detail =
      reason === 'victory'
        ? t('allCleared')
        : t(reason === 'eagle' ? 'eagleDestroyed' : 'allDead')
    this.overDetail.textContent = `${detail} · ${t('score')} ${score}`
    this.showPanel('over')
  }

  hideOverlay() {
    this.hidePanels()
  }
}
