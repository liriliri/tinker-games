type Locale = 'en' | 'zh-CN'

interface Messages {
  title: string
  score: string
  best: string
  hint: string
  gameOver: string
  playAgain: string
  newBest: string
}

const messages: Record<Locale, Messages> = {
  en: {
    title: 'Jump Jump',
    score: 'Score',
    best: 'Best',
    hint: 'Hold to charge · Release to jump',
    gameOver: 'Game Over',
    playAgain: 'Play Again',
    newBest: 'New best',
  },
  'zh-CN': {
    title: '跳一跳',
    score: '分数',
    best: '最佳',
    hint: '长按蓄力 · 松手起跳',
    gameOver: '游戏结束',
    playAgain: '再玩一次',
    newBest: '新纪录',
  },
}

function detectLocaleFallback(): Locale {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase()
  return locale.startsWith('zh') ? 'zh-CN' : 'en'
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
