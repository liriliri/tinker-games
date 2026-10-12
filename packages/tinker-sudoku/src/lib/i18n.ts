import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
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
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  return startWith(locale, 'zh') ? 'zh-CN' : 'en'
}

let locale: Locale = detectLocaleFallback()

export async function initLanguage(): Promise<void> {
  if (typeof tinker === 'undefined') return
  try {
    const language = await tinker.getLanguage()
    locale = language === 'zh-CN' ? 'zh-CN' : 'en'
  } catch {
    // Keep Intl locale fallback already applied at module load.
  }
}

export function t(key: keyof Messages): string {
  return messages[locale][key]
}

export function getFontFamily(): string {
  return locale === 'zh-CN'
    ? '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
    : '"Helvetica Neue", Arial, sans-serif'
}
