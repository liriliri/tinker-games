import clamp from 'licia/clamp'
import contain from 'licia/contain'
import min from 'licia/min'
import { AudioKit } from '../lib/audio'
import { t } from '../lib/i18n'
import {
  getBest,
  loadPrefs,
  loadSnapshot,
  recordSolve,
  savePrefs,
  saveSnapshot,
  type GameSnapshot,
} from '../lib/storage'
import {
  CUBE_SIZES,
  createSolved,
  formatTime,
  generateScramble,
  isSolved,
  parseKeyMove,
  type CubeSize,
  type CubeState,
  type Move,
} from './model'
import { findSolution, prepareSolver } from './solver'
import { CubeView, type MoveTag } from './view'

function sameMove(a: Move, b: Move): boolean {
  return a.axis === b.axis && a.layer === b.layer && a.turns === b.turns
}

type Phase = 'free' | 'scrambling' | 'ready' | 'solving'
type PendingConfirm = 'scramble' | { type: 'size'; size: CubeSize }

interface SolveResult {
  time: number
  moves: number
}

interface TimerState {
  acc: number
  start: number
  running: boolean
}

export class Game {
  private stageEl: HTMLElement
  private topEl: HTMLElement
  private bottomEl: HTMLElement
  private timerEl: HTMLElement
  private bestEl: HTMLElement
  private movesBlockEl: HTMLElement
  private movesEl: HTMLElement
  private movesLabelEl: HTMLElement
  private sizeTogglesEl: HTMLElement
  private btnHint: HTMLButtonElement
  private btnScramble: HTMLButtonElement
  private webglErrorEl: HTMLElement
  private modalEl: HTMLElement
  private confirmTitleEl: HTMLElement
  private confirmCancelBtn: HTMLButtonElement
  private confirmOkBtn: HTMLButtonElement

  private view: CubeView | null = null
  private prefs = loadPrefs()
  private order: CubeSize
  private phase: Phase = 'free'
  private moves = 0
  private timer: TimerState = { acc: 0, start: 0, running: false }
  private timerDisplay = 0
  private timerTick: number | null = null
  private solved = true
  private result: SolveResult | null = null
  private best = 0
  private failed = false
  private modalOpen = false
  private resumeTimerAfterModal = false
  private pendingConfirm: PendingConfirm | null = null
  private hintQueue: Move[] | null = null
  private autoSolving = false
  private autoSolveGen = 0
  private audio = new AudioKit()

  constructor() {
    this.stageEl = document.getElementById('cube-stage')!
    this.topEl = document.getElementById('hud-top')!
    this.bottomEl = document.getElementById('hud-bottom')!
    this.timerEl = document.getElementById('timer')!
    this.bestEl = document.getElementById('best')!
    this.movesBlockEl = document.getElementById('moves-block')!
    this.movesEl = document.getElementById('moves')!
    this.movesLabelEl = document.getElementById('moves-label')!
    this.sizeTogglesEl = document.getElementById('size-toggles')!
    this.btnHint = document.getElementById('btn-hint') as HTMLButtonElement
    this.btnScramble = document.getElementById(
      'btn-scramble',
    ) as HTMLButtonElement
    this.webglErrorEl = document.getElementById('webgl-error')!
    this.modalEl = document.getElementById('confirm-modal')!
    this.confirmTitleEl = document.getElementById('confirm-title')!
    this.confirmCancelBtn = document.getElementById(
      'confirm-cancel',
    ) as HTMLButtonElement
    this.confirmOkBtn = document.getElementById(
      'confirm-ok',
    ) as HTMLButtonElement

    this.order = contain(CUBE_SIZES, this.prefs.order) ? this.prefs.order : 3
    this.best = getBest()

    this.stageEl.setAttribute('aria-label', t('cubeLabel'))
    this.bindUi()
    this.renderStaticLabels()
    this.mountView(this.restoreSize(this.order))
    this.refreshUi()
    void prepareSolver().catch(() => undefined)
  }

  private bindUi(): void {
    this.btnHint.addEventListener('click', () => void this.toggleAutoSolve())
    this.btnScramble.addEventListener('click', () => this.requestScramble())
    this.confirmCancelBtn.addEventListener('click', () =>
      this.closeConfirmModal(),
    )
    this.confirmOkBtn.addEventListener('click', () => this.confirmPending())
    this.modalEl.querySelectorAll('[data-modal-dismiss]').forEach((el) => {
      el.addEventListener('click', () => this.closeConfirmModal())
    })

    const unlock = () => this.audio.unlock()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseTimer()
        this.persist()
      }
    })
    window.addEventListener('pagehide', () => {
      this.pauseTimer()
      this.persist()
    })

    const ro = new ResizeObserver(() => this.syncInsets())
    ro.observe(this.topEl)
    ro.observe(this.bottomEl)
  }

  private renderStaticLabels(): void {
    this.sizeTogglesEl.innerHTML = ''
    for (const size of CUBE_SIZES) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'toggle'
      btn.dataset.size = String(size)
      btn.textContent = t('sizeLabel', { n: size })
      btn.setAttribute('aria-label', `${size}×${size}`)
      btn.addEventListener('click', () => this.requestSizeChange(size))
      this.sizeTogglesEl.appendChild(btn)
    }

    this.webglErrorEl.textContent = t('webglError')
    this.movesLabelEl.textContent = t('movesLabel')
    this.btnScramble.textContent = t('scramble')
    this.btnHint.setAttribute('aria-label', t('hint'))
    this.confirmCancelBtn.setAttribute('aria-label', t('confirmCancel'))
    this.confirmOkBtn.setAttribute('aria-label', t('confirmOk'))
  }

  private needsProgressConfirm(): boolean {
    return this.phase === 'solving' && this.moves > 0
  }

  private mountView(state: CubeState): void {
    try {
      this.view = new CubeView(this.stageEl, state, {
        onMove: (move, next, tag) => this.handleMove(move, next, tag),
        onTurnStart: () => this.handleTurnStart(),
        onDoubleTap: () => {
          if (
            this.phase === 'free' &&
            this.view &&
            isSolved(this.view.getState())
          ) {
            void this.scramble()
          }
        },
      })
      this.syncInsets()
    } catch (err) {
      console.error('[rubiks-cube] WebGL/scene init failed:', err)
      this.failed = true
      this.webglErrorEl.classList.remove('hidden')
      this.refreshUi()
    }
  }

  private syncInsets(): void {
    this.view?.setInsets(this.topEl.offsetHeight, this.bottomEl.offsetHeight)
  }

  private restoreSize(size: CubeSize): CubeState {
    const snap = loadSnapshot(size)
    const state = snap?.state ?? createSolved(size)
    let phase: Phase = 'free'
    if (snap?.scrambled) phase = snap.moves > 0 ? 'solving' : 'ready'

    this.timer = {
      acc: snap?.scrambled ? snap.elapsed : 0,
      start: 0,
      running: false,
    }
    this.moves = snap?.scrambled ? snap.moves : 0
    this.phase = phase
    this.timerDisplay = this.timer.acc
    this.solved = isSolved(state)
    this.result = null
    this.best = getBest()
    this.hintQueue = null
    this.stopTimerTick()
    return state
  }

  private elapsed(): number {
    return (
      this.timer.acc +
      (this.timer.running ? performance.now() - this.timer.start : 0)
    )
  }

  private pauseTimer(): void {
    if (!this.timer.running) return
    this.timer.acc += performance.now() - this.timer.start
    this.timer.running = false
    this.timerDisplay = this.timer.acc
    this.stopTimerTick()
  }

  private startTimerTick(): void {
    this.stopTimerTick()
    this.timerTick = window.setInterval(() => {
      this.timerDisplay = this.elapsed()
      this.refreshTimer()
    }, 47)
  }

  private stopTimerTick(): void {
    if (this.timerTick !== null) {
      clearInterval(this.timerTick)
      this.timerTick = null
    }
  }

  private persist(state?: CubeState): void {
    const current = state ?? this.view?.getState()
    if (!current) return
    const active = this.phase === 'ready' || this.phase === 'solving'
    if (isSolved(current) && !active) {
      saveSnapshot(current.size as CubeSize, null)
      return
    }
    const snap: GameSnapshot = {
      state: current,
      scrambled: active,
      elapsed: this.elapsed(),
      moves: this.moves,
    }
    saveSnapshot(current.size as CubeSize, snap)
  }

  private handleTurnStart(): void {
    if (this.modalOpen) return
    if (this.phase !== 'ready' && this.phase !== 'solving') return
    if (this.timer.running) return
    this.timer.start = performance.now()
    this.timer.running = true
    this.startTimerTick()
    this.refreshUi()
  }

  private trackHintQueue(move: Move): void {
    if (!this.hintQueue?.length) {
      this.hintQueue = null
      return
    }
    if (sameMove(this.hintQueue[0], move)) this.hintQueue.shift()
    else this.hintQueue = null
  }

  private stopAutoSolve(): void {
    if (!this.autoSolving) return
    this.autoSolving = false
    this.autoSolveGen += 1
    this.hintQueue = null
    this.refreshUi()
  }

  private async toggleAutoSolve(): Promise<void> {
    if (this.autoSolving) {
      this.stopAutoSolve()
      return
    }

    const view = this.view
    if (
      !view ||
      this.failed ||
      this.modalOpen ||
      this.phase === 'scrambling' ||
      view.locked ||
      isSolved(view.getState())
    ) {
      return
    }

    const gen = ++this.autoSolveGen
    this.autoSolving = true
    this.hintQueue = null
    view.locked = true
    this.refreshUi()

    try {
      while (this.autoSolving && gen === this.autoSolveGen) {
        const current = this.view
        if (!current || isSolved(current.getState())) break

        if (!this.hintQueue?.length) {
          const solution = await findSolution(current.getState())
          if (gen !== this.autoSolveGen) return
          if (!solution?.length) break
          this.hintQueue = solution
        }

        const move = this.hintQueue[0]
        if (!move) break
        // Longer queues play faster, but never so short that turns look like teleporting.
        const dur = clamp(10 / this.hintQueue.length, 0.12, 0.4)
        await current.play([move], 'user', dur)
        if (gen !== this.autoSolveGen) return
      }
    } finally {
      if (gen === this.autoSolveGen) this.autoSolving = false
      // Scramble / modal own the lock; do not unlock over them.
      if (
        this.view &&
        !this.autoSolving &&
        !this.modalOpen &&
        (this.phase === 'free' ||
          this.phase === 'ready' ||
          this.phase === 'solving')
      ) {
        this.view.locked = false
      }
      this.refreshUi()
    }
  }

  private handleMove(move: Move, state: CubeState, tag: MoveTag): void {
    if (move.layer !== null) this.audio.playTurn()
    if (tag === 'scramble') return

    this.trackHintQueue(move)

    if (
      (this.phase === 'ready' || this.phase === 'solving') &&
      move.layer !== null
    ) {
      this.moves += 1
      if (this.phase === 'ready') this.phase = 'solving'
    }

    this.solved = isSolved(state)
    if (this.solved) {
      if (this.phase === 'solving') {
        this.pauseTimer()
        const time = this.timer.acc
        if (time > 0) {
          recordSolve({
            at: Date.now(),
            time,
            moves: this.moves,
          })
        }
        this.phase = 'free'
        this.hintQueue = null
        this.stopAutoSolve()
        this.audio.playVictory()
        this.view?.celebrate()
        this.result = { time, moves: this.moves }
        this.best = getBest()
      }
    }

    this.persist(state)
    this.refreshUi()
  }

  private async scramble(): Promise<void> {
    const view = this.view
    if (!view || this.phase === 'scrambling') return

    this.stopAutoSolve()
    this.result = null
    this.hintQueue = null
    this.phase = 'scrambling'
    this.timer = { acc: 0, start: 0, running: false }
    this.moves = 0
    this.timerDisplay = 0
    this.stopTimerTick()
    view.locked = true
    this.refreshUi()

    const moves = generateScramble(view.getState().size)
    await view.play(moves, 'scramble', min(0.14, 3 / moves.length))
    view.locked = false

    if (view.getState().size !== this.order || this.phase !== 'scrambling')
      return
    this.phase = 'ready'
    this.solved = isSolved(view.getState())
    this.persist()
    this.refreshUi()
  }

  private requestScramble(): void {
    if (this.phase === 'scrambling' || this.modalOpen) return
    if (this.needsProgressConfirm()) {
      this.openConfirmModal('scramble')
      return
    }
    void this.scramble()
  }

  private requestSizeChange(size: CubeSize): void {
    if (
      size === this.order ||
      this.phase === 'scrambling' ||
      this.modalOpen ||
      !this.view
    ) {
      return
    }
    if (this.needsProgressConfirm()) {
      this.openConfirmModal({ type: 'size', size })
      return
    }
    this.applySize(size)
  }

  private openConfirmModal(pending: PendingConfirm): void {
    this.stopAutoSolve()
    this.pendingConfirm = pending
    this.confirmTitleEl.textContent =
      pending === 'scramble' ? t('confirmScrambleTitle') : t('confirmSizeTitle')
    this.resumeTimerAfterModal = this.timer.running
    this.pauseTimer()
    this.modalOpen = true
    if (this.view) this.view.locked = true
    this.modalEl.classList.remove('hidden')
    this.modalEl.setAttribute('aria-hidden', 'false')
    this.refreshUi()
    this.confirmOkBtn.focus()
  }

  private closeConfirmModal(resume = true): void {
    if (!this.modalOpen) return
    this.modalOpen = false
    this.pendingConfirm = null
    this.modalEl.classList.add('hidden')
    this.modalEl.setAttribute('aria-hidden', 'true')
    if (this.view && this.phase !== 'scrambling') this.view.locked = false
    if (resume && this.resumeTimerAfterModal && this.phase === 'solving') {
      this.timer.start = performance.now()
      this.timer.running = true
      this.startTimerTick()
    }
    this.resumeTimerAfterModal = false
    this.refreshUi()
  }

  private confirmPending(): void {
    const pending = this.pendingConfirm
    this.closeConfirmModal(false)
    if (!pending) return
    if (pending === 'scramble') void this.scramble()
    else this.applySize(pending.size)
  }

  private applySize(size: CubeSize): void {
    if (!this.view) return
    this.stopAutoSolve()
    this.pauseTimer()
    this.persist()
    this.hintQueue = null
    this.order = size
    savePrefs({ order: size })
    this.view.setState(this.restoreSize(size))
    this.refreshUi()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.modalOpen) {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.closeConfirmModal()
      }
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const view = this.view
    if (!view) return

    if (e.key === ' ') {
      e.preventDefault()
      if (this.phase === 'free') void this.scramble()
      return
    }
    if (view.locked || e.repeat) return
    const move = parseKeyMove(e.key, view.getState().size, e.shiftKey)
    if (move) {
      e.preventDefault()
      void view.play([move], 'user', 0.14)
    }
  }

  private refreshTimer(): void {
    const active = this.phase === 'ready' || this.phase === 'solving'
    const paused = active && this.phase === 'solving' && !this.timer.running
    const showLive = (active && !paused) || !!this.result
    const value = this.result
      ? formatTime(this.result.time)
      : active
        ? this.timerDisplay > 0
          ? formatTime(this.timerDisplay)
          : '0.00'
        : '0.00'

    this.timerEl.textContent = value
    this.timerEl.classList.toggle('dim', !showLive)
    this.bestEl.textContent =
      this.best > 0 ? t('best', { time: formatTime(this.best) }) : ''
  }

  private refreshMoves(): void {
    const active =
      this.phase === 'ready' ||
      this.phase === 'solving' ||
      this.phase === 'scrambling'
    const show = active || !!this.result
    this.movesBlockEl.classList.toggle('hidden', !show)
    const count = this.result ? this.result.moves : this.moves
    this.movesEl.textContent = String(count)
    this.movesEl.classList.toggle(
      'dim',
      this.phase === 'ready' || this.phase === 'scrambling',
    )
  }

  private refreshUi(): void {
    const scrambling = this.phase === 'scrambling'
    const busy = scrambling || this.modalOpen
    const solved = !!this.view && isSolved(this.view.getState())

    this.refreshTimer()
    this.refreshMoves()

    for (const btn of this.sizeTogglesEl.querySelectorAll<HTMLButtonElement>(
      '.toggle',
    )) {
      const size = Number(btn.dataset.size) as CubeSize
      btn.classList.toggle('active', size === this.order)
      btn.disabled = busy || this.failed
    }

    this.btnHint.disabled =
      this.failed || solved || scrambling || this.modalOpen
    this.btnHint.classList.toggle('is-on', this.autoSolving)
    this.btnHint.setAttribute(
      'aria-pressed',
      this.autoSolving ? 'true' : 'false',
    )
    this.btnHint.setAttribute(
      'aria-label',
      this.autoSolving ? t('hintStop') : t('hint'),
    )
    this.btnScramble.disabled = busy || this.failed || this.autoSolving
  }
}
