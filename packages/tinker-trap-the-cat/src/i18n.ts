import startWith from 'licia/startWith'

export type Locale = 'en' | 'zh-CN'

export interface Messages {
  statusHint: string
  statusWin: string
  statusLose: string
  statusGameOverReset: string
  statusInvalidCell: string
  statusAlreadyWall: string
  statusCatPosition: string
  statusCatSurrender: string
  statusClicked: string
  statusNoUndo: string
  reset: string
  undo: string
}

const messages: Record<Locale, Messages> = {
  en: {
    statusHint: 'Click a dot to trap the cat',
    statusWin: 'The cat has nowhere to go. You win!',
    statusLose: 'The cat reached the edge. You lose!',
    statusGameOverReset: 'Game over. Starting a new round',
    statusInvalidCell: 'Invalid cell',
    statusAlreadyWall: 'That dot is already a wall',
    statusCatPosition: 'That is where the cat is standing',
    statusCatSurrender: 'The cat gives up. You win!',
    statusClicked: 'You clicked',
    statusNoUndo: 'Nothing to undo',
    reset: 'Reset',
    undo: 'Undo',
  },
  'zh-CN': {
    statusHint: '点击小圆点，围住小猫',
    statusWin: '猫已经无路可走，你赢了',
    statusLose: '猫已经跑到地图边缘了，你输了',
    statusGameOverReset: '游戏已经结束，重新开局',
    statusInvalidCell: '代码错误，当前位置不存在',
    statusAlreadyWall: '点击位置已经是墙了，禁止点击',
    statusCatPosition: '点击位置是猫当前位置，禁止点击',
    statusCatSurrender: '猫认输，你赢了！',
    statusClicked: '您点击了',
    statusNoUndo: '无路可退！！！',
    reset: '重置',
    undo: '回退',
  },
}

function detectLocaleFallback(): Locale {
  const lang = navigator.language.toLowerCase()
  return lang === 'zh-cn' || startWith(lang, 'zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export function setLocale(loc: string) {
  locale = loc === 'zh-CN' ? 'zh-CN' : 'en'
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}

export function getFontFamily(): string {
  return locale === 'zh-CN'
    ? '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    : '"Helvetica Neue", Arial, sans-serif'
}
