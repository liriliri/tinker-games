import startWith from 'licia/startWith'

type Locale = 'en' | 'zh-CN'

interface Messages {
  youWin: string
  gameOver: string
  selectLevel: string
  level_beginner: string
  level_intermediate: string
  level_expert: string
}

const messages: Record<Locale, Messages> = {
  en: {
    youWin: 'You win!',
    gameOver: 'Game over!',
    selectLevel: 'Select Level',
    level_beginner: 'Beginner',
    level_intermediate: 'Intermediate',
    level_expert: 'Expert',
  },
  'zh-CN': {
    youWin: '你赢了！',
    gameOver: '游戏结束！',
    selectLevel: '选择难度',
    level_beginner: '初级',
    level_intermediate: '中级',
    level_expert: '高级',
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
