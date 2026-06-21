import startWith from 'licia/startWith'

export type Locale = 'en' | 'zh-CN'

export interface Messages {
  tryAgain: string
  youWin: string
  gameOver: string
  selectLevel: string
  level_beginner: string
  level_intermediate: string
  level_expert: string
}

const messages: Record<Locale, Messages> = {
  en: {
    tryAgain: 'Try again',
    youWin: 'You win!',
    gameOver: 'Game over!',
    selectLevel: 'Select Level',
    level_beginner: 'Beginner',
    level_intermediate: 'Intermediate',
    level_expert: 'Expert',
  },
  'zh-CN': {
    tryAgain: '再试一次',
    youWin: '你赢了！',
    gameOver: '游戏结束！',
    selectLevel: '选择难度',
    level_beginner: '初级',
    level_intermediate: '中级',
    level_expert: '高级',
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
