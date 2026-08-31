export type Locale = 'en' | 'zh-CN'

export interface Messages {
  score: string
  best: string
  introPrefix: string
  introBold: string
  newGame: string
  continue: string
  exit: string
  keepGoing: string
  tryAgain: string
  youWin: string
  gameOver: string
}

const messages: Record<Locale, Messages> = {
  en: {
    score: 'SCORE',
    best: 'BEST',
    introPrefix: 'Join the numbers and get to the ',
    introBold: '2048 tile!',
    newGame: 'New Game',
    continue: 'Continue',
    exit: 'Exit',
    keepGoing: 'Keep going',
    tryAgain: 'Try again',
    youWin: 'You win!',
    gameOver: 'Game over!',
  },
  'zh-CN': {
    score: '分数',
    best: '最佳',
    introPrefix: '合并数字，冲向 ',
    introBold: '2048 方块！',
    newGame: '新游戏',
    continue: '继续',
    exit: '退出',
    keepGoing: '继续游戏',
    tryAgain: '再试一次',
    youWin: '你赢了！',
    gameOver: '游戏结束！',
  },
}

function detectLocaleFallback(): Locale {
  const lang = navigator.language.toLowerCase()
  return lang === 'zh-cn' || lang.startsWith('zh') ? 'zh-CN' : 'en'
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
