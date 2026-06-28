import Phaser from 'phaser'
import type {
  Card,
  CompletedStackInfo,
  DealCardInfo,
} from '../game/SpiderBoard'
import type { SpiderBoard } from '../game/SpiderBoard'
import { getCardTextureKey } from '../game/cardAssets'
import {
  CARD_OVERLAP,
  COLUMN_SPACING,
  COMPLETION_CARD_DURATION,
  COMPLETION_CARD_STAGGER,
  columnCenterX,
  DEAL_CARD_DURATION,
  DEAL_CARD_STAGGER,
  foundationCenterX,
  FOUNDATION_Y,
  RANK_K,
  STOCK_X,
  STOCK_X_DELTA,
  STOCK_Y,
  STOCK_Y_DELTA,
  TABLEAU_Y,
} from '../game/constants'
import { tableauCardY } from './BoardBackground'
import { s } from '../scale'
import {
  sizeCardSprite,
  scaledCardHeight,
  scaledCardWidth,
} from '../game/spriteScale'
import { CardView } from './CardView'

export interface DragState {
  sourceCol: number
  startRow: number
  cardIds: number[]
  columnSnapshot: Card[]
  offsetX: number
  offsetY: number
}

export class TableLayer {
  private container: Phaser.GameObjects.Container
  private cardViews = new Map<number, CardView>()
  private stockImages: Phaser.GameObjects.Image[] = []
  private foundationImages: Phaser.GameObjects.Image[] = []
  private dragLayer: Phaser.GameObjects.Container
  private stockZone?: Phaser.GameObjects.Zone
  private dragState: DragState | null = null
  private dealCallback?: () => void
  private activeTweens: Phaser.Tweens.Tween[] = []
  private onMoveAttempt?: (
    sourceCol: number,
    startRow: number,
    targetCol: number,
  ) => boolean

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(40)
    this.dragLayer = scene.add.container(0, 0).setDepth(1000)
  }

  setMoveHandler(
    handler: (
      sourceCol: number,
      startRow: number,
      targetCol: number,
    ) => boolean,
  ) {
    this.onMoveAttempt = handler
  }

  destroy() {
    this.clearCards()
    this.container.destroy(true)
    this.dragLayer.destroy(true)
  }

  clearCards() {
    this.stopActiveTweens()
    for (const view of this.cardViews.values()) {
      view.destroy(true)
    }
    this.cardViews.clear()
    this.dragLayer.removeAll(true)
    for (const img of this.stockImages) img.destroy()
    for (const img of this.foundationImages) img.destroy()
    this.stockImages = []
    this.foundationImages = []
    this.stockZone?.destroy()
    this.stockZone = undefined
    this.dragState = null
  }

  render(board: SpiderBoard) {
    this.clearCards()
    this.drawStock(board.stock.length)
    this.drawFoundations(board)
    this.syncStockZone(board.stock.length)

    for (let col = 0; col < board.tableau.length; col++) {
      const column = board.tableau[col]
      for (let row = 0; row < column.length; row++) {
        const card = column[row]
        const view = new CardView(this.scene, card)
        const pos = this.tableauPosition(column, col, row)
        view.setPosition(pos.x, pos.y)
        view.setDepth(this.tableauDepth(col, row))
        view.setFaceUp(card.faceUp)

        if (card.faceUp) {
          this.bindCardInput(view, col, row, board, column)
        }

        this.cardViews.set(card.id, view)
        this.container.add(view)
      }
    }
  }

  private bindCardInput(
    view: CardView,
    col: number,
    row: number,
    board: SpiderBoard,
    column: Card[],
  ) {
    view.setInteractive({ useHandCursor: true })
    view.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!board.isValidMoveStack(col, row)) {
        this.pulseInvalid(view)
        return
      }

      const stack = column.slice(row)
      const cardIds = stack.map((c) => c.id)

      this.dragState = {
        sourceCol: col,
        startRow: row,
        cardIds,
        columnSnapshot: column.map((c) => ({ ...c })),
        offsetX: pointer.x - view.x,
        offsetY: pointer.y - view.y,
      }

      for (const id of cardIds) {
        const cardView = this.cardViews.get(id)
        if (!cardView) continue
        this.container.remove(cardView)
        this.dragLayer.add(cardView)
        cardView.setDepth(1000 + cardView.y)
      }

      this.scene.input.on('pointermove', this.onPointerMove, this)
      this.scene.input.once('pointerup', this.onPointerUp, this)
    })
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.dragState) return

    const { cardIds, offsetX, offsetY, sourceCol } = this.dragState
    const baseX = pointer.x - offsetX
    const baseY = pointer.y - offsetY

    cardIds.forEach((id, index) => {
      const view = this.cardViews.get(id)
      if (!view) return
      view.setPosition(baseX, baseY + index * s(CARD_OVERLAP))
      view.setDepth(2000 + index)
    })

    const targetCol = this.columnFromX(pointer.x)
    for (const id of cardIds) {
      this.cardViews.get(id)?.setHighlight(targetCol !== sourceCol)
    }
  }

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    this.scene.input.off('pointermove', this.onPointerMove, this)

    if (!this.dragState) return

    const { sourceCol, startRow, cardIds } = this.dragState
    const targetCol = this.columnFromX(pointer.x)

    let moved = false
    if (this.onMoveAttempt && targetCol >= 0) {
      moved = this.onMoveAttempt(sourceCol, startRow, targetCol)
    }

    if (!moved && this.dragState) {
      this.returnStack(this.dragState)
    }

    for (const id of cardIds) {
      this.cardViews.get(id)?.setHighlight(false)
    }

    this.dragState = null
  }

  private returnStack(drag: DragState) {
    const { sourceCol, startRow, cardIds, columnSnapshot } = drag
    cardIds.forEach((id, index) => {
      const view = this.cardViews.get(id)
      if (!view) return
      this.dragLayer.remove(view)
      this.container.add(view)
      const row = startRow + index
      const pos = this.tableauPosition(columnSnapshot, sourceCol, row)
      view.setPosition(pos.x, pos.y)
      view.setDepth(this.tableauDepth(sourceCol, row))
    })
  }

  private pulseInvalid(view: CardView) {
    this.scene.tweens.add({
      targets: view,
      x: view.x + s(6),
      duration: 50,
      yoyo: true,
      repeat: 2,
    })
  }

  private columnFromX(x: number) {
    let nearest = -1
    let minDist = Infinity
    const maxDist = s(COLUMN_SPACING / 2 + 6)

    for (let col = 0; col < 10; col++) {
      const center = s(columnCenterX(col))
      const dist = Math.abs(x - center)
      if (dist < minDist) {
        minDist = dist
        nearest = col
      }
    }

    return minDist <= maxDist ? nearest : -1
  }

  private tableauPosition(column: Card[], col: number, row: number) {
    return {
      x: s(columnCenterX(col)),
      y: s(TABLEAU_Y + tableauCardY(column, row)),
    }
  }

  private tableauDepth(col: number, row: number) {
    return col * 100 + row
  }

  private drawStock(count: number) {
    if (count <= 0) return

    const layers = Math.min(5, Math.ceil(count / 10))
    for (let i = 0; i < layers; i++) {
      const img = sizeCardSprite(
        this.scene.add
          .image(
            s(STOCK_X + i * STOCK_X_DELTA),
            s(STOCK_Y + i * STOCK_Y_DELTA),
            'backside',
          )
          .setOrigin(0.5),
      )
      this.stockImages.push(img)
      this.container.add(img)
    }
  }

  private drawFoundations(board: SpiderBoard) {
    for (let i = 0; i < board.foundations.length; i++) {
      const slot = board.foundations[i]
      if (!slot) continue

      const img = sizeCardSprite(
        this.scene.add
          .image(
            s(foundationCenterX(i)),
            s(FOUNDATION_Y),
            getCardTextureKey(slot.suit, RANK_K),
          )
          .setOrigin(0.5),
      )
      this.foundationImages.push(img)
      this.container.add(img)
    }
  }

  setStockInteractive(onDeal: () => void) {
    this.dealCallback = onDeal
  }

  animateDeal(
    board: SpiderBoard,
    dealt: DealCardInfo[],
    onComplete: () => void,
  ) {
    if (dealt.length === 0) {
      onComplete()
      return
    }

    const startX = s(STOCK_X)
    const startY = s(STOCK_Y)
    let finished = 0
    const total = dealt.length

    dealt.forEach(({ card, col }, index) => {
      const column = board.tableau[col]
      const row = column.length
      const target = this.tableauPosition([...column, card], col, row)

      const view = new CardView(this.scene, card)
      view.setPosition(startX, startY)
      view.setFaceUp(true)
      view.setDepth(2500 + index)
      this.dragLayer.add(view)

      const tween = this.scene.tweens.add({
        targets: view,
        x: target.x,
        y: target.y,
        duration: DEAL_CARD_DURATION,
        delay: index * DEAL_CARD_STAGGER,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.landDealtCard(board, view, card, col)
          finished++
          if (finished === total) onComplete()
        },
      })
      this.activeTweens.push(tween)
    })
  }

  private landDealtCard(
    board: SpiderBoard,
    view: CardView,
    card: Card,
    col: number,
  ) {
    board.applyDeal([{ card, col }])
    const row = board.tableau[col].length - 1
    const column = board.tableau[col]

    this.dragLayer.remove(view)
    this.container.add(view)
    view.setDepth(this.tableauDepth(col, row))
    this.cardViews.set(card.id, view)
    this.bindCardInput(view, col, row, board, column)
  }

  animateCompletions(
    board: SpiderBoard,
    completions: CompletedStackInfo[],
    onComplete: () => void,
  ) {
    if (completions.length === 0) {
      onComplete()
      return
    }

    const runAt = (index: number) => {
      if (index >= completions.length) {
        onComplete()
        return
      }

      this.animateSingleCompletion(board, completions[index], () => {
        runAt(index + 1)
      })
    }

    runAt(0)
  }

  private stopActiveTweens() {
    for (const tween of this.activeTweens) {
      tween.stop()
    }
    this.activeTweens = []
  }

  private animateSingleCompletion(
    board: SpiderBoard,
    info: CompletedStackInfo,
    onComplete: () => void,
  ) {
    const cards = board.tableau[info.col].slice(
      info.startIndex,
      info.startIndex + 13,
    )
    const views = cards
      .map((card) => this.cardViews.get(card.id))
      .filter((view): view is CardView => view !== undefined)

    if (views.length === 0) {
      onComplete()
      return
    }

    const targetX = s(foundationCenterX(info.foundationSlot))
    const targetY = s(FOUNDATION_Y)
    let finished = 0
    const total = views.length

    views
      .slice()
      .reverse()
      .forEach((view, index) => {
        this.container.remove(view)
        this.dragLayer.add(view)
        view.disableInteractive()
        view.setDepth(3000 + index)

        const tween = this.scene.tweens.add({
          targets: view,
          x: targetX,
          y: targetY - index * s(2),
          scale: 0.92,
          duration: COMPLETION_CARD_DURATION,
          delay: index * COMPLETION_CARD_STAGGER,
          ease: 'Cubic.easeInOut',
          onComplete: () => {
            view.destroy(true)
            this.cardViews.delete(view.cardId)
            finished++
            if (finished === total) onComplete()
          },
        })
        this.activeTweens.push(tween)
      })
  }

  private syncStockZone(stockCount: number) {
    this.stockZone?.destroy()
    this.stockZone = undefined
    if (stockCount <= 0 || !this.dealCallback) return

    this.stockZone = this.scene.add
      .zone(
        s(STOCK_X),
        s(STOCK_Y),
        scaledCardWidth() + s(16),
        scaledCardHeight(),
      )
      .setInteractive({ useHandCursor: true })

    this.stockZone.on('pointerup', this.dealCallback)
    this.container.add(this.stockZone)
  }
}
