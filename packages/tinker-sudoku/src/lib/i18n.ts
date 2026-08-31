import startWith from 'licia/startWith'

export type Locale = 'en' | 'zh-CN'

export interface Messages {
  youWin: string
  selectLevel: string
  level_easy: string
  level_medium: string
  level_hard: string
  level_insane: string
  newGame: string
  reset: string
  hint: string
}

const messages: Record<Locale, Messages> = {
  en: {
    youWin: 'Puzzle solved!',
    selectLevel: 'Choose difficulty',
    level_easy: 'Easy',
    level_medium: 'Medium',
    level_hard: 'Hard',
    level_insane: 'Insane',
    newGame: 'New',
    reset: 'Reset',
    hint: 'Hint',
  },
  'zh-CN': {
    youWin: '恭喜完成！',
    selectLevel: '选择难度',
    level_easy: '简单',
    level_medium: '中等',
    level_hard: '困难',
    level_insane: '极难',
    newGame: '新局',
    reset: '重置',
    hint: '提示',
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

export function getDigitFontFamily(): string {
  return getFontFamily()
}

export function getFontFamily(): string {
  return locale === 'zh-CN'
    ? '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    : '"Helvetica Neue", Arial, sans-serif'
}
