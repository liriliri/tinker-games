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
